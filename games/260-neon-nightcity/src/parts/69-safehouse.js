// ═══ 安全屋：冠石頂層公寓（loft17）、雲杉坡崖邊別墅（interior15），第三輪加上灰鷗島辦公室（loft18）、楓林里迷你閣樓（miniloft）、
// 琥珀工業區的和室 Loft（loft16）與公園大道的白色大宅（interior14），第四輪加上珊瑚灘的清水模公寓（living_room） ═══
// 在 69-market.js 的天際置業買下（ESTATES 裡 home 的幾筆），也可以走到門口直接買。買了才進得去；
// 裡面躺沙發「睡一覺」：時間推進 6 小時、補滿生命、存檔（存檔位置是門口）。島上辦公室另外有收入，在辦公桌收保險箱。
// 室內是 dasy444 的 Sketchfab 模型（前兩個 CC BY 4.0，第三輪四個與第四輪一個是 Standard），tools/props.mjs 輸出 apt_*，保留原檔座標（地板 y＝0）。
// 門預設在街區南面、朝 +z；face: -1 是朝 −z（島上辦公室的門朝北，對著跨海橋過來的路）。
// 以 http(s) 開啟時走近門口 70 m 內就先下載；以檔案開啟或下載失敗，用下面的程式建模房間（同一套碰撞框）。
// 第四輪另有兩間不用買的店（HANG_IDS，open）：舊碼頭的鏽錨酒館（pub）與中城的 BODEGA 夜貓便利店（store），走到門口就能進去，沒有睡覺與收入。
// 排在 69-police 之後、69-stunt 之前；ESTATES、quickSave、heist、W、life 等只在函式裡用。

ENV.loft = { lampOn: 0, wet: 0, fogDen: .006, fog: 0x0c0a16, fogHi: 0x1a1430, top: 0x5a5470, bot: 0x2a2630 };
ENV.villa = { lampOn: 0, wet: 0, fogDen: .012, fog: 0x0a0e16, fogHi: 0x141c2c, top: 0x5e5a56, bot: 0x2e2a26 };
ENV.office = { lampOn: 0, wet: 0, fogDen: .01, fog: 0x101418, fogHi: 0x1c2228, top: 0x8a8a86, bot: 0x4a4844 };
ENV.mini = { lampOn: 0, wet: 0, fogDen: .02, fog: 0x0e0c0a, fogHi: 0x1a1612, top: 0x5a5048, bot: 0x2a2420 };
ENV.l16 = { lampOn: 0, wet: 0, fogDen: .012, fog: 0x0c0a08, fogHi: 0x1a140e, top: 0x6a5840, bot: 0x2a2018 };
ENV.i14 = { lampOn: 0, wet: 0, fogDen: .01, fog: 0x12141a, fogHi: 0x1e222a, top: 0x9a968e, bot: 0x5a5650 };
ENV.lr = { lampOn: 0, wet: 0, fogDen: .016, fog: 0x0e0e10, fogHi: 0x1a1a1e, top: 0x7a7874, bot: 0x3a3836 };
ENV.pub = { lampOn: 0, wet: 0, fogDen: .018, fog: 0x0e0a06, fogHi: 0x1c140c, top: 0x6a5238, bot: 0x2a1e14 };
ENV.store = { lampOn: 0, wet: 0, fogDen: .008, fog: 0x14161a, fogHi: 0x22262c, top: 0xb0b4b8, bot: 0x6a6c70 };
const APT_IDS = ['loft', 'villa', 'office', 'mini', 'l16', 'i14', 'lr'];
const HANG_IDS = ['pub', 'store'], ROOM_IDS = [...APT_IDS, ...HANG_IDS];
const SNACK = 40;   // 便利店買吃的：補滿生命
const APT = {
  // 冠石金融區 (6,1) 街區的南面，門朝 8 St；地板 x −3.9…10、z −3.9…6，西面整片玻璃牆外是發光的摩天樓
  loft: { door: { x: avX(6) + 44, z: stZ(2) - HR - SW }, spawn: { x: 6.4, z: 5.1, yaw: Math.PI }, exit: { x: 6.4, z: 5.4 }, frame: { x: 6.4, z: 6.02, ry: 0 },
    nap: { x: .4, z: 1.7 }, name: '冠石頂層公寓', dist: '冠石金融區 · 8 St', ceil: 6.6,
    // 牆：西、東、北、南。原檔的東、南兩面是開著的（給 Sketchfab 取景），add 是模型版也要補上的牆
    walls: [[-4.5, -3.85, -4.5, 6.6], [9.95, 10.6, -4.5, 6.6], [-4.5, 10.6, -4.5, -3.85], [-4.5, 10.6, 6.05, 6.6]], add: [1, 3],
    solid: [[-3.1, 1.8, -2, 1.1], [-2.6, -1.1, 1.2, 6.25], [4, 6.9, -2.95, -1.6], [5.55, 8.45, -3.85, -3.05], [1.2, 2.75, -3.6, -2.95], [8.55, 9.2, -3.6, -2.95], [-3.65, -3, 2.1, 2.75]],
    round: [{ x: 3.18, z: -1, r: 1.35 }],   // 旋轉樓梯：上面的夾層相機天花板處理不了，不讓上去
    lights: [{ x: 3, y: 5.6, z: 1, col: lin(0xffd2a0), r: 13, i: 1.3 }, { x: -2.6, y: 2.6, z: 3.5, col: lin(0xa0b4ff), r: 8, i: .7 }, { x: 7.6, y: 2.8, z: -2.2, col: lin(0xffc890), r: 7, i: .8 }] },
  // 雲杉坡 (2,6) 街區的南面，門朝 13 St（j = 7，城市擴到 20×15 前是最南邊的街）；挑高客廳 x −3.9…21.7、z −5.3…6，南面玻璃外是露台與岩坡
  villa: { door: { x: avX(2) + 36, z: stZ(7) - HR - SW }, spawn: { x: -2.6, z: 2.4, yaw: Math.PI / 2 }, exit: { x: -3, z: 2.4 }, frame: { x: -3.83, z: 2.4, ry: Math.PI / 2 },
    nap: { x: 16.4, z: -1.3 }, name: '雲杉坡崖邊別墅', dist: '雲杉坡 · 13 St', ceil: 8.2,
    // 西面是原檔的實牆、南面是原檔的玻璃；東面開著要補；北面是廚房凹室前緣，模型版只留碰撞
    walls: [[-4.6, -3.85, -6, 6.7], [21.75, 22.5, -6, 6.7], [-4.6, 22.5, 6.05, 6.7], [-4.6, 22.5, -6, -5.3]], add: [1],
    solid: [[13.8, 19.3, -.5, 2.35], [14.9, 17, 1.65, 3.75]],
    round: [],
    lights: [{ x: 9, y: 7.4, z: 1.5, col: lin(0xffd8a8), r: 18, i: 1.6 }, { x: 16.5, y: 3.2, z: 1, col: lin(0xffc890), r: 9, i: 1.2 }, { x: 1, y: 3.4, z: -2.5, col: lin(0xffe0b8), r: 9, i: 1 }, { x: 9, y: 2.4, z: 7.5, col: lin(0x8ab4d8), r: 10, i: .6 }] },
  // 灰鷗島辦公園區（21-coast.js 的 ISLE_SITES.office）北面的門；室內 x −8…8.8、z −3.1…7.2，L 形，夾層下天花板 2.4 m
  office: { door: { x: BRIDGE_X + 8, z: ISLE.z0 + 133.4 }, face: -1, spawn: { x: 4.2, z: -2.3, yaw: 0 }, exit: { x: 4.2, z: -2.55 }, frame: { x: 4.2, z: -3.14, ry: 0 },
    nap: { x: -4.3, z: 5.5 }, desk: { x: -.5, z: 5.7 }, name: '灰鷗島辦公室', dist: '灰鷗島 · 辦公園區', ceil: 2.4, floor: 0xd8d4cc,
    walls: [[-8.7, -8.05, -3.7, 7.8], [8.75, 9.4, -3.7, 7.8], [-8.7, 9.4, -3.7, -3.12], [-8.7, 9.4, 7.22, 7.8]], add: [],
    solid: [[-5.9, -5.25, -3.12, .75], [6.15, 6.8, 3.1, 7.22], [6.15, 8.75, 3.1, 3.7], [-3.3, -1.05, -1, 2.25], [.45, 3.75, -.1, 3.2], [-.9, 2.85, -3.12, -1.75], [-1.7, 1.55, -2.6, -1.4],
      [0, .9, -1.3, -.5], [5.3, 8.1, -2.6, 0], [-4.3, -3.15, -2.6, -1.6], [-5.25, -4.25, -1.4, .65], [-8.05, -4.6, .75, 3.6], [-7.3, -4.8, 3.9, 7.22], [-2.8, -.95, 3.9, 7.22],
      [-1.8, 1.8, 6.5, 7.22], [.5, 4.15, 3.85, 4.35], [1, 2.1, 4.35, 5.85], [2.05, 2.85, 4.35, 7.22], [4.95, 6.15, 3.85, 4.35]],
    round: [{ x: -4.5, z: 2.6, r: .4 }, { x: -2.1, z: -2.1, r: .4 }, { x: -1.6, z: 3.4, r: .45 }, { x: -.6, z: 4.7, r: .45 }, { x: 3.3, z: 5.3, r: .45 }],
    lights: [{ x: -2, y: 2.2, z: .6, col: lin(0xffe2c0), r: 9, i: 1.1 }, { x: 2.2, y: 2.2, z: 1.5, col: lin(0xffe2c0), r: 9, i: 1.1 }, { x: 6.8, y: 2.2, z: -1.2, col: lin(0xffd8b0), r: 7, i: .9 },
      { x: -5.8, y: 2.2, z: 5.4, col: lin(0xffd0a0), r: 7, i: .9 }, { x: 1.2, y: 2.2, z: 5.6, col: lin(0xe8f0ff), r: 8, i: .9 }] },
  // 楓林里 (2,8) 街區的南面，門朝 15 St；原檔只是一個角落（西牆與北面的書架），東、南兩面要補牆
  mini: { door: { x: avX(2) + 36, z: stZ(9) - HR - SW }, spawn: { x: 2.2, z: 1.8, yaw: -Math.PI / 2 }, exit: { x: 2.45, z: 1.8 }, frame: { x: 2.93, z: 1.8, ry: Math.PI / 2 },
    nap: { x: -1.3, z: .25 }, name: '楓林里迷你閣樓', dist: '楓林里 · 15 St', ceil: 3.8, floor: 0x5a3e2c,
    walls: [[-3.7, -2.9, -3.2, 3.5], [2.95, 3.6, -3.2, 3.5], [-3.7, 3.6, -3.2, -2.6], [-3.7, 3.6, 2.95, 3.5]], add: [1, 3],
    solid: [[-2.9, -1.75, -2, .8], [-1.6, -.85, -1.5, -.2], [-.8, .65, -2.05, -.65], [-1.6, -.45, .55, 1.6]], round: [],
    lights: [{ x: -.5, y: 3.2, z: -.5, col: lin(0xffc890), r: 7, i: 1.1 }, { x: 1.8, y: 2.6, z: 2, col: lin(0xffd8b0), r: 5, i: .7 }] },
  // 琥珀工業區 (15,8) 街區的南面，門朝 15 St；和室風的 Loft，西、北兩面是一整排矮沙發，南面是架高的平台，東面開著要補牆
  l16: { door: { x: avX(15) + 36, z: stZ(9) - HR - SW }, spawn: { x: 6.6, z: 2, yaw: -Math.PI / 2 }, exit: { x: 6.9, z: 2 }, frame: { x: 7.42, z: 2, ry: Math.PI / 2 },
    nap: { x: -3.4, z: 2.8 }, name: '琥珀和室 Loft', dist: '琥珀工業區 · 15 St', ceil: 7.8, floor: 0x3a2c22,
    walls: [[-8.3, -7.45, -8.1, 7.1], [7.4, 8.1, -8.1, 7.1], [-8.3, 8.1, -8.1, -7.45], [-8.3, 8.1, 6.45, 7.1]], add: [1],
    solid: [[-7.45, -4, -5, 3.8], [-7.45, 2, -7.45, -5], [-2.9, .5, -3, 1.9], [-4.3, 6.7, 4.8, 6.45], [-7.45, -6.5, 4.7, 5.5]], round: [{ x: -5.4, z: 5.6, r: .6 }],
    lights: [{ x: 0, y: 6, z: 0, col: lin(0xffd09a), r: 16, i: 1.2 }, { x: -6.9, y: 1.2, z: 5.1, col: lin(0xffc070), r: 6, i: 1 }, { x: -2, y: 2.5, z: -6, col: lin(0xffc890), r: 9, i: .8 }] },
  // 公園大道 (12,7) 街區的南面，門朝 14 St；白色挑高大宅，西面的玻璃門當出入口
  i14: { door: { x: avX(12) + 36, z: stZ(8) - HR - SW }, spawn: { x: -2.3, z: 0, yaw: Math.PI / 2 }, exit: { x: -2.6, z: 0 }, frame: { x: -3.12, z: 0, ry: Math.PI / 2 },
    nap: { x: -1, z: 1.9 }, name: '公園大道白色大宅', dist: '公園大道 · 14 St', ceil: 4.7, floor: 0xe8e2d8,
    walls: [[-3.8, -3.1, -5.6, 6.7], [7.75, 8.4, -5.6, 6.7], [-3.8, 8.4, -5.6, -4.95], [-3.8, 8.4, 6.05, 6.7]], add: [3],
    solid: [[-1.85, .2, -4.6, -3.3], [-3.1, -2, -4.95, -2], [-1.9, -.25, -2.55, -1.15], [1.65, 2.75, -4.75, -1], [4.1, 7, -4, -1.7], [3, 4.25, -4.95, -4.2],
      [-2.65, 1.3, .75, 1.6], [.45, 1.3, 1.6, 4.75], [-1.45, -.3, 2.15, 3.3]],
    round: [{ x: 1.95, z: -1.95, r: .3 }, { x: 7.3, z: -1, r: .45 }, { x: -2.35, z: 4.55, r: .5 }],
    lights: [{ x: 2, y: 4.4, z: 0, col: lin(0xfff0dc), r: 14, i: 1.3 }, { x: -1, y: 3, z: 2.8, col: lin(0xffd8b0), r: 8, i: .9 }, { x: 5.5, y: 3, z: -2.8, col: lin(0xffd8b0), r: 8, i: .9 }] },
  // 珊瑚灘 (4,12) 街區的南面，門朝 19 St；清水模的小客廳（原檔放大 0.15 倍），西、北兩面是原檔的牆，東、南兩面開著要補，門在南牆東邊
  lr: { door: { x: avX(4) + 36, z: stZ(13) - HR - SW }, spawn: { x: 2.4, z: 1.9, yaw: Math.PI }, exit: { x: 2.4, z: 2.2 }, frame: { x: 2.4, z: 2.47, ry: 0 },
    nap: { x: .17, z: -1.9 }, name: '珊瑚灘清水模公寓', dist: '珊瑚灘 · 19 St', ceil: 3, floor: 0x6a6a68,
    walls: [[-2.7, -1.99, -3.6, 2.9], [3.26, 3.9, -3.6, 2.9], [-2.7, 3.9, -3.6, -2.96], [-2.7, 3.9, 2.49, 2.9]], add: [1, 3],
    solid: [[-1.13, 1.47, -2.42, -1.42], [-.29, .59, -1.15, -.3], [-1.99, -1.38, -1.38, .26], [1.51, 1.94, -1.08, .15], [-1.99, -1.8, .72, 1.66], [1.45, 3.26, -2.96, -2.43], [-.82, .87, 1.91, 2.2]],
    round: [{ x: 1.76, z: -1.82, r: .22 }, { x: -1.5, z: .53, r: .22 }],
    lights: [{ x: .3, y: 2.8, z: -.6, col: lin(0xffe0bc), r: 9, i: 1.1 }, { x: -1.5, y: 1.7, z: .5, col: lin(0xffc890), r: 5, i: .8 }, { x: 2.3, y: 2.5, z: 1.2, col: lin(0xffd8b0), r: 5, i: .6 }] },
  // 不用買的店：四面都補牆（貼在原檔的牆外，原檔有牆的那面看不到），門口是街區南面
  // 舊碼頭 (0,3) 街區的南面，門朝 10 St（倉庫鐵皮牆的小門，避開行道樹）；木造酒館（原檔放大 5 倍）x −4.3…4.3、z −5.5…2.7，北面中間是 U 形吧台，東北角內縮
  pub: { open: true, door: { x: avX(0) + 35.8, z: stZ(4) - HR - SW }, spawn: { x: -3.1, z: 1.7, yaw: Math.PI }, exit: { x: -3.1, z: 2 }, frame: { x: -3.1, z: 2.5, ry: 0 },
    bar: { x: -.5, z: -.9 }, name: '鏽錨酒館', dist: '舊碼頭 · 10 St', ceil: 3.2, floor: 0x5a4632,
    walls: [[-4.9, -4.3, -6, 3.3], [4.3, 4.9, -6, 3.3], [-4.9, 4.9, -6, -5.47], [-4.9, 4.9, 2.72, 3.3]], add: [0, 1, 2, 3],
    solid: [[-2.24, 1.16, -4.26, -1.37], [-2, 1.36, -5.47, -5.15], [1.43, 2.87, -5.47, -5.1], [2.55, 4.3, -5.47, -3.72], [-4.3, -3.95, -5.47, 2.72], [-4.2, -3.2, -5.47, -5.05],
      [2.72, 3, -1.46, .25], [-2.1, 2.1, 2.3, 2.72], [-3.96, -3.63, 1.25, 1.63], [3.14, 4.16, 2.26, 2.72], [2.37, 2.57, 1.8, 2.72]],
    round: [{ x: -1.26, z: 2.08, r: .8 }, { x: 1.13, z: 2.08, r: .8 }, { x: -2.56, z: -3.86, r: .22 }, { x: -2.56, z: -3.23, r: .22 }, { x: -2.56, z: -2.6, r: .22 }, { x: -2.56, z: -1.9, r: .22 }, { x: 1.54, z: -2.6, r: .22 }, { x: 1.54, z: -1.9, r: .22 }],
    lights: [{ x: -.5, y: 2.9, z: -2.8, col: lin(0xffc890), r: 9, i: 1.2 }, { x: 0, y: 2.7, z: 1.4, col: lin(0xffb070), r: 8, i: .9 }, { x: 3.5, y: 2.7, z: -.6, col: lin(0xffd0a0), r: 6, i: .7 }] },
  // 中城 (4,2) 街區的南面，門朝 9 St，開在 BODEGA 雜貨店的店面（招牌是 20-props.js 的 FASCIA 依地塊亂數挑的，街區改了要重新對位置）；便利商店（原檔是英寸，裁掉外面的停車場）x −5.35…5.86、z −6.3…6.4，原檔的自動門在西牆，結帳台橫在南邊
  store: { open: true, door: { x: avX(4) + 37.3, z: stZ(3) - HR - SW }, spawn: { x: -4.4, z: -3.7, yaw: Math.PI / 2 }, exit: { x: -4.8, z: -3.7 }, frame: { x: -5.33, z: -3.7, ry: Math.PI / 2 },
    till: { x: 1, z: 1.9 }, name: 'BODEGA 夜貓便利店', dist: '中城 · 9 St', ceil: 3.3, floor: 0xd0d0cc,
    walls: [[-5.95, -5.4, -6.9, 7], [6.08, 6.6, -6.9, 7], [-5.95, 6.6, -6.9, -6.37], [-5.95, 6.6, 6.49, 7]], add: [0, 1, 2, 3],
    solid: [[-2.88, 4.68, 2.3, 2.91], [4.26, 4.82, .03, 1.16], [-5.4, 5.86, -6.37, -6.1]],
    // 兩排斜放的貨架：沿中線排一串圓
    round: [[-2.47, -4.55, .73, -2.62], [-3.25, -3.2, 0, -1.21]].flatMap(([x0, z0, x1, z1]) => Array.from({ length: 9 }, (_, k) => ({ x: lerp(x0, x1, k / 8), z: lerp(z0, z1, k / 8), r: .42 }))),
    lights: [{ x: -1, y: 3.1, z: -3, col: lin(0xf0f4ff), r: 11, i: 1.3 }, { x: 1, y: 3.1, z: 3, col: lin(0xf0f4ff), r: 11, i: 1.2 }, { x: 4, y: 3, z: -2, col: lin(0xe8f0ff), r: 8, i: .8 }] },
};
const aptFace = id => APT[id].face || 1;
const aptOut = id => spotW({ x: APT[id].door.x, z: APT[id].door.z + 1.4 * aptFace(id), yaw: aptFace(id) > 0 ? 0 : Math.PI });   // 出門站的位置（世界座標）
const aptSet = id => 'apt_' + id;
for (const id of ROOM_IDS) {
  const a = APT[id], scn = new T.Scene(), data = { boxes: [], circles: [...a.round], lights: a.lights };
  for (const [x0, x1, z0, z1] of [...a.walls, ...a.solid]) data.boxes.push({ x0, x1, z0, z1 });
  // 程式建模的房間：地板、補上的牆、家具方塊。模型下載好之後只留補牆（原檔沒有的那兩面）
  const k = new Kit(), shell = new Kit();
  const [fx0, fx1, fz0, fz1] = [a.walls[0][1], a.walls[1][0], Math.min(a.walls[2][1], a.walls[3][1]), Math.max(a.walls[2][0], a.walls[3][0])];
  k.box((fx0 + fx1) / 2, -.05, (fz0 + fz1) / 2, fx1 - fx0, .1, fz1 - fz0, a.floor ?? (id === 'loft' ? 0x8a8072 : 0x9a9488), 10);
  k.box((fx0 + fx1) / 2, a.ceil + .05, (fz0 + fz1) / 2, fx1 - fx0, .1, fz1 - fz0, 0x1a1a1c, 2);
  a.walls.forEach(([x0, x1, z0, z1], i) => (a.add.includes(i) ? shell : k).box((x0 + x1) / 2, a.ceil / 2, (z0 + z1) / 2, x1 - x0, a.ceil, z1 - z0, 0x4a4c54, 2));
  for (const [x0, x1, z0, z1] of a.solid) k.box((x0 + x1) / 2, .4, (z0 + z1) / 2, x1 - x0, .8, z1 - z0, 0x5a4e44, 2);
  for (const c of a.round) k.cyl(c.x, a.ceil / 2, c.z, .12, .12, a.ceil, 8, 0x2a2a2a, 15);
  // 窗景：一片發光的城市剪影（只在程式建模版）
  if (id === 'loft') k.box(-3.8, 3, 1, .05, 6, 9.8, 0x3a4a8a, 11); else if (id === 'villa') k.box(9, 3.5, 6, 25, 7, .05, 0x2a3a5a, 11);
  const fb = new T.Mesh(k.build(), MAT.uber); scn.add(fb);
  // 出口的門板（兩種版本都要看得到）
  shell.box(a.frame.x, 1.15, a.frame.z, 1.2, 2.3, .06, 0x4a3a2a, 10, 0, a.frame.ry).box(a.frame.x, 2.38, a.frame.z, 1.4, .12, .1, 0xffd8a0, 11, 0, a.frame.ry);
  scn.add(new T.Mesh(shell.build(), MAT.uber));
  a.fb = fb; a.scn = scn; a.req = false;
  // door 是邏輯座標（擺門牌、互動提示的 near 會換算）；doorW、VENUES 的 door 與 out 是世界座標
  a.doorW = WP(a.door.x, a.door.z);
  VENUES[id] = { scene: scn, data, spawn: a.spawn, name: a.name, toast: a.name, dist: a.dist, ceil: a.ceil, door: a.doorW, out: aptOut(id) };
}
// 街上的門：發光門牌與門板（門在街區南面，朝 +z；face −1 的朝 −z）
{
  const k = new Kit(), SIGN = { loft: 0xd9b46a, villa: 0x8ad0c0, office: 0xe8ecf0, mini: 0xe8a060, l16: 0xffb070, i14: 0xf0e8d8, lr: 0xc8ccd0, pub: 0xff9a3a, store: 0x5ad8ff };
  for (const id of ROOM_IDS) {
    const { x, z } = APT[id].door, f = aptFace(id);
    k.box(x, 1.2, z - .1 * f, 1.6, 2.4, .2, 0x1c1a18, 10).box(x, 2.62, z - .05 * f, 1.9, .26, .1, SIGN[id], 11);
    if (id === 'office') colliders.push({ x0: x - 1, x1: x + 1, z0: z, z1: z + .3 });   // 島上的門前沒有人行道，門板本身要擋住
  }
  cityAddAny(new T.Mesh(k.build(), MAT.uber));   // 九扇門分在不同的區
}
// 下載室內模型，換掉程式建模的房間
function aptLoad(id) {
  const a = APT[id];
  if (a.req || !GLB_ON) return;
  a.req = true;
  loadProps(aptSet(id)).then(items => {
    if (!items || !items[id]) return;
    a.fb.visible = false;
    a.scn.add(propObject(items[id], 0, 0, 0));
  });
}
function aptUpdate() {
  if (!GLB_ON) return;
  const px = pX(), pz = pZ();
  for (const id of ROOM_IDS) if (!APT[id].req && Math.hypot(px - APT[id].doorW.x, pz - APT[id].doorW.z) < 70) aptLoad(id);
}
const aptEstate = id => ESTATES.find(e => e.id === id);
function aptEnter(id) {
  if (!glbDone.has('p:' + aptSet(id)) && GLB_ON) glbBatch.add('p:' + aptSet(id));
  aptLoad(id);
  // 不在家時的短租收入：進門後收下（earn 會跳入帳提示，晚一點才不會蓋掉場館名稱；島上辦公室是生意，照舊在辦公桌收）
  enterVenue(id, APT[id].desk || APT[id].open ? null : () => setTimeout(() => { if (player.where === id && estCollect(id)) sfx.pickup(); }, 1600));
}
function aptBuyAtDoor(id) {
  const e = aptEstate(id);
  dialog(`天際置業 · ${e.name}`, `${e.name}，${APT[id].dist}。買下之後可以進去睡覺存檔（時間推進 6 小時、補滿生命）${e.rate && !APT[id].desk ? `，不在家時短租出去，每遊戲小時 ${money(e.rate)}` : ''}。\n售價 ${money(e.price)}，你身上有 ${money(motors.cash)}。`, [
    { t: `買下（${money(e.price)}）`, fn: () => { closeDialog(); if (estBuy(id)) { sfx.pickup(); toast(`${e.name}現在是你的了`); } else toast(`現金不夠，還差 ${money(e.price - motors.cash)}`); } },
    { t: '再想想', fn: closeDialog },
  ]);
}
function aptNap() {
  const id = player.where, a = APT[id];
  // 和快速存檔同樣的條件：通緝中或搶劫中不能睡（不然等於免費補血）
  if (W.stars || heist.st !== 'off' && heist.st !== 'plan' || crew.sw || life.dead) { toast(W.stars ? '外面還有警察在找你，睡不著' : '現在不是睡覺的時候'); return; }
  transition(() => {
    clockSt.min = (clockSt.min + 360) % 1440;
    setWeather(wxPick(wxPick(wx.cur)), true);   // 28-sky.js：睡醒外面的天氣換過了
    life.hp = life.max;
    quickSave(aptOut(id));
    toast('睡了一覺：時間推進 6 小時，已存檔');
  });
}
function aptSnack() {
  if (life.hp >= life.max) { toast('你現在不餓'); return; }
  if (motors.cash < SNACK) { toast(`現金不夠，還差 ${money(SNACK - motors.cash)}`); return; }
  motors.cash -= SNACK; saveMotors(); life.hp = life.max; sfx.pickup(); toast('買了飯糰和熱咖啡，生命補滿');
}
ctxHooks.push((p, near) => {
  if (p.mode !== 'walk') return null;
  if (p.where === 'out') {
    for (const id of ROOM_IDS) {
      const d = APT[id].door;
      if (!near(d.x, d.z + .8 * aptFace(id), 1.8)) continue;
      return APT[id].open || estOwned(id) ? { key: 'E', text: `進入${APT[id].name}`, fn: () => aptEnter(id) }
        : { key: 'E', text: `看房 <i>· ${APT[id].name} ${money(aptEstate(id).price)}</i>`, fn: () => aptBuyAtDoor(id) };
    }
    return null;
  }
  const a = APT[p.where];
  if (!a) return null;
  if (near(a.exit.x, a.exit.z, 1.5)) return { key: 'E', text: '回到街上', fn: exitVenue };
  if (a.till && near(a.till.x, a.till.z, 1.6)) return { key: 'E', text: `買點吃的 <i>· ${money(SNACK)} 補滿生命</i>`, fn: aptSnack };
  if (a.bar && near(a.bar.x, a.bar.z, 1.6)) return { key: 'E', text: '點一杯', fn: () => toast(W.stars ? '酒保瞄了一眼窗外的警燈，假裝沒看到你' : '酒保推來一杯黑啤酒，記在你的帳上') };
  if (a.open) return null;
  if (near(a.nap.x, a.nap.z, 2)) return { key: 'E', text: '睡一覺 <i>· 推進 6 小時並存檔</i>', fn: aptNap };
  if (a.desk && near(a.desk.x, a.desk.z, 1.6)) {   // 島上辦公室：辦公桌收保險箱
    const n = Math.floor(motors.props.safe[p.where] || 0);
    return { key: 'E', text: `收取保險箱 <i>· ${money(n)}</i>`, fn: () => { const got = estCollect(p.where); toast(got ? `收了 ${money(got)}` : '保險箱是空的'); if (got) sfx.pickup(); } };
  }
  return null;
});

// 測試 API（window.__nc.gta.apt）
const aptApi = { APT, load: aptLoad, enter: aptEnter, nap: aptNap, out: aptOut };
