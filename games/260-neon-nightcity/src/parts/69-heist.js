// ═══ 第四階段：大型搶劫《中央霓虹銀行》 ═══
// 流程（heist.st）：
//   plan  Vance 公寓門口的計畫板付 $10,000 籌備費，選潛行（贓款上限 $2,000,000）或強攻（$2,500,000）
//   setup 前置：偷舊碼頭路邊的黑色鑽機廂型車（上車即 2 星），甩掉警察後開回 Jax 的舊碼頭倉庫（安全屋）
//   go    到 10 St 的中央霓虹銀行門口按 E，換成 Vance 進大廳
//   lobby 大廳：8 名人質（第 8 位是警衛），威懾條每秒掉 7%，瞄準時回升、開槍大幅回升；掉到 0 行員按警報（潛行就變強攻）。
//         威懾低於 40% 時人質會一個個往門口跑（跑到門口就報警；瞄準他或 Kael 喝住才停），低於 25% 警衛 2 秒後拔槍反抗。
//         打死人質扣贓款 $40,000。Jax 蹲在金庫門口裝 C4（15 秒），Kael 守著大門用步槍指著人質
//   c4    按 G 引爆金庫門
//   drill 走到金庫門口按 E 裝鋁熱鑽機：潛行而且沒有警報就留在大廳顧人質 40 秒；
//         強攻（或已經響警報）換成 Jax 到銀行門口，4 星守 60 秒
//   escape 換成背著錢袋的 Vance 從正門出來（強攻 5 星、潛行 2 星），Jax 與 Kael 跟著掩護（69-squads.js），走到 120 m 外的逃亡車；每受 10 點傷害掉 $15,000
//   drive 上逃亡車後換成 Kael 駕駛，Vance 與 Jax 從車窗打警車；幾秒後兩台「鐵砧」戰車封住往貨場的路口，GPS 改走縫裡的鐵灣高架斷橋，
//         飛過底下那條連接道路的四台警車就甩開眼前的追兵（最多留 3 星、警察失去視線）；甩掉通緝、開進鐵灣貨場貨櫃安全屋的黃圈
//         → HEIST PASSED：扣掉中彈損失與 Zero 10% 抽成後入帳
// 任何階段 WASTED／BUSTED 就失敗，回到 go（籌備與前置保留）。
// 排在 69-gps 之後、69-market 之前；W、wantedApi 等後面的東西只在函式裡用。

ENV.bank = { lampOn: 0, wet: 0, fogDen: .018, fog: 0x1a1612, fogHi: 0x2a2218, top: 0x8a7a62, bot: 0x3a3026 };
const BANK = { x: 0, z: stZ(4) - HR - SW };   // 10 St 南側立面，門朝 +z（邏輯座標；執行時用 bankAt 換成世界座標）
const bankAt = (dx, dz, yaw = 0) => spotW({ x: BANK.x + dx, z: BANK.z + dz, yaw });
const PLAN = (([x, z]) => ({ x, z }))(toL(CREW[0].home.x, CREW[0].home.z));   // 計畫板在 Vance 家門口（邏輯座標，互動提示的 near 會換算）
const SAFE = (([x, z]) => WP(x, z - SW * .5 - HR + LANE))(toL(CREW[2].home.x, CREW[2].home.z));   // Jax 倉庫門前的車道（世界座標；home 換回邏輯座標再往路上偏）
const VAN_AT = spotW({ x: avX(0) + PARK, z: stZ(1) + 30, yaw: Math.PI });   // 世界座標
const CAR_AT = spotW({ x: avX(4) + PARK, z: stZ(4) + 30, yaw: Math.PI });
const YARD = spotW({ x: avX(5) + PARK, z: stZ(7) - 26, yaw: Math.PI });   // 鐵灣貨場的貨櫃安全屋：逃亡的終點（世界座標）
const BRIDGE_IN = { x: BROKEN.x - BROKEN.dx * (BROKEN.L + 12), z: BROKEN.z - BROKEN.dz * (BROKEN.L + 12) };   // 斷橋斜坡前的助跑起點
const HEIST_FEE = 10000, TAKE = { smart: 2000000, loud: 2500000 }, ZERO_CUT = .1;
const heist = { st: 'off', how: null, t: 0, intim: 100, alarm: false, take: 0, loss: 0, hpPrev: 0, van: null, car: null, mag: 0, warned: 0, objSmall: '' };
// 角色表：搶案的三個位置（0 進大廳與扛錢、1 開逃亡車、2 前置 B 與守門）由哪一位主角擔任；主線 4-4／4-5（69-w3-ch4.js）換成羅莎、凱爾、戴恩
const hW = k => heist.who ? heist.who[k] : k;
const hName = k => CREW[hW(k)].name;

// ─── 銀行大廳（室內場景）：大理石地板、櫃台、金庫圓門、人質 ───
const bankScene = new T.Scene();
const bank = { boxes: [], circles: [], lights: [] };
const VAULT = { x: 0, z: 20 };
let vaultDoor = null;
{
  const k = new Kit(), B = bank.boxes, cream = 0x8e8574, stone = 0x6e6658;
  const wall = (x0, x1, z0, z1, h, col, mat = 41) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  k.box(0, -.05, 11, 18.4, .1, 22.4, 0xb4ab9a, 40);
  for (let x = -8; x <= 8; x += 2) k.box(x, .003, 11, .04, .006, 22, 0x8a8070, 40);
  k.box(0, 5.25, 11, 18.4, .1, 22.4, 0x2a241c, 41);
  wall(-9.4, -9, 0, 22, 5.2, cream); wall(9, 9.4, 0, 22, 5.2, cream);
  wall(-9.4, -1.6, -.4, 0, 5.2, stone, 28); wall(1.6, 9.4, -.4, 0, 5.2, stone, 28); k.box(0, 4.4, -.2, 3.2, 1.6, .4, stone, 28);
  // 金庫牆與圓門（門另外一個 mesh，炸開時轉開）
  wall(-9.4, -1.7, 20, 20.6, 5.2, 0x4e4a44, 20); wall(1.7, 9.4, 20, 20.6, 5.2, 0x4e4a44, 20); k.box(0, 4.1, 20.3, 3.4, 2.2, .6, 0x4e4a44, 20);
  // 門框：補滿方形門洞、中間留圓孔的鋼框（門炸開後看得進金庫）
  { const sh = new T.Shape([new T.Vector2(-1.7, 0), new T.Vector2(1.7, 0), new T.Vector2(1.7, 3), new T.Vector2(-1.7, 3)]); sh.holes.push(new T.Path().absarc(0, 1.5, 1.48, 0, Math.PI * 2, true));
    k.add(new T.ExtrudeGeometry(sh, { depth: .6, bevelEnabled: false, curveSegments: 40 }), 0x5a5e62, 35, tf(0, 0, 20)); }
  // 金庫裡：一疊疊現金
  k.box(0, -.05, 22.5, 6, .1, 4, 0x3a3630, 20); wall(-3.4, 3.4, 24.4, 24.8, 5.2, 0x4e4a44, 20); wall(-3.4, -3, 20.6, 24.4, 5.2, 0x4e4a44, 20); wall(3, 3.4, 20.6, 24.4, 5.2, 0x4e4a44, 20);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) k.box(-2 + i * .8, .3 + j * .32, 23.6, .6, .28, .6, 0x5e7a52, 2);
  // 櫃台（玻璃隔板）、柱子、吊燈
  k.box(0, .55, 12.5, 14, 1.1, .8, 0x4a3020, 23).box(0, 1.12, 12.5, 14.2, .06, .9, 0x2a1a10, 40);
  // 玻璃隔板：半透明的淡色玻璃（另一個 mesh），不鏽鋼框
  const gl = new Kit();
  for (let x = -6; x <= 6; x += 3) {
    gl.box(x, 1.75, 12.5, 2.8, 1.2, .012, 0x7a8e94, 2);
    k.box(x, 2.37, 12.5, 2.9, .04, .06, 0x9a9ea2, 35);
    for (const s of [-1, 1]) k.box(x + s * 1.43, 1.76, 12.5, .04, 1.22, .06, 0x9a9ea2, 35);
  }
  bankScene.add(new T.Mesh(gl.build(), new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .07, depthWrite: false })));
  B.push({ x0: -7, x1: 7, z0: 12.1, z1: 12.9 });
  for (const x of [-5.5, 5.5]) for (const z of [4.5, 9]) { k.cyl(x, 2.6, z, .38, .42, 5.2, 16, 0xa89e8a, 40); bank.circles.push({ x, z, r: .45 }); }
  for (const z of [4, 8.5, 16]) { k.cyl(0, 4.7, z, .5, .5, .08, 16, 0xffe2a0, 11); bank.lights.push({ x: 0, y: 4.4, z, col: lin(0xffd8a0), r: 11, i: 1.6 }); }
  bank.lights.push({ x: 0, y: 3, z: 22, col: lin(0xa0ffb0), r: 5, i: .9 }, { x: -7, y: 3.6, z: 18, col: lin(0xffd8a0), r: 7, i: .8 }, { x: 7, y: 3.6, z: 18, col: lin(0xffd8a0), r: 7, i: .8 });
  bankScene.add(new T.Mesh(k.build(), MAT.ux));   // 地板與柱子是拋光大理石、牆是漆面灰泥、金庫是混凝土（07-kitx.js 的程式紋理）
  const d = new Kit();
  d.cyl(0, 0, 0, 1.45, 1.45, .45, 28, 0x8a8d92, 15, Math.PI / 2);
  for (let i = 0; i < 6; i++) d.box(Math.cos(i) * .7, Math.sin(i) * .7, -.28, .1, .5, .06, 0xc8a02a, 15, 0, 0, i);
  d.cyl(0, 0, -.3, .3, .3, .12, 16, 0xc8a02a, 15, Math.PI / 2);
  vaultDoor = new T.Group(); const dm = new T.Mesh(d.build(), MAT.uber); dm.position.set(1.45, 0, 0); vaultDoor.add(dm);
  vaultDoor.position.set(-1.45, 1.5, 20.0); bankScene.add(vaultDoor);
  bank.boxes.push({ x0: -1.6, x1: 1.6, z0: 19.6, z1: 20.1, door: 1 });
  // 以 http(s) 開啟時金庫門換成 casino.glb 的 CommonSpence 圓門（賭場 B1 同一個模型，鉸鏈在 −x、把手朝 −z），縮到這裡的洞口
  propSwap('bank', dm, 'cs_vault', [{ x: 1.45, y: -1.6, z: 0, s: .82 }], vaultDoor, null, 'casino');
}
// ─── 大廳的陳設（程式建模）：留空的地方是人質往門口跑的直線、中央走道、櫃台兩端繞去金庫的路、Jax 與鑽機的位置 ───
{
  const f = new Kit(), B = bank.boxes, C = bank.circles, r = rng(4417);
  const brass = 0xb8954a, steel = 0x9a9ea2, walnut = 0x5a3a24, ink = 0x141518;
  // 牆裙：胡桃木護牆板（凸板）、扶手線、大理石踢腳，兩側長牆
  for (const s of [-1, 1]) {
    const x = s * 8.97;
    f.box(x, .55, 10, .05, 1.1, 19.2, walnut, 25).box(s * 8.94, 1.13, 10, .08, .06, 19.2, 0x4a2e1c, 25).box(s * 8.95, .08, 10, .06, .16, 19.2, 0x3a3630, 40);
    for (let z = 1; z < 19.4; z += 1.2) f.box(s * 8.935, .6, z + .6, .02, .7, 1, 0x63422a, 25);
    f.box(s * 8.88, 5.08, 11, .24, .24, 22, 0xd8cfbc, 41);   // 頂上的線板
  }
  // 藻井：縱橫的梁把天花板分成格子
  for (const z of [2, 6, 10, 14, 18]) f.box(0, 5.07, z, 17.8, .26, .32, 0xcfc5b0, 41);
  for (const x of [-7, -3, 3, 7]) f.box(x, 5.07, 11, .32, .26, 21.6, 0xcfc5b0, 41);
  // 吊燈：吊桿、頂座、開口的燈罩與黃銅底環（裡面是原本的發光圓盤）
  for (const z of [4, 8.5, 16]) {
    f.cyl(0, 5.17, z, .14, .14, .06, 16, brass, 35);
    for (let i = 0; i < 3; i++) f.rod(Math.cos(i * 2.09) * .5, 4.85, z + Math.sin(i * 2.09) * .5, 0, 5.15, z, .008, 4, brass);
    f.lathe(0, 4.52, z, [[.64, 0], [.62, .34]], 32, 0xe8dcc0, 2).torus(0, 4.52, z, .64, .02, 32, brass, 35).torus(0, 4.86, z, .62, .015, 32, brass, 35);
  }
  // 中央走道的地毯（深紅，金色滾邊）
  f.box(0, .007, 6, 2.2, .014, 11.2, 0x4a1014, 2);
  for (const s of [-1, 1]) f.box(s * 1.04, .015, 6, .06, .004, 11.1, 0x9a7a3a, 2);
  // 排隊欄柱：兩排黃銅柱、柱間垂著紅絨繩
  const post = (x, z) => { f.lathe(x, 0, z, [[.16, 0], [.16, .02], [.05, .05], [.025, .07], [.025, .93], [.04, .95], [.035, .99], [0, 1]], 16, brass, 35); C.push({ x, z, r: .14 }); };
  for (const s of [-1, 1]) {
    const zs = [9.6, 10.6, 11.6], x = s * 1.3;
    zs.forEach(z => post(x, z));
    for (let i = 0; i < 2; i++) { const z0 = zs[i] + .04, z1 = zs[i + 1] - .04, zm = (z0 + z1) / 2; f.rod(x, .9, z0, x, .74, zm, .022, 6, 0x6a0e14, 2).rod(x, .74, zm, x, .9, z1, .022, 6, 0x6a0e14, 2); }
  }
  // 盆栽：深色陶盆裡的棕櫚（一根根葉柄往外彎，兩邊是細長的小葉）
  const palm = (px, pz) => {
    f.lathe(px, 0, pz, [[0, 0], [.2, 0], [.24, .04], [.3, .58], [.33, .6], [.31, .62], [0, .62]], 24, 0x2a2826, 10).cyl(px, .6, pz, .28, .28, .03, 20, 0x2a1e14, 2);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4 + r() * .5, L = .8 + r() * .7, up = .9 + r() * .5, ca = Math.cos(a), sa = Math.sin(a);
      const P = t => [px + ca * L * t, .6 + up * t * (1.5 - t), pz + sa * L * t];
      let q = P(0);
      for (let j = 1; j <= 12; j++) {
        const t = j / 12, p = P(t); f.rod(q[0], q[1], q[2], p[0], p[1], p[2], .012 * (1.2 - t), 4, 0x3e5a24, 2); q = p;
        if (j < 3) continue;
        const ln = .34 * (1.1 - t * .6), dy = up * (1.5 - 2 * t);
        for (const sd of [-1, 1]) f.bar(p[0], p[1], p[2], p[0] + (ca * .45 - sa * sd * .9) * ln, p[1] - (.45 + .1 * dy) * ln, p[2] + (sa * .45 + ca * sd * .9) * ln, .034, .005, [0x2f5a22, 0x3a6a28, 0x28501e][j % 3], 2);
      }
    }
    C.push({ x: px, z: pz, r: .34 });
  };
  for (const s of [-1, 1]) { palm(s * 8.4, .55); palm(s * 8.4, 4.7); }
  // 候客區：兩側牆邊各兩張胡桃木框的皮面長椅，上方掛畫
  const bench = (x, z, s) => {
    f.box(x, .2, z, .62, .08, 1.9, walnut, 24).box(x - s * .02, .3, z, .56, .14, 1.84, 0x3a2418, 10);
    for (let i = 0; i < 3; i++) f.rbox(x, .44, z - .6 + i * .6, .54, .58, .14, .05, 0x4a2c1c, 10, Math.PI / 2, 0, 0);
    f.rbox(x + s * .25, .72, z, .1, .5, 1.84, .04, 0x4a2c1c, 10);
    for (const dz of [-.88, .88]) for (const dx of [-.26, .26]) f.box(x + dx, .08, z + dz, .05, .16, .05, 0x2a1a10, 23);
    B.push({ x0: Math.min(x - .31, x + s * .31), x1: Math.max(x - .31, x + s * .31), z0: z - .95, z1: z + .95 });
  };
  for (const s of [-1, 1]) for (const z of [6.45, 8.55]) bench(s * 8.48, z, s);
  for (const s of [-1, 1]) for (const z of [6.45, 8.55]) {
    const x = s * 8.96, hue = [0x6a4a2a, 0x2a3a4a, 0x4a2a2a, 0x3a4a3a][(s + 1) + (z > 7 ? 1 : 0)];
    f.box(x, 2.5, z, .05, 1.1, 1.5, brass, 35).box(x - s * .02, 2.5, z, .02, .96, 1.36, hue, 2);
    for (let i = 0; i < 3; i++) f.box(x - s * .03, 2.25 + i * .22 + r() * .1, z - .4 + r() * .8, .01, .08 + r() * .2, .3 + r() * .4, [0xb89a6a, 0x8a3a2a, 0xd8cfbc][i], 2);
  }
  // 提款機：西牆靠門的兩台（烤漆機身、螢幕、鍵盤、遮光罩、頂上的燈條）
  for (const z of [1.65, 2.6]) {
    f.box(-8.6, .85, z, .78, 1.7, .86, 0x33373c, 34).box(-8.2, .62, z, .06, .9, .8, 0x2a2d31, 34)
      .box(-8.2, 1.2, z, .04, .34, .44, 0x101114, 2).box(-8.175, 1.2, z, .01, .28, .38, 0x0c2a3a, 11)
      .box(-8.12, .98, z, .16, .04, .3, 0x1a1c1f, 34, 0, 0, -.35).box(-8.17, 1.06, z + .28, .02, .03, .1, 0x40ff9a, 11)
      .box(-8.12, 1.5, z, .2, .04, .8, 0x25282c, 34).box(-8.205, 1.63, z, .02, .1, .7, 0x1a3a5a, 34).box(-8.17, .78, z, .02, .02, .24, ink, 2);
  }
  B.push({ x0: -9, x1: -8.15, z0: 1.2, z1: 3.05 });
  // 填單台（東側門邊）：大理石檯面、木座、單據架與拴著鍊子的筆
  f.box(7.6, .52, 2.4, .5, 1.04, 1.5, walnut, 24).box(7.6, 1.07, 2.4, .66, .05, 1.66, 0xb4ab9a, 40);
  for (let i = 0; i < 4; i++) f.box(7.6 + (i % 2 ? .2 : -.2), 1.12, 1.9 + (i >> 1) * 1, .14, .04, .3, 0xf0ece0, 2);
  for (const z of [1.9, 2.9]) f.box(7.6, 1.24, z, .5, .3, .03, brass, 35).rod(7.6, 1.1, z + .2, 7.45, 1.1, z + .5, .006, 4, 0x2a2a2c, 2);
  B.push({ x0: 7.25, x1: 7.95, z0: 1.55, z1: 3.25 });
  // 櫃台：正面凸板、大理石踢腳、窗口號燈、對講孔、密碼鍵盤；行員那側的螢幕、鍵盤、錢箱與椅子
  f.box(0, .06, 12.085, 14, .12, .04, 0x3a3630, 40);
  for (let x = -6.6; x <= 6.61; x += 1.1) f.box(x, .62, 12.08, .9, .74, .03, 0x5a3820, 23);
  const chair = (x, z, yaw) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < 5; i++) { const a = i * 1.2566 + yaw; f.rod(x, .1, z, x + Math.cos(a) * .3, .06, z + Math.sin(a) * .3, .014, 4, 0x1a1b1d, 2).cyl(x + Math.cos(a) * .3, .03, z + Math.sin(a) * .3, .03, .03, .03, 8, 0x111111, 2, Math.PI / 2, a, 0); }
    f.cyl(x, .28, z, .025, .03, .36, 8, 0x5a5e62, 35).rbox(x, .5, z, .48, .46, .08, .06, 0x1c1d20, 2, Math.PI / 2, 0, 0)
      .rbox(x - s * .24, .82, z - c * .24, .44, .5, .06, .08, 0x1c1d20, 2, -.12, yaw, 0);
    C.push({ x, z, r: .3 });
  };
  for (const x of [-6, -3, 0, 3, 6]) {
    f.box(x, 2.5, 12.5, .5, .16, .06, 0x1a1b1e, 34).box(x, 2.5, 12.465, .4, .1, .01, x === 3 ? 0xff5a3a : 0x40ff9a, 11)
      .cyl(x, 1.55, 12.5, .07, .07, .035, 16, steel, 35, Math.PI / 2, 0, 0)
      .box(x - .7, 1.2, 12.3, .09, .1, .14, 0x202226, 34, -.3, 0, 0).box(x - .7, 1.235, 12.3, .06, .03, .01, 0x6a9aba, 11, -.3, 0, 0)
      .cyl(x + .75, 1.2, 12.3, .035, .03, .12, 10, 0x2a2a2c, 2)
      .box(x + .4, 1.24, 12.8, .14, .02, .1, 0x202226, 2).box(x + .4, 1.3, 12.82, .03, .12, .03, 0x202226, 2)
      .box(x + .4, 1.48, 12.78, .56, .34, .03, ink, 10).box(x + .4, 1.48, 12.797, .5, .28, .004, 0x3a6a9a, 11)
      .box(x - .15, 1.165, 12.8, .42, .02, .14, 0x1a1b1e, 2).box(x - .1, .96, 12.93, .5, .14, .04, 0x2a2c30, 34);
    chair(x, 13.55, Math.PI);
  }
  // 後台：兩張主管桌（螢幕、文件、檯燈）、中間的點鈔桌，兩側牆邊的檔案櫃
  const desk = (x, z) => {
    f.box(x, .74, z, 1.6, .04, .8, walnut, 23);
    for (const s of [-1, 1]) f.box(x + s * .78, .37, z, .04, .72, .78, 0x4a2e1c, 25);
    f.box(x, .45, z - .37, 1.52, .5, .02, 0x4a2e1c, 23).box(x + .5, .5, z, .4, .45, .7, 0x4a2e1c, 25)
      .box(x - .2, .76, z - .2, .2, .02, .14, 0x202226, 2).box(x - .2, .95, z - .22, .03, .36, .03, 0x202226, 2)
      .box(x - .2, 1.12, z - .24, .6, .36, .03, ink, 10).box(x - .2, 1.12, z - .222, .54, .3, .004, 0x5a7a8a, 11)
      .box(x - .2, .77, z + .05, .44, .02, .15, 0x1a1b1e, 2);
    for (let i = 0; i < 4; i++) f.box(x + .45, .77 + i * .012, z + .1, .21, .01, .3, 0xf0ece0, 2, 0, (r() - .5) * .3, 0);
    f.cyl(x + .6, .78, z - .22, .07, .08, .03, 12, brass, 35).rod(x + .6, .79, z - .22, x + .6, 1.1, z - .22, .008, 4, brass).cyl(x + .6, 1.12, z - .14, .05, .1, .14, 12, 0x2a5a3a, 10, .5, 0, 0);
    B.push({ x0: x - .8, x1: x + .8, z0: z - .4, z1: z + .4 });
    chair(x, z + .7, Math.PI);
  };
  desk(-4.2, 15.2); desk(4.2, 15.2);
  f.box(0, .8, 15.1, 1.4, .04, .8, steel, 35);
  for (const dx of [-.65, .65]) for (const dz of [-.35, .35]) f.box(dx, .4, 15.1 + dz, .04, .8, .04, steel, 35);
  f.box(-.3, .95, 15.1, .36, .26, .32, 0xd8d8d4, 34).box(-.3, 1.05, 14.93, .14, .05, .01, 0x40ff9a, 11);
  for (let i = 0; i < 6; i++) f.box(.2 + (i % 3) * .17, .84 + (i >> 1 & 1) * .05, 15 + (i > 2 ? .15 : 0), .16, .045, .07, 0x5e7a52, 2);
  B.push({ x0: -.72, x1: .72, z0: 14.68, z1: 15.52 });
  for (const s of [-1, 1]) {
    for (const z of [16.45, 17.3, 18.15, 19]) {
      f.box(s * 8.69, .66, z, .6, 1.32, .8, 0x5e6266, 34);
      for (let i = 0; i < 4; i++) f.box(s * 8.385, .2 + i * .32, z, .02, .28, .74, 0x686c70, 34).box(s * 8.37, .3 + i * .32, z, .02, .025, .2, steel, 35);
    }
    B.push({ x0: s > 0 ? 8.38 : -9, x1: s > 0 ? 9 : -8.38, z0: 16.03, z1: 19.42 });
  }
  // 金庫牆上：門楣的掛鐘、西邊的銀行徽章、東邊的匯率看板
  f.cyl(0, 4.35, 19.975, .38, .38, .03, 40, 0xf2eee4, 2, Math.PI / 2, 0, 0).torus(0, 4.35, 19.955, .38, .025, 40, brass, 35, 0)
    .box(.08, 4.42, 19.955, .02, .2, .01, ink, 2, 0, 0, -.6).box(.12, 4.32, 19.955, .02, .28, .01, ink, 2, 0, 0, 1.9);
  f.box(-4.4, 3.3, 19.97, 3.2, 1.6, .04, 0x1e1c1a, 40).torus(-4.4, 3.3, 19.94, .55, .04, 40, brass, 35, 0).torus(-4.4, 3.3, 19.94, .38, .025, 6, brass, 35, 0);
  for (const s of [-1, 1]) f.box(-4.4 + s * 1.1, 3.3, 19.945, .5, .04, .02, brass, 35);
  f.box(4.4, 3.3, 19.97, 3.2, 1.6, .04, 0x0e0f10, 2).box(4.4, 3.3, 19.99, 3.3, 1.7, .01, brass, 35);
  // 兩盞壁燈（金庫牆兩側的暖光就是它們）
  for (const s of [-1, 1]) f.box(s * 7, 3.6, 19.97, .16, .3, .04, brass, 35).rod(s * 7, 3.6, 19.95, s * 7, 3.6, 19.8, .015, 6, brass).lathe(s * 7, 3.48, 19.76, [[.06, 0], [.13, .2], [.12, .22]], 16, 0xffe2b0, 11);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) f.box(5.45 - j * 1.05, 3.85 - i * .22, 19.945, j ? .3 + r() * .25 : .6 + r() * .25, .09, .005, j ? 0xd89028 : 0xb8b0a0, 11);   // 第一欄是幣別（從大廳看在左邊）
  // 監視器（四個角落）
  for (const s of [-1, 1]) for (const z of [.5, 19.4]) f.box(s * 8.75, 4.9, z, .3, .06, .3, 0xe0e0dc, 34).lathe(s * 8.75, 4.87, z, [[.12, 0], [.11, -.06], [.06, -.11], [0, -.12]], 16, 0x101114, 1);
  // 金庫裡兩側的保險箱牆（不鏽鋼小門、鑰匙孔）
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) for (let j = 0; j < 10; j++) {
    const y = .3 + i * .3, z = 20.92 + j * .34, x = s * 2.99;
    f.box(x, y, z, .02, .27, .31, i < 2 ? 0x8a8e92 : steel, 35).box(x - s * .012, y, z + .1, .006, .03, .02, 0x2a2a2c, 2);
  }
  bankScene.add(new T.Mesh(f.build(), MAT.ux));
}
const hostages = crowd(8);
const GUARD = 7, BANK_DOOR_Z = 1.2;
const hostSt = [];   // { x, z, x0, z0, yaw0, st: 'down'|'run'|'out'|'dead'|'arm', t, c: 碰撞圓, kael: Kael 會不會喝住 }
{
  const rc = rng(2024), spots = [[-6, 7], [-3.5, 6], [-1, 8], [2, 6.5], [4.5, 8], [6.5, 6], [-4.5, 10], [3.5, 10.5]];
  spots.forEach(([x, z], k) => {
    hostages.look(k, k === GUARD ? { r: rc, female: false, top: lin(0x2a3346), bot: lin(0x1a1e28), coat: 1, skirt: 0, longHair: 0, hat: 1, glowI: 0, shoe: SHOES[0] } : { r: rc, glowI: 0 });
    const yaw0 = Math.PI + (rc() - .5), c = { x, z, r: .35 };
    hostages.place(k, x, 0, z, yaw0); hostages.anim(k, ANIM.idle, rc() * 10, 1); bank.circles.push(c);
    hostSt.push({ x, z, x0: x, z0: z, yaw0, st: 'down', t: 0, c, kael: false });
  });
  hostages.flush(); bankScene.add(hostages.mesh);
}
// 大廳裡的 Jax（金庫門口）與 Kael（大門），手上的槍另外放進銀行場景
const bankCrew = crowd(2);
bankScene.add(bankCrew.mesh);
bankCrew.look(0, { r: rng(33), ...CREW[2].look }); bankCrew.look(1, { r: rng(32), ...CREW[1].look });
const bankGuns = [wModel('rifle'), wModel('smg'), wModel('pistol')];   // Jax、Kael、警衛
for (const h of bankGuns) { scene.remove(h); bankScene.add(h); }
const guard = { t: 0, shotT: 1.2 };
function hostReset() {
  hostSt.forEach((h, k) => { h.x = h.c.x = h.x0; h.z = h.c.z = h.z0; h.c.r = .35; h.st = 'down'; h.t = 0; hostages.place(k, h.x, 0, h.z, h.yaw0); hostages.anim(k, ANIM.kneel, k * 1.3, 1); });
  heist.runT = 4; guard.t = 0; guard.shotT = 1.2;
}
// 69-combat.js 的 shoot()：銀行裡的子彈只算人質（打死要扣錢；跑的人、拔槍的警衛打倒就停）
function bankShot(R, dmg) {
  let best = -1, bt = 40;
  hostSt.forEach((h, k) => { if (h.st === 'out' || h.st === 'dead') return; const t = rayCyl(R, h.x, h.z, .34, .1, h.st === 'down' ? 1.2 : 1.95); if (t < bt) { bt = t; best = k; } });
  if (best < 0) return;
  hostDie(best, R.dx, R.dz);
}
function hostDie(k, fx = 0, fz = 1) {
  const h = hostSt[k];
  const inno = k !== GUARD || h.st !== 'arm';
  h.st = 'dead'; h.c.r = 0;
  hostages.place(k, h.x, 0, h.z, Math.atan2(-fx, -fz)); hostages.anim(k, ANIM.die, -uTimeNow(), 1);
  heist.intim = Math.min(100, heist.intim + 25);
  if (inno) { heist.loss += 40000; toast('打死了人質：贓款要扣 $40,000'); }
  else toast('警衛倒下了');
}
// 威懾低就有人往門口跑；警衛拔槍。gta.aiming 時看準星指著誰
function hostStep(dt) {
  const s = heist.st, low = heist.intim < 40 && !heist.alarm;
  const R = gta.aiming ? aimRay() : null;
  const aimed = k => { if (!R) return false; const h = hostSt[k]; return rayCyl(R, h.x, h.z, .4, .1, 1.95) < 30; };
  if (low && !hostSt.some(h => h.st === 'run') && (heist.runT -= dt) <= 0) {
    const c = hostSt.map((h, k) => k).filter(k => k !== GUARD && hostSt[k].st === 'down');
    if (c.length) { const k = c[Math.floor(Math.random() * c.length)], h = hostSt[k]; h.st = 'run'; h.t = 0; h.c.r = 0; h.kael = Math.random() < .4; toast('有個人質往門口跑了：瞄準他'); }
    heist.runT = 6 + Math.random() * 4;
  }
  hostSt.forEach((h, k) => {
    if (h.st === 'run') {
      h.t += dt;
      if (aimed(k) || h.kael && h.t > 1.1) { h.st = 'down'; h.c.x = h.x; h.c.z = h.z; h.c.r = .35; heist.intim = Math.min(100, heist.intim + 12); toast(aimed(k) ? '人質又趴回去了' : 'Kael：趴下！'); return; }
      const dx = 0 - h.x, dz = BANK_DOOR_Z - .6 - h.z, d = Math.hypot(dx, dz) || 1;
      const r = collideCircle(h.x + dx / d * 2.8 * dt, h.z + dz / d * 2.8 * dt, .3, false); h.x = r.x; h.z = r.z;
      hostages.place(k, h.x, 0, h.z, Math.atan2(dx, dz)); hostages.anim(k, ANIM.run, h.t, 1.1);
      if (h.z < BANK_DOOR_Z) { h.st = 'out'; hostages.place(k, 0, -60, 0, 0); heistAlarm('人質跑出去報警了'); }
      return;
    }
    if (h.st === 'down') hostages.anim(k, heist.intim > 40 || k % 3 ? ANIM.kneel : ANIM.idle, k * 1.3, 1);
  });
  // 警衛：威懾低於 25% 超過 2 秒就站起來拔槍，每 1.2 秒朝你開一槍；Kael 3 秒後會開槍放倒他
  const g = hostSt[GUARD];
  if (g.st === 'down') { guard.t = heist.intim < 25 ? guard.t + dt : 0; if (guard.t > 2) { g.st = 'arm'; guard.t = 0; g.c.r = .35; toast('警衛拔槍了'); } }
  else if (g.st === 'arm') {
    guard.t += dt;
    const p = hostages.people[GUARD];
    hostages.place(GUARD, g.x, 0, g.z, Math.atan2(player.x - g.x, player.z - g.z));
    p.aimK = 1; p.aimP = 0; hostages.anim(GUARD, ANIM.aimIdle, 0, 1);
    if ((guard.shotT -= dt) <= 0 && !life.dead) { guard.shotT = 1.2 + Math.random() * .5; npcShoot(g.x, 1.4, g.z, .4, 9, 1, 'npc'); }
    if (guard.t > 3) { sfx.gun(.7, 1.3); hostDie(GUARD, g.x - 1.2, g.z - 2.2); }
  }
}
// 強攻（或響了警報）時 Jax 在門口守 60 秒：每 12–18 秒有一名人質從正門衝出來往警察那邊跑——瞄準他就趴下，打死扣錢，
// 跑出 32 m 就把大廳的情形告訴警察（多派一台 SWAT）；警員衝到門口 3.5 m 內就闖進大廳，Vance 擋下來但鑽機慢 6 秒
const runners = crowd(2);
scene.add(runners.mesh);
const runSt = [0, 1].map(k => { runners.look(k, { r: rng(400 + k), glowI: 0 }); runners.place(k, 0, -60, 0, 0); return { k, on: false, st: '', x: 0, z: 0, yaw: 0, t: 0, dx: 0, dz: 1 }; });
rayHooks.push((R, hit) => { for (const r of runSt) if (r.on && r.st !== 'dead') hit(rayCyl(R, r.x, r.z, .34, .1, r.st === 'run' ? 1.95 : 1.2), 'fn', (dmg, R2, mine) => runnerHit(r, R2, mine)); });
function runnerHit(r, R, mine) {
  r.st = 'dead'; r.t = 0; r.yaw = Math.atan2(-R.dx, -R.dz);
  runners.anim(r.k, ANIM.die, -uTimeNow(), 1);
  if (mine) { heist.loss += 40000; toast('打死了跑出來的人質：贓款要扣 $40,000'); }
}
function runnerOff(r) { r.on = false; runners.place(r.k, 0, -60, 0, 0); }
function holdStep(dt) {
  const door = bankAt(0, .8);
  if ((heist.runOutT -= dt) <= 0) {
    heist.runOutT = 12 + Math.random() * 6;
    const r = runSt.find(o => !o.on);
    if (r) {
      const a = (Math.random() - .5) * .5, [dx, dz] = dirW(zoneAtL(BANK.x, BANK.z), Math.sin(a), Math.cos(a));
      Object.assign(r, { on: true, st: 'run', x: door.x, z: door.z, dx, dz, yaw: Math.atan2(dx, dz), t: 0, turn: Math.random() < .5 ? -1 : 1 });
      toast('有個人質從正門衝出去了：瞄準他，別讓他跑到警察那邊');
    }
  }
  const R = gta.aiming ? aimRay() : null;
  for (const r of runSt) {
    if (!r.on) continue;
    r.t += dt;
    if (r.st === 'run') {
      if (R && rayCyl(R, r.x, r.z, .45, .1, 1.95) < 40) { r.st = 'down'; r.t = 0; toast('人質趴在地上不敢動了'); continue; }
      if (r.turn && Math.hypot(r.x - door.x, r.z - door.z) > 7) { [r.dx, r.dz] = dirW(zoneAtL(BANK.x, BANK.z), r.turn, .15); r.turn = 0; r.yaw = Math.atan2(r.dx, r.dz); }   // 跑到人行道外就沿著街往警察那邊跑
      const q = collideCircle(r.x + r.dx * 4.6 * dt, r.z + r.dz * 4.6 * dt, .3, false); r.x = q.x; r.z = q.z;
      runners.place(r.k, r.x, 0, r.z, r.yaw); runners.anim(r.k, ANIM.run, r.t, 1.15);
      if (Math.hypot(r.x - door.x, r.z - door.z) > 32) { runnerOff(r); heist.leaks = (heist.leaks || 0) + 1; spawnUnit('swat'); toast('人質跑到警察那邊了：SWAT 知道大廳的情形，又來了一台裝甲車'); }
    } else if (r.st === 'down') { runners.place(r.k, r.x, 0, r.z, r.yaw); runners.anim(r.k, ANIM.kneel, 0, 1); }
    else if (r.st === 'dead') runners.place(r.k, r.x, 0, r.z, r.yaw);
  }
  // 闖進大廳的警員：收掉，鑽機延後
  for (const c of W.cops) if (c.on && c.state === 'act' && !(c.stunT > 0) && Math.hypot(c.x - door.x, c.z - door.z) < 3.5) {
    freeCop(c); heist.t += 6; heist.breach = (heist.breach || 0) + 1; sfx.gun(.6, 1.2);
    toast('警員闖進大廳了：Vance 擋了下來，但鑽機慢了 6 秒');
  }
}
function heistAlarm(why) {
  if (heist.alarm) return;
  heist.alarm = true; sfx.busted(); toast(why);
  if (heist.how === 'smart') wantedApi.set(4);   // 潛行失誤：直接 4 星（neon_nightcity_gta_v_2.md 第 3 節）
  if (heist.st === 'drill' && heist.drilling) holdStart();
}
// 大廳的 Jax 與 Kael：C4 階段 Jax 蹲在金庫門口，之後站開；Kael 一直守著大門
function bankCrewStep() {
  const s = heist.st, lobby = s === 'lobby' || s === 'c4' || s === 'drill';
  if (!lobby) { bankCrew.place(0, 0, -60, 0, 0); bankCrew.place(1, 0, -60, 0, 0); return; }
  const jx = s === 'lobby' ? .7 : -2.6, jz = s === 'lobby' ? 18.9 : 17.2;
  bankCrew.place(0, jx, 0, jz, s === 'lobby' ? 0 : Math.PI * .8);
  bankCrew.anim(0, s === 'lobby' ? ANIM.crouch : ANIM.aimIdle, 0, 1);
  const kp = bankCrew.people[1], run = hostSt.find(h => h.st === 'run'), gd = hostSt[GUARD], look = gd.st === 'arm' ? gd : run || { x: 0, z: 8 };
  bankCrew.place(1, 1.3, 0, 2.4, Math.atan2(look.x - 1.3, look.z - 2.4));
  kp.aimK = 1; kp.aimP = -.08; bankCrew.anim(1, ANIM.aimIdle, 0, 1);
  bankCrew.people[0].aimK = s === 'lobby' ? 0 : .6; bankCrew.people[0].aimP = -.2;
}
// 68-gta.js 的 gtaLate：大廳裡的槍擺到手上
function bankGunsLate() {
  const inBank = player.where === 'bank';
  const on = [inBank && bankCrew.people[0].y > -1, inBank && bankCrew.people[1].y > -1, inBank && hostSt[GUARD].st === 'arm'];
  const who = [bankCrew.people[0], bankCrew.people[1], hostages.people[GUARD]], arms = [ARMS.rifle, ARMS.smg, ARMS.pistol];
  bankGuns.forEach((h, i) => { if (on[i] && who[i].rig) holdAt(h, who[i], arms[i]); else h.visible = false; });
}
VENUES.bank = { scene: bankScene, data: bank, spawn: { x: 0, z: 1.6, yaw: 0 }, name: '中央霓虹銀行', toast: '中央霓虹銀行', dist: '中城 · 10 St', ceil: 5.2, door: WP(BANK.x, BANK.z), out: bankAt(0, 1.4) };

// ─── 銀行門面：石造門廊、金色門、招牌（Canvas 寫字） ───
{
  const k = new Kit(), z = BANK.z, x = BANK.x;
  k.box(x, 3.2, z + .25, 9, 6.4, .5, 0x6e6658, 2);
  for (const s of [-1, 1]) for (const c of [1.9, 3.7]) k.cyl(x + s * c, 2.3, z + .75, .32, .36, 4.6, 14, 0xa89e8a, 10);
  k.box(x, 4.85, z + .8, 9.2, .5, 1.1, 0x8e8574, 2).box(x, 5.3, z + .7, 9.6, .3, 1.3, 0x5a5448, 2);
  k.box(x, 1.4, z + .52, 2.4, 2.8, .06, 0x2a2016, 10).box(x, 1.4, z + .56, 2.1, 2.5, .03, 0xc8a02a, 15);
  for (const s of [-1, 1]) k.box(x + s * 3, .08, z + 1.3, 1.4, .16, 1.2, 0x5a5448, 2);
  cityAdd(new T.Mesh(k.build(), MAT.uber));
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
  const c = cv.getContext('2d'); c.fillStyle = '#1a140c'; c.fillRect(0, 0, 1024, 128);
  c.fillStyle = '#f0d58a'; c.font = '600 58px "Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('CENTRAL NEON BANK · 中央霓虹銀行', 512, 66);
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
  const sign = new T.Mesh(new T.PlaneGeometry(8, 1), new T.MeshBasicMaterial({ map: tx, toneMapped: false }));
  sign.position.set(x, 4.85, z + 1.36); cityAdd(sign);
  outLights.push({ x, y: 4.2, z: z + 2.4, col: lin(0xffd890), r: 9, i: 1.4 });
}

// ─── 鐵灣高架斷橋（06-roads.js 的 BROKEN）：半截的高架橋、斷口的鋼筋、對面的斷柱與廢棄鐵軌；世界座標 ───
// 平常也能衝（69-stunt.js 的 JUMPS，不算跳台收集）；逃亡時兩台戰車封路，GPS 改走這裡，飛過去就把眼前的警察甩在後面
{
  const B = BROKEN, k = new Kit(), th = Math.atan2(B.H, B.L), sl = Math.hypot(B.H, B.L), rx = B.dz, rz = -B.dx, yaw = B.yaw;
  const at = (a, b = 0) => [B.x + B.dx * a + rx * b, B.z + B.dz * a + rz * b];
  const conc = 0x8a857c, dark = 0x4a4740, rust = 0x7a4426;
  { const [cx, cz] = at(-B.L / 2); k.box(cx, B.H / 2 - .4, cz, B.W, .8, sl, conc, 2, -th, yaw); }   // 橋面
  for (const s of [-1, 1]) { const [cx, cz] = at(-B.L / 2, s * (B.W / 2 - .2)); k.box(cx, B.H / 2 + .45, cz, .4, .9, sl, conc, 2, -th, yaw); }   // 護欄
  for (const f of [.42, .66, .9]) {   // 橋墩：兩根柱子加帽梁（柱子有碰撞，車開在橋面上時不算）
    const h = f * B.H - .75;
    for (const s of [-1, 1]) {
      const [x, z] = at(-B.L * (1 - f), s * (B.W / 2 - 1.3));
      k.cyl(x, h / 2, z, .5, .55, h, 14, conc, 2);
      circles.push({ x, z, r: .55, w: 1, hy: f * B.H - 1.2 });
    }
    const [x, z] = at(-B.L * (1 - f)); k.box(x, h - .3, z, B.W - .6, .6, 1.1, dark, 2, 0, yaw);
  }
  // 斷口：參差的混凝土塊、往前戳出去的鋼筋、兩盞黃色警示燈
  for (let i = 0; i < 7; i++) { const b = -B.W / 2 + .55 + i * (B.W - 1.1) / 6, [x, z] = at(.25 + (i % 3) * .3, b); k.box(x, B.H - .45 - (i % 2) * .25, z, 1.05, .55 + (i % 3) * .2, .6 + (i % 2) * .4, conc, 2, (i % 2 ? .25 : -.18), yaw, (i % 3 - 1) * .2); }
  for (let i = 0; i < 9; i++) { const b = -B.W / 2 + .6 + i * (B.W - 1.2) / 8, L = 1.2 + (i * 7 % 5) * .35, [x, z] = at(.3 + L / 2, b); k.cyl(x, B.H - .55 + (i % 3) * .12, z, .035, .035, L, 6, rust, 15, Math.PI / 2 + (i % 2 ? -.35 : .2), yaw, 0); }
  for (const s of [-1, 1]) { const [x, z] = at(-.4, s * (B.W / 2 - .2)); k.box(x, B.H + 1.05, z, .3, .3, .3, 0xffa020, 9, 0, yaw); }
  outLights.push({ ...(([x, z]) => ({ x, z }))(at(-1.5)), y: B.H + 1.6, col: lin(0xffa040), r: 9, i: .9, w: 1 });
  // 工地留下的兩盞燈：立在護欄上，照著橋面
  for (const [f, s] of [[.25, 1], [.62, -1]]) {
    const [x, z] = at(-B.L * (1 - f), s * (B.W / 2 - .2)), y = f * B.H + .9, [hx, hz] = at(-B.L * (1 - f), s * (B.W / 2 - 1.6));
    k.cyl(x, y + 2, z, .07, .09, 4, 8, dark, 15).box(hx, y + 4, hz, .5, .14, 2.8, dark, 15, 0, yaw + Math.PI / 2).box(hx, y + 3.92, hz, .4, .04, .6, 0xffd0a0, 11, 0, yaw);
    outLights.push({ x: hx, y: y + 3.8, z: hz, col: lin(0xffc890), r: 15, i: 1.1, w: 1 });
  }
  // 斜坡起點兩側的封路告示與倒在地上的三角錐（不擋路）
  for (const s of [-1, 1]) {
    const [x, z] = at(-B.L - 1.5, s * (B.W / 2 + 1.4));
    k.box(x, .7, z, .08, 1.4, .08, dark, 15).box(x, 1.55, z, 1.5, .55, .05, 0xd9b42a, 10, 0, yaw).box(x, 1.55, z + .001, 1.2, .1, .052, 0x1a1a1a, 2, 0, yaw);
  }
  // 對面：橋斷掉的另一半只剩兩根斷柱，夾著廢棄的鐵軌
  for (const s of [-1, 1]) {
    const [x, z] = at(B.land * .55, s * (B.W / 2 + 2.6));
    k.cyl(x, 1.7, z, .55, .6, 3.4, 14, conc, 2).box(x, 3.5, z, 1.1, .5, 1.1, conc, 2, .3, yaw, .2);
    circles.push({ x, z, r: .6, w: 1 });
  }
  const r0 = 20, r1 = B.land + 8;
  for (const s of [-1, 1]) { const [x, z] = at((r0 + r1) / 2, s * .72); k.box(x, .09, z, .09, .14, r1 - r0, rust, 15, 0, yaw); }
  for (let a = r0; a < r1; a += .8) { const [x, z] = at(a, 0); k.box(x, .03, z, 2.3, .07, .26, 0x3a2e24, 2, 0, yaw); }
  { const [x, z] = at(r1 + .4); k.box(x, .5, z, 2.2, .5, .4, 0x8a2a1a, 10, 0, yaw); }   // 車擋
  cityAdd(new T.Mesh(k.build(), MAT.uber), null);
  colDirty();
}

// ─── 任務目標與 HUD ───
function heistMark() {
  const s = heist.st;
  if (s === 'setupB' || s === 'drive' && heist.air) return heist2Mark();   // 69-heist2.js
  if (s === 'setup') return heist.van && player.veh === heist.van ? { name: '安全屋', x: SAFE.x, y: 1.5, z: SAFE.z, where: 'out' } : heist.van ? { name: '鑽機廂型車', x: heist.van.x, y: 2.4, z: heist.van.z, where: 'out' } : null;
  if (s === 'go') return { name: '中央霓虹銀行', ...WP(BANK.x, BANK.z + 1), y: 2.6, where: 'out' };
  if (s === 'lobby' || s === 'c4') return { name: '金庫', x: VAULT.x, y: 2, z: VAULT.z - .4, where: 'bank' };
  if (s === 'drill') return player.where === 'bank' ? { name: '金庫', x: VAULT.x, y: 2, z: VAULT.z - .4, where: 'bank' } : { name: '銀行門口', ...WP(BANK.x, BANK.z + 2), y: 2.6, where: 'out' };
  if (s === 'escape') return heist.car ? { name: '逃亡車', x: heist.car.x, y: 2, z: heist.car.z, where: 'out' } : null;
  if (s === 'drive') return heist.amb < 0 && !heist.jumped ? { name: '鐵灣高架斷橋', x: BRIDGE_IN.x, y: 2, z: BRIDGE_IN.z, where: 'out' } : { name: '貨櫃安全屋', x: YARD.x, y: 1.5, z: YARD.z, where: 'out' };
  return null;
}
// 90-hud.js 與 69-gps.js 用這個取代 QUEST[quest.n].mk()
function missionMark() { return heist.st !== 'off' && heist.st !== 'plan' ? heistMark() : SQ.def ? defMark() : side.act ? sideMark() : QUEST[quest.n].mk(); }   // 資產防守在 69-squads.js、支線活動在 69-side.js
const HEIST_TEXT = {
  setup: () => heist.van && player.veh === heist.van ? '把鑽機廂型車開回舊碼頭倉庫' + (W.stars ? '（先甩掉警察）' : '') : '前置：偷走舊碼頭的鑽機廂型車',
  go: () => '到中央霓虹銀行門口',
  lobby: () => `壓住大廳的人質（瞄準他們）· ${heist.npcN ? heist.npcN[0] : 'Jax'} 正在裝 C4`,
  c4: () => '按 G 引爆金庫門',
  drill: () => player.where === 'bank' ? (heist.t > 0 && heist.drilling ? '鑽機運作中：繼續壓住人質' : '到金庫門口按 E 裝鋁熱鑽機') : `以 ${hName(2)} 守住銀行門口${heist.breach ? `（警員闖進 ${heist.breach} 次）` : ''}`,
  escape: () => '帶著錢袋走到逃亡車',
  drive: () => heist.amb < 0 && !heist.jumped ? '戰車封路：衝上鐵灣高架斷橋飛過去' + (abil.drive ? '' : '（X 反射駕駛）') : W.stars ? '甩掉警察' : '開進鐵灣貨場的貨櫃安全屋分贓',
};
const narrowHud = matchMedia('(max-width:640px)');
function heistHud() {
  const o = $('obj'), on = heist.st !== 'off' && heist.st !== 'plan';
  o.classList.toggle('heist', on);
  if (!on) return;
  setText('objText', HEIST_TEXT[heist.st]());
  let bar = -1, num = '';
  if (player.where === 'bank' && (heist.st === 'lobby' || heist.st === 'c4' || heist.st === 'drill')) { bar = heist.intim; num = heist.drilling ? `威懾 · 鑽機 ${Math.ceil(heist.t)} 秒` : '威懾'; }
  else if (heist.st === 'drill') { bar = 100 * heist.t / (heist.holdT || 60); num = `守住 ${Math.ceil(heist.t)} 秒`; }
  else if (heist.st === 'lobby') num = '';
  if (heist.st === 'escape' || heist.st === 'drive') num = `贓款 ${money(heist.take - heist.loss)}`;
  const sub = $('objSub');
  sub.classList.toggle('bar', bar >= 0);
  if (bar >= 0) sub.style.setProperty('--v', clamp(bar, 0, 100).toFixed(1) + '%');
  sub.classList.toggle('low', bar >= 0 && bar < 30 && player.where === 'bank');
  setText('objNum', num);
  // 窄螢幕：任務框不能長高（會壓到現金那一列），計時條貼在框底、數字改寫在上面的小標
  const si = o.querySelector('small i'), sv = '· ' + (narrowHud.matches && num ? num : `中央霓虹銀行${heist.how === 'smart' ? '（潛行）' : '（強攻）'}`);
  if (si && si.textContent !== sv) si.textContent = sv;
}
function heistStage(s, t = 0) {
  heist.st = s; heist.t = t; heist.warned = 0;
  if (s !== 'off' && s !== 'plan') { if (!heist.objSmall) heist.objSmall = $('obj').querySelector('small').innerHTML; $('obj').querySelector('small').innerHTML = `搶劫 <i>· 中央霓虹銀行${heist.how === 'smart' ? '（潛行）' : '（強攻）'}</i>`; }
  else if (heist.objSmall) { $('obj').querySelector('small').innerHTML = heist.objSmall; heist.objSmall = ''; setText('objText', QUEST[quest.n].text); }
  const o = $('obj'); o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
  gps.t = 0;
  squadHeist(s);   // 69-squads.js：逃出銀行時隊友跟上、上車後從車窗開火
}

// ─── 計畫板與各階段的互動 ───
ctxHooks.push((p, near) => {
  if (p.where === 'bank') {
    if (heist.st === 'drill' && !heist.drilling && near(VAULT.x, VAULT.z - 1, 1.8)) return { key: 'E', text: '安裝鋁熱鑽機', fn: drillStart };
    return null;
  }
  if (p.mode !== 'walk' || p.where !== 'out') return null;
  if (near(PLAN.x, PLAN.z, 2) && (heist.st === 'off' || heist.st === 'plan')) return { key: 'E', text: '看計畫板 <i>· 中央霓虹銀行</i>', fn: planBoard };
  if (heist.st === 'go' && near(BANK.x, BANK.z + 1, 2)) return { key: 'E', text: '開始搶劫 <i>· 中央霓虹銀行</i>', fn: bankEnter };
  if (heist.st === 'escape' && heist.car && !heist.car.dead && Math.hypot(p.x - heist.car.x, p.z - heist.car.z) < 3.4) return { key: 'F', text: '上逃亡車 <i>· 換 Kael 開</i>', fn: getawayEnter };
  return null;
});
function planBoard() {
  const who = 'Vance 的計畫板';
  if (W.stars) return dialog(who, '外面還有警察在找你，先處理掉再來。');
  if (SQ.def) return dialog(who, `${SQ.def.name}被盯上了，先去處理。`);
  dialog(who, `中央霓虹銀行，10 St。金庫裡的現金最多兩百五十萬。籌備費 ${money(HEIST_FEE)}，Zero 抽一成。\n潛行：壓住人質不讓警報響，出來只有 2 星，但上限兩百萬。\n強攻：炸門、守門口、5 星突圍，上限兩百五十萬。`, [
    { t: `潛行（${money(HEIST_FEE)}）`, fn: () => hireStart('smart') },   // 69-v3-heist.js：先挑駭客、車手、槍手
    { t: `強攻（${money(HEIST_FEE)}）`, fn: () => hireStart('loud') },
    { t: '再想想', fn: closeDialog },
  ]);
}
function planGo(how) {
  closeDialog();
  if (motors.cash < HEIST_FEE) { toast(`籌備費不夠，還差 ${money(HEIST_FEE - motors.cash)}`); return; }
  motors.cash -= HEIST_FEE; saveMotors();
  heist.how = how; heist.alarm = false; heist.loss = 0; heist.take = 0; heist.enfReady = false;
  spawnVan(); heistStage('setup');
  toast('前置：鑽機廂型車停在舊碼頭（地圖黃點）');
}
// 換人、進出銀行都走淡出；正在淡出（別的轉場）就稍後再試，期間計時暫停
function heistFade(fn) {
  if (heist.busy) return;
  heist.busy = true;
  const go = () => { if (fading) { setTimeout(go, 80); return; } transition(() => { heist.busy = false; fn(); }); };
  go();
}
function clearSpot(x, z, r) { for (const c of [...parked]) if (Math.hypot(c.x - x, c.z - z) < r) dropVehicle(detachCar(c)); }
function spawnVan() {
  if (heist.van && !heist.van.dead && vehicles.includes(heist.van)) return;
  clearSpot(VAN_AT.x, VAN_AT.z, 7);
  const v = heist.van = buildVeh('shvan', VAN_AT.x, VAN_AT.z, VAN_AT.yaw, 0, .37, 4, 'heist');   // PAL[3] 黑色
  v.name = '鑽機廂型車'; v.y = spawnY(v.x, v.z); heist.vanHot = false; poseVehicle(v);
}
function bankEnter() {
  if (W.stars) { toast('通緝中進不去：先甩掉警察'); return; }
  heistFade(() => {
    const s = crew.st[hW(0)]; Object.assign(s, bankAt(0, 1.4));
    crewLoad(hW(0));
    setWhere('bank');
    const sp = VENUES.bank.spawn; player.x = sp.x; player.z = sp.z; player.yaw = sp.yaw; camState.yaw = sp.yaw; camState.pitch = .12;
    arm.ammo.pistol.mag = ARMS.pistol.mag; equip('pistol', true);
    heist.intim = 100; heist.mag = arm.ammo.pistol.mag; vaultDoor.rotation.y = 0; vaultDoor.userData.open = 0;
    hostReset();
    const b = bank.boxes.find(o => o.door); b.x0 = -1.6; b.x1 = 1.6;
    heistStage('lobby', 15);
    toast('所有人趴下！');
  });
}
function blowVault() {
  heistStage('drill');
  vaultDoor.userData.open = 1;
  const b = bank.boxes.find(o => o.door); b.x0 = b.x1 = -99;
  sfx.boom(4); camState.shake = 1; life.flash = .6;
  if (heist.how === 'loud') heist.alarm = true;
  toast('金庫門炸開了');
}
function drillStart() {
  sfx.reload();
  if (heist.alarm) { holdStart(); return; }
  heist.t = Math.round(40 * hireK('drill')); heist.drilling = true; toast(`鑽機開始運作：${heist.t} 秒內別讓人質按警報`);   // 駭客決定鑽機時間（69-v3-heist.js）
}
// 強攻或響了警報：換成 Jax 到門口守 60 秒（4 星）
function holdStart() {
  const T0 = heist.holdT || 60;   // 69-heist2.js：破譯成功省下鑽機，只守 30 秒
  heist.drilling = true; heist.t = T0;
  heistFade(() => {
    const s = crew.st[hW(2)]; Object.assign(s, bankAt(2.5, 3));
    crewLoad(hW(2));
    heistGear(); equip('rifle', true);
    heist.t = T0; heistStage('drill', T0);
    heist.runOutT = 9; heist.leaks = 0; heist.breach = 0;
    wantedApi.set(4);
    toast(`警察包圍銀行了：${hName(2)} 守住門口 ${T0} 秒`);
  });
}
function heistGear() { for (const id of ARM_IDS) { const A = ARMS[id], a = arm.ammo[id]; if (A.gun) { a.mag = A.mag; a.res = A.res; } else if (A.throw) a.mag = A.n; } life.armor = 100; }
// 錢裝好了：換成背錢袋的 Vance 從正門出來
function escapeStart() {
  heistFade(() => {
    heist.drilling = false; heist.take = TAKE[heist.how];
    const s = crew.st[hW(0)]; Object.assign(s, bankAt(-1.5, 1.6));
    crewLoad(hW(0)); heistGear(); equip('smg', true);
    heist.car = getawayCar();   // 69-heist2.js：潛行是 Tiara GT，強攻是改裝過的鎮暴裝甲車（另在河濱停機坪放好武裝直升機）
    hireCar(heist.car);         // 69-v3-heist.js：車手決定逃亡車的極速與耐久
    heistStage('escape');
    heist.hpPrev = life.hp + life.armor;
    wantedApi.set(heist.alarm ? 5 : 2);
    toast(`贓款 ${money(heist.take)}：走到逃亡車（每受 10 點傷害掉 $15,000）`);
  });
}
function getawayEnter() {
  const v = heist.car;
  heistFade(() => {
    const s = crew.st[hW(1)]; s.x = v.x; s.z = v.z; s.yaw = v.yaw;
    crewLoad(hW(1)); enterVehicle(v);
    heist.amb = heist.air ? 0 : 3.5; heist.jumped = false; clearSpot(YARD.x, YARD.z, 8);   // 強攻改搭直升機，沒有戰車封路
    heistStage('drive');
    toast(heist.air ? 'Kael 開裝甲車：到灰鷺河濱的停機坪換武裝直升機' : 'Kael 開車：甩掉警察，開到鐵灣貨場的貨櫃安全屋');
  });
}
// 逃亡途中的封鎖：往貨場那條路上 70 m 外的路口橫兩台戰車；斷橋底下那條連接道路停四台警車。GPS 改指向斷橋
function heistAmbush() {
  heist.amb = -1;
  const v = player.veh || { x: pX(), z: pZ() }, R = routeTo(v.x, v.z, YARD.x, YARD.z);
  let node = null, prev = null;
  for (const [x, z] of R) {
    const n = rnNearest(x, z);
    if (Math.hypot(n.x - x, n.z - z) < 1 && Math.hypot(x - v.x, z - v.z) > 70 && Math.hypot(x - YARD.x, z - YARD.z) > 40) { node = n; break; }
    prev = [x, z];
  }
  if (node && prev) {
    const ix = prev[0] - node.x, iz = prev[1] - node.z, l = Math.hypot(ix, iz) || 1, hx = ix / l, hz = iz / l, across = Math.atan2(hx, hz) + Math.PI / 2;
    for (const s of [-1, 1]) {
      const u = spawnUnit('tank', { x: node.x + hx * (HR + 7) - hz * s * 3.4, z: node.z + hz * (HR + 7) + hx * s * 3.4, yaw: across + (s > 0 ? Math.PI : 0) });
      if (u) u.heist = 1;
    }
  }
  const e = BROKEN.road;
  for (const [o, side] of [[-7, 1], [-1, -1], [5, 1], [11, -1]]) {
    const [x, z, hx, hz] = edgeAt(e, e.len / 2 + o), u = spawnUnit(null, { x: x - hz * side * 2.6, z: z + hx * side * 2.6, yaw: Math.atan2(hx, hz) + side * .5 });
    if (u) { u.heist = 1; u.crew = 0; u.keep = 1; }   // 空車排成的封鎖線，人都在別處（不會下車、也不算視線）；斷橋離銀行遠，700 m 內不收
  }
  toast('兩台「鐵砧」戰車封住了往貨場的路口：GPS 改走鐵灣高架斷橋，用反射駕駛衝過去');
}
// 69-stunt.js 的 stuntLand：從斷橋飛下來（逃亡中第一次飛過那條路）就把眼前的警察甩在後面
function brokenLanded(v, dist, wreck) {
  if (heist.st !== 'drive' || heist.jumped || dist < 26) return;
  heist.jumped = true;
  if (W.stars > 3) { W.stars = 3; W.heat = Math.min(W.heat, 300); hudCache.wanted = ''; }
  if (W.stars) { W.seen = false; W.evade = 0; W.visT = 1.2; W.lkp = { x: BRIDGE_IN.x, z: BRIDGE_IN.z }; }
  toast(wreck ? '摔得很慘，但警察被甩在斷橋另一頭了' : '飛過去了！警察被擋在斷橋另一頭：甩掉剩下的通緝');
}
function heistFail(why) {
  heist.busy = false;
  for (const r of runSt) runnerOff(r);
  if (heist.car) { if (player.veh !== heist.car) heistVehGone(heist.car); heist.car = null; }   // 69-heist2.js：搶劫用的車不在 jacked 裡
  heist.drilling = false;
  heistStage('go');
  toast(`搶劫失敗（${why}）：回銀行門口再來一次`);
}
// 整個收掉（主線的搶案失敗或放棄：69-w3-ch4.js 從檢查點重來時重新擺好）
function heistAbort() {
  heist.busy = false;
  for (const r of runSt) runnerOff(r);
  hackClose();
  if (heist.car) { heistVehGone(heist.car); heist.car = null; }
  if (heist.enf) { heistVehGone(heist.enf); heist.enf = null; }
  if (heist.escCar) { heistVehGone(heist.escCar); heist.escCar = null; }
  enfDrop();
  heist.drilling = false; heist.alarm = false;
  if (heist.st !== 'off') heistStage('off');
}
function heistPass() {
  // 分紅：69-v3-heist.js 雇的三個人各自抽（沒雇過的舊流程是 Zero 一成）
  const take = heist.take, loss = Math.min(heist.loss, take), cuts = hireCuts(take - loss), cut = cuts.reduce((s, c) => s + c[1], 0), net = take - loss - cut;
  heist.passed = true; heistStage('off');
  for (const r of runSt) runnerOff(r);
  if (heist.car) { if (player.veh) exitVehicle(); if (heist.air) heistVehGone(heist.car); heist.car = null; }   // 強攻是坐直升機到的，裝甲車留在半路
  motors.cash += net; saveMotors();
  newsAdd(`中央霓虹銀行遭搶 ${money(take)}`, `蒙面搶匪炸開金庫${heist.jumped ? '，逃亡車飛越鐵灣高架斷橋' : ''}，警方至今仍未掌握去向。`);
  $('hpRows').innerHTML = [['總搶奪金額', money(take)], ['中彈耗損扣除', '−' + money(loss)], ...cuts.map(([n, c]) => [n, '−' + money(c)]), ['最終實得淨利', money(net)], [heist.who ? '兩位主角各得' : '三位主角各得', money(Math.floor(net / (heist.who ? 2 : 3)))]].map(([a, b]) => { const c = a === '最終實得淨利' ? ' class="net"' : ''; return `<dt${c}>${a}</dt><dd${c}>${b}</dd>`; }).join('');
  $('heistDone').querySelector('b').textContent = 'HEIST PASSED'; $('heistDone').querySelector('small').textContent = '中央霓虹銀行';   // 69-side.js 的 sideDone 也用這個畫面
  $('heistDone').classList.add('on'); heist.doneT = 7; sfx.ability(true);
  storyEv('heist', net);   // 69-w0-story.js：主線 4-5
}

// 99-main.js 的 onKey：G 引爆金庫門
function heistKey(code) {
  if (hackKey(code)) return true;   // 69-heist2.js：金庫電子鎖破譯
  if ($('heistDone').classList.contains('on')) { if (heist.doneT < 6) { $('heistDone').classList.remove('on'); } return true; }
  if (code === 'KeyG' && heist.st === 'c4' && player.where === 'bank') { blowVault(); return true; }
  return false;
}
$('heistDone').addEventListener('click', () => $('heistDone').classList.remove('on'));

function heistUpdate(dt) {
  if (heist.doneT > 0 && (heist.doneT -= slowmo.raw) <= 0) $('heistDone').classList.remove('on');
  if (heist.st === 'drive') { heist.ring ||= neonRing(0xffcc4d, 4.5); ringAt(heist.ring, YARD.x, YARD.z, 0, 1); }   // 貨櫃安全屋的黃圈（69-side.js）
  else if (heist.ring) heist.ring.visible = false;
  if (vaultDoor.userData.open && vaultDoor.rotation.y > -1.9) vaultDoor.rotation.y -= dt * 1.4;
  const s = heist.st;
  if (s === 'off' || s === 'plan' || heist.busy) return heistHud();
  if (life.dead && s !== 'setup' && s !== 'setupB') { heistFail(life.dead === 'busted' ? '被捕' : '陣亡'); return heistHud(); }
  heist2Update(dt);   // 69-heist2.js：前置 B、破譯、直升機逃亡
  if (s === 'setup') {
    const v = heist.van;
    if (!v || v.dead) { toast('鑽機廂型車毀了，換一台'); spawnVan(); }
    else if (player.veh === v) {
      if (!heist.vanHot) { heist.vanHot = true; wantedApi.set(2); toast('有人報警了：甩掉 2 星，再開回倉庫'); setTimeout(() => { if (heist.st === 'setup') gangChase('van'); }, 4000); }
      if (Math.hypot(v.x - SAFE.x, v.z - SAFE.z) < 7) {
        if (W.stars) { if (!heist.warned) { heist.warned = 1; toast('先甩掉警察，別把他們帶回倉庫'); } }
        else if (Math.hypot(v.vx, v.vz) < 3) { exitVehicle(); heistVehGone(v); heist.van = null; if (heist.how === 'loud' && !heist.enfReady) setupBStart(); else { heistStage('go'); toast('鑽機到手：去中央霓虹銀行'); } }   // 強攻還要前置 B（69-heist2.js）
      }
    }
  }
  // 大廳：威懾條（瞄準時回升、開槍大幅回升），人質依威懾程度趴下或站起來
  if (player.where === 'bank' && (s === 'lobby' || s === 'c4' || s === 'drill')) {
    const a = arm.ammo[arm.sel], mag = a ? a.mag : 0;
    if (a && mag < heist.mag && ARMS[arm.sel].gun) heist.intim += 35;
    heist.mag = mag;
    heist.intim = clamp(heist.intim + (gta.aiming ? 28 : HACK.on ? 0 : -7 * hireK('intim')) * dt, 0, 100);   // 破譯時 Kael 接手壓人質
    if (heist.intim <= 0) heistAlarm('有行員按下了桌底警報');
    hostStep(dt);
  }
  bankCrewStep();
  if (s === 'lobby' && (heist.t -= dt) <= 0) { heistStage('c4'); toast('Jax：C4 裝好了，按 G'); }
  if (s === 'drill' && heist.drilling && player.where === 'out') holdStep(dt);
  else for (const r of runSt) if (r.on && s !== 'escape') runnerOff(r);
  if (s === 'drill' && heist.drilling && (heist.t -= dt) <= 0) escapeStart();
  if (s === 'escape') {
    const hp = life.hp + life.armor;
    if (hp < heist.hpPrev) heist.loss += (heist.hpPrev - hp) * 1500;
    heist.hpPrev = hp;
    if (heist.car && heist.car.dead) { heist.car = null; heistFail('逃亡車毀了'); }
  }
  if (s === 'drive') {
    const v = player.veh;
    if (heist.amb > 0 && (heist.amb -= dt) <= 0) heistAmbush();
    if (player.mode !== 'drive' || !v) { /* 下車了：再上任何一台車都行 */ }
    else if (Math.hypot(v.x - YARD.x, v.z - YARD.z) < (v.fly ? 10 : 8) && !(v.fly && v.y - groundH(v.x, v.z) > 1.5)) {   // 直升機要降落在地上
      if (W.stars) { if (!heist.warned) { heist.warned = 1; toast('先甩掉警察，別把他們帶回倉庫'); } }
      else if (Math.hypot(v.vx, v.vz) < 4) heistPass();
    } else heist.warned = 0;
  }
  heistHud();
}

// 測試 API（window.__nc.gta.heist）
const heistApi = { heist, hostSt, runSt, hold: holdStep, BANK, PLAN, SAFE, YARD, BRIDGE_IN, BROKEN, VAN_AT, CAR_AT, ambush: heistAmbush, mark: heistMark, run: (k, kael = false) => { const h = hostSt[k]; h.st = 'run'; h.t = 0; h.c.r = 0; h.kael = kael; }, go: planGo, stage: heistStage, enter: bankEnter, blow: blowVault, drill: drillStart, escape: escapeStart, getaway: getawayEnter, pass: heistPass };
