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
  loft: { door: APT_DOORS.loft, spawn: { x: 6.4, z: 5.1, yaw: Math.PI }, exit: { x: 6.4, z: 5.4 }, frame: { x: 6.4, z: 6.02, ry: 0 },
    robe: { x: 2.95, z: 5.75, ry: 0 }, nap: { x: .4, z: 1.7 }, name: '冠石頂層公寓', dist: '冠石金融區 · 8 St', ceil: 6.6,
    // 牆：西、東、北、南。原檔的東、南兩面是開著的（給 Sketchfab 取景），add 是模型版也要補上的牆
    walls: [[-4.5, -3.85, -4.5, 6.6], [9.95, 10.6, -4.5, 6.6], [-4.5, 10.6, -4.5, -3.85], [-4.5, 10.6, 6.05, 6.6]], add: [1, 3],
    solid: [[-3.1, 1.8, -2, 1.1], [-2.6, -1.1, 1.2, 6.25], [4, 6.9, -2.95, -1.6], [5.55, 8.45, -3.85, -3.05], [1.2, 2.75, -3.6, -2.95], [8.55, 9.2, -3.6, -2.95], [-3.65, -3, 2.1, 2.75]],
    round: [{ x: 3.18, z: -1, r: 1.35 }],   // 旋轉樓梯：一樓不能穿過，按 E 沿著踏階繞一圈上夾層
    // 夾層（地板 3.85 m）：北面那間比一樓的北牆還深，有弧形沙發、斜放的床與西北角的弧形欄杆
    under: [[-3.9, 3.25, -3.9, -1.75, 3.6]],   // 一樓在夾層下面的天花板（相機）
    up: { y: 3.85, ceil: 6.6, rects: [[-3.85, 3.2, -7.65, -1.82]],
      boxes: [[-2.25, 2.4, -7.65, -5.45], [-3.9, -3.2, -7.7, -4.4], [-3.2, -2.4, -7.7, -6]],
      round: [{ x: -2.95, z: -2.55, r: .5 }, { x: -2.45, z: -3.3, r: .5 }, { x: -1.85, z: -4.1, r: .5 }, { x: -1.45, z: -4.6, r: .45 }],
      // 踏階從北面（−130°）起步、順時針繞一圈，最上面一階在起步點的正上方，往北跨上夾層
      path: [[2.12, 0, -2.23], ...aptHelix(3.15, -1, .78, -130, 230, 0, 3.85, 24), [2.45, 3.85, -2.35]] },
    lights: [{ x: 3, y: 5.6, z: 1, col: lin(0xffd2a0), r: 13, i: 1.3 }, { x: -2.6, y: 2.6, z: 3.5, col: lin(0xa0b4ff), r: 8, i: .7 }, { x: 7.6, y: 2.8, z: -2.2, col: lin(0xffc890), r: 7, i: .8 },
      { x: 0, y: 6.3, z: -4.8, col: lin(0xffd8b0), r: 10, i: 1.1 }] },   // 最後一盞照夾層
  // 雲杉坡 (2,6) 街區的南面，門朝 13 St（j = 7，城市擴到 20×15 前是最南邊的街）；挑高客廳 x −3.9…21.7、z −1…6（北半部與廚房上面是 4.1 m 的樓板），
  // 西面原檔的門洞（z −4.6…−2.95）通到西側翼（餐廳與 L 形沙發，x −23.1…−4.1），北面是廚房，南面落地窗拉開一扇（cut）通到露台
  villa: { door: APT_DOORS.villa, spawn: { x: -2.6, z: 2.4, yaw: Math.PI / 2 }, exit: { x: -3, z: 2.4 }, frame: { x: -3.83, z: 2.4, ry: Math.PI / 2 },
    robe: { x: -3.6, z: -.95, ry: Math.PI / 2 }, nap: { x: 16.4, z: -1.3 }, name: '雲杉坡崖邊別墅', dist: '雲杉坡 · 13 St', ceil: 8.2,
    // 外圈：側翼西牆、東面（原檔開著要補）、北牆、露台外緣（原檔是岩坡，只留碰撞）；碰撞框照原檔量（俯視 0.15 m 格子）
    walls: [[-23.7, -23.1, -12.6, 10.4], [21.75, 22.5, -12.6, 10.4], [-23.7, 22.5, -12.6, -12.05], [-23.7, 22.5, 9.95, 10.4]], add: [1],
    solid: [[13.8, 19.3, -.5, 2.35], [14.9, 17, 1.65, 3.75],
      // 客廳西牆（門洞兩側）、西北角的壁爐柱、南面的落地窗（12.0…15.8 拉開）
      [-4.25, -3.85, -7.2, -4.6], [-4.25, -3.85, -2.95, 6.1], [-5.7, -3.6, -12.6, -7], [-4.25, 12, 5.88, 6.12], [15.8, 22.5, 5.88, 6.12],
      // 側翼：南面玻璃外是岩坡、長餐桌、L 形沙發
      [-23.7, -4.25, -1.15, 6.1], [-23.7, -7.4, 6.1, 10.4], [-15.5, -7.6, -8.7, -4.9], [-22.2, -20.1, -6.9, -2.5], [-21.3, -18.9, -7.15, -5.8],
      // 廚房：後面的長流理台、L 形的短邊、中島與高腳椅
      [3.2, 22.4, -9.4, -8.8], [4, 4.4, -8.8, -5.2], [5.4, 14.2, -7.4, -5.6],
      // 露台：三組桌椅
      [-2.2, 2.6, 6.12, 7.7], [6.2, 11, 6.12, 7.7], [14.4, 19.2, 6.12, 7.7]],
    round: [],
    // 天花板（相機）：客廳北半部與廚房、露台的雨遮是 4.1 m 的樓板，側翼 4.9 m
    under: [[-5.3, 21.8, -9.7, -.97, 3.95], [-4.1, 22.5, 5.65, 10.4, 3.95], [-23.7, -4.3, -12.6, -.4, 4.7]],
    cut: [12.02, 15.78, 5.8, 6.25],   // 落地窗拉開的那一扇：這塊玻璃不畫，框滑到隔壁那扇後面
    lights: [{ x: 9, y: 7.4, z: 1.5, col: lin(0xffd8a8), r: 18, i: 1.6 }, { x: 16.5, y: 3.2, z: 1, col: lin(0xffc890), r: 9, i: 1.2 }, { x: 1, y: 3.4, z: -2.5, col: lin(0xffe0b8), r: 9, i: 1 }, { x: 9, y: 2.4, z: 7.5, col: lin(0x8ab4d8), r: 10, i: .6 },
      { x: -11.5, y: 4.2, z: -6.5, col: lin(0xffd2a0), r: 13, i: 1.2 }, { x: 9, y: 3.7, z: -8, col: lin(0xfff0dc), r: 12, i: 1 }, { x: 13.9, y: 3.6, z: 8.4, col: lin(0xffc890), r: 9, i: .8 }] },
  // 灰鷗島辦公園區（21-coast.js 的 ISLE_SITES.office）北面的門；室內 x −8…8.8、z −3.1…7.2，L 形，夾層下天花板 2.4 m
  office: { door: { x: BRIDGE_X + 8, z: ISLE.z0 + 133.4 }, face: -1, spawn: { x: 4.2, z: -2.3, yaw: 0 }, exit: { x: 4.2, z: -2.55 }, frame: { x: 4.2, z: -3.14, ry: 0 },
    robe: { x: 4.15, z: 6.88, ry: 0 }, nap: { x: -4.3, z: 5.5 }, desk: { x: -.5, z: 5.7 }, name: '灰鷗島辦公室', dist: '灰鷗島 · 辦公園區', ceil: 4.75, floor: 0xd8d4cc,
    under: [[-8.1, -1.53, -3.2, 2.45, 2.4], [-8.1, 8.8, 2.45, 7.3, 2.4], [-8.1, -4.73, .85, 3.45, 2.4]],   // 夾層下面
    // L 形夾層（地板 2.6 m）：西邊一條、北邊一排辦公桌與圓桌；西牆邊的白色小間當電梯（走進去、淡出淡入、從夾層那側走出來）
    up: { y: 2.6, ceil: 4.75, lift: true, rects: [[-4.73, -1.53, -2.65, 2.45], [-4.73, 5.87, 2.45, 7.15]],
      boxes: [[-3.35, -.6, 3.7, 7.15], [-3.65, -3.35, 4.2, 5.2], [-4.7, -3.55, 5.4, 6.55], [1.05, 2.7, 3.7, 7.1], [3.05, 5.3, 4.3, 6.7], [1.05, 5.7, 3.7, 4.15], [-4.55, -3.5, -2.6, -.9], [-4.55, -3.5, -.3, 1.3], [-2.65, -1.7, -.7, 1]],
      round: [], path: [[-3.9, 0, 2], [-4.4, 0, 2], 'fade', [-5.7, 2.6, 2], [-3.75, 2.6, 2]] },
    walls: [[-8.7, -8.05, -3.7, 7.8], [8.75, 9.4, -3.7, 7.8], [-8.7, 9.4, -3.7, -3.12], [-8.7, 9.4, 7.22, 7.8]], add: [],
    solid: [[-5.9, -5.25, -3.12, .75], [6.15, 6.8, 3.1, 7.22], [6.15, 8.75, 3.1, 3.7], [-3.3, -1.05, -1, 2.25], [.45, 3.75, -.1, 3.2], [-.9, 2.85, -3.12, -1.75], [-1.7, 1.55, -2.6, -1.4],
      [0, .9, -1.3, -.5], [5.3, 8.1, -2.6, 0], [-4.3, -3.15, -2.6, -1.6], [-5.25, -4.25, -1.4, .65], [-8.05, -4.6, .75, 3.6], [-7.3, -4.8, 3.9, 7.22], [-2.8, -.95, 3.9, 7.22],
      [-1.8, 1.8, 6.5, 7.22], [.5, 4.15, 3.85, 4.35], [1, 2.1, 4.35, 5.85], [2.05, 2.85, 4.35, 7.22], [4.95, 6.15, 3.85, 4.35]],
    round: [{ x: -4.5, z: 2.6, r: .4 }, { x: -2.1, z: -2.1, r: .4 }, { x: -1.6, z: 3.4, r: .45 }, { x: -.6, z: 4.7, r: .45 }, { x: 3.3, z: 5.3, r: .45 }],
    lights: [{ x: -2, y: 2.2, z: .6, col: lin(0xffe2c0), r: 9, i: 1.1 }, { x: 2.2, y: 2.2, z: 1.5, col: lin(0xffe2c0), r: 9, i: 1.1 }, { x: 6.8, y: 2.2, z: -1.2, col: lin(0xffd8b0), r: 7, i: .9 },
      { x: -5.8, y: 2.2, z: 5.4, col: lin(0xffd0a0), r: 7, i: .9 }, { x: 1.2, y: 2.2, z: 5.6, col: lin(0xe8f0ff), r: 8, i: .9 }] },
  // 楓林里 (2,8) 街區的南面，門朝 15 St；原檔只是一個角落（西牆與北面的書架），東、南兩面要補牆
  mini: { door: APT_DOORS.mini, spawn: { x: 2.2, z: 1.8, yaw: -Math.PI / 2 }, exit: { x: 2.45, z: 1.8 }, frame: { x: 2.93, z: 1.8, ry: Math.PI / 2 },
    robe: { x: 2.6, z: -1.7, ry: Math.PI / 2 }, nap: { x: -1.3, z: .25 }, name: '楓林里迷你閣樓', dist: '楓林里 · 15 St', ceil: 3.8, floor: 0x5a3e2c,
    walls: [[-3.7, -2.9, -3.2, 3.5], [2.95, 3.6, -3.2, 3.5], [-3.7, 3.6, -3.2, -2.6], [-3.7, 3.6, 2.95, 3.5]], add: [1, 3],
    solid: [[-2.9, -1.75, -2, .8], [-1.6, -.85, -1.5, -.2], [-.8, .65, -2.05, -.65], [-1.6, -.45, .55, 1.6]], round: [],
    lights: [{ x: -.5, y: 3.2, z: -.5, col: lin(0xffc890), r: 7, i: 1.1 }, { x: 1.8, y: 2.6, z: 2, col: lin(0xffd8b0), r: 5, i: .7 }] },
  // 琥珀工業區 (15,8) 街區的南面，門朝 15 St；和室風的 Loft，西、北兩面是一整排矮沙發，南面是架高的平台，東面開著要補牆
  l16: { door: APT_DOORS.l16, spawn: { x: 6.6, z: 2, yaw: -Math.PI / 2 }, exit: { x: 6.9, z: 2 }, frame: { x: 7.42, z: 2, ry: Math.PI / 2 },
    robe: { x: 7.05, z: -1.45, ry: Math.PI / 2 }, nap: { x: -3.4, z: 2.8 }, name: '琥珀和室 Loft', dist: '琥珀工業區 · 15 St', ceil: 7.8, floor: 0x3a2c22,
    walls: [[-8.3, -7.45, -8.1, 7.1], [7.4, 8.1, -8.1, 7.1], [-8.3, 8.1, -8.1, -7.45], [-8.3, 8.1, 6.45, 7.1]], add: [1],
    solid: [[-7.45, -4, -5, 3.8], [-7.45, 2, -7.45, -5], [-2.9, .5, -3, 1.9], [-4.3, 6.7, 4.8, 6.45], [-7.45, -6.5, 4.7, 5.5]], round: [{ x: -5.4, z: 5.6, r: .6 }],
    lights: [{ x: 0, y: 6, z: 0, col: lin(0xffd09a), r: 16, i: 1.2 }, { x: -6.9, y: 1.2, z: 5.1, col: lin(0xffc070), r: 6, i: 1 }, { x: -2, y: 2.5, z: -6, col: lin(0xffc890), r: 9, i: .8 }] },
  // 公園大道 (12,7) 街區的南面，門朝 14 St；白色挑高大宅，西面的玻璃門當出入口
  i14: { door: APT_DOORS.i14, spawn: { x: -2.3, z: 0, yaw: Math.PI / 2 }, exit: { x: -2.6, z: 0 }, frame: { x: -3.12, z: 0, ry: Math.PI / 2 },
    robe: { x: -2.8, z: 3.25, ry: Math.PI / 2 }, nap: { x: -1, z: 1.9 }, name: '公園大道白色大宅', dist: '公園大道 · 14 St', ceil: 4.7, floor: 0xe8e2d8,
    walls: [[-3.8, -3.1, -5.6, 6.7], [7.75, 8.4, -5.6, 6.7], [-3.8, 8.4, -5.6, -4.95], [-3.8, 8.4, 6.05, 6.7]], add: [3],
    solid: [[-1.85, .2, -4.6, -3.3], [-3.1, -2, -4.95, -2], [-1.9, -.25, -2.55, -1.15], [1.65, 2.75, -4.75, -1], [4.1, 7, -4, -1.7], [3, 4.25, -4.95, -4.2],
      [-2.65, 1.3, .75, 1.6], [.45, 1.3, 1.6, 4.75], [-1.45, -.3, 2.15, 3.3]],
    round: [{ x: 1.95, z: -1.95, r: .3 }, { x: 7.3, z: -1, r: .45 }, { x: -2.35, z: 4.55, r: .5 }],
    lights: [{ x: 2, y: 4.4, z: 0, col: lin(0xfff0dc), r: 14, i: 1.3 }, { x: -1, y: 3, z: 2.8, col: lin(0xffd8b0), r: 8, i: .9 }, { x: 5.5, y: 3, z: -2.8, col: lin(0xffd8b0), r: 8, i: .9 }] },
  // 珊瑚灘 (4,12) 街區的南面，門朝 19 St；清水模的小客廳（原檔放大 0.15 倍），西、北兩面是原檔的牆，東、南兩面開著要補，門在南牆東邊
  lr: { door: APT_DOORS.lr, spawn: { x: 2.4, z: 1.9, yaw: Math.PI }, exit: { x: 2.4, z: 2.2 }, frame: { x: 2.4, z: 2.47, ry: 0 },
    robe: { x: 3, z: .3, ry: Math.PI / 2 }, nap: { x: .17, z: -1.9 }, name: '珊瑚灘清水模公寓', dist: '珊瑚灘 · 19 St', ceil: 3, floor: 0x6a6a68,
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
// 旋轉樓梯的路徑：圓心 (cx, cz)、半徑 r，角度 a0→a1（度，x 軸往 z 軸轉）、高度 y0→y1，分 n 段
function aptHelix(cx, cz, r, a0, a1, y0, y1, n) {
  return Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + Math.cos(a) * r, y0 + (y1 - y0) * i / n, cz + Math.sin(a) * r]; });
}
// ─── 換裝（原始規格：安全屋可以更換服裝外觀）───
// 三位主角各四套，第一套是原本的樣子；只換衣服、鞋子、帽子與鞋子的霓虹飾條，膚色與髮色不變。選擇存在 localStorage 的 nc260.outfit（不進存檔）
const OUTFITS = {
  vance: [{ name: '深藍西裝' }, { name: '炭灰長風衣', look: { top: 0x2e2e30, bot: 0x1a1a1c, coat: 1, glow: 0xd8dcff, glowI: .6 } },
    { name: '白襯衫捲袖', look: { top: 0xd8d6d0, bot: 0x1a1c22, coat: 0, shoe: 0x1e1c1a } }, { name: '黑色戰術背心', look: { top: 0x23262a, bot: 0x2f3a2a, coat: 1, shoe: 0x141416, glow: 0x7af0ff, glowI: 1.4 } }],
  kael: [{ name: '舊皮衣' }, { name: '橘紅賽車服', look: { top: 0xb8402a, bot: 0xb8402a, coat: 1, shoe: 0x141416, glow: 0xffae57, glowI: 1.8 } },
    { name: '霓虹帽T', look: { top: 0x1f2f45, bot: 0x101012, coat: 1, hat: 1, glow: 0x2cf2d8, glowI: 1.8 } }, { name: '白T牛仔褲', look: { top: 0xe0ddd5, bot: 0x2f3a4a, coat: 0, shoe: 0xb8b6b0, glowI: 0 } }],
  jax: [{ name: '軍綠工作服' }, { name: '沙色迷彩長袖', look: { top: 0x6a6046, bot: 0x4a4434, coat: 1, hat: 1 } },
    { name: '黑背心', look: { top: 0x111215, bot: 0x2a2d35, coat: 0, hat: 0, glow: 0xff3fa0, glowI: 1.2 } }, { name: '橘色工裝連身服', look: { top: 0xc0662a, bot: 0xc0662a, coat: 1, hat: 0, shoe: 0x2a2420 } }],
  rosa: [{ name: '背心工裝褲' }, { name: '黑色連帽外套', look: { top: 0x15161a, bot: 0x1d1f24, coat: 1, glow: 0xff6f91, glowI: 1.2 } },
    { name: '擂台短褲', look: { top: 0xc8304a, bot: 0x111215, coat: 0, shoe: 0xe8e4dc } }, { name: '派對小洋裝', look: { top: 0x6a1630, bot: 0x6a1630, skirt: 1, coat: 0, shoe: 0x111111, glow: 0xff9ec0, glowI: 1.4 } }],
  dane: [{ name: '舊軍綠T恤' }, { name: '船廠工作服', look: { top: 0x3c5466, bot: 0x3c5466, coat: 1, shoe: 0x2a2420 } },
    { name: '花襯衫', look: { top: 0x2f8f8a, bot: 0xb8ab90, coat: 0, glow: 0xffd27a, glowI: .8 } }, { name: '黑色防風外套', look: { top: 0x121417, bot: 0x22252b, coat: 1, hat: 1, glow: 0xf2c14e, glowI: 1.2 } }],
};
// 掃描人物造型（40-people.js 的 scanGet，只在 http(s) 下載；以檔案開啟時清單裡不列）：每位主角都能換，凱爾在 http(s) 下預設穿 Jason
const SCAN_LOOKS = [{ name: 'Jason 造型', scan: 'jason', look: { scan: 'jason', female: false } },
  { name: 'Lucia 造型', scan: 'lucia', look: { scan: 'lucia', female: true, longHair: 1 } }];
for (const id in OUTFITS) OUTFITS[id].push(...SCAN_LOOKS);
const outfitOk = o => !o.scan || GLB_ON;
const outfitOf = c => outfit[c.id] ?? (c.id === 'kael' && GLB_ON ? OUTFITS.kael.findIndex(o => o.scan === 'jason') : 0);
const ROBE_COLS = [0x2e2e30, 0xb8402a, 0xd8d6d0, 0x1f2f45, 0x6a6046];
const OUTFIT_KEY = 'nc260.outfit', CREW_LOOK0 = CREW.map(c => ({ ...c.look }));
const outfit = (() => { try { const o = JSON.parse(localStorage.getItem(OUTFIT_KEY)); if (o && typeof o === 'object') return o; } catch {} return {}; })();
// 第 i 位主角換上第 k 套：顏色是 sRGB 十六進位，換成線性值再蓋在原本的外觀上
function outfitApply(i, k, save) {
  const c = CREW[i], O = OUTFITS[c.id];
  k = clamp(Math.floor(+k) || 0, 0, O.length - 1);
  if (!outfitOk(O[k])) k = 0;
  const l = { ...O[k].look };
  for (const key of ['top', 'bot', 'shoe', 'glow']) if (l[key] !== undefined) l[key] = lin(l[key]);
  c.look = { ...CREW_LOOK0[i], ...l };
  outfit[c.id] = k;
  if (save) try { localStorage.setItem(OUTFIT_KEY, JSON.stringify(outfit)); } catch {}
  if (i === crew.cur) me.look(0, { r: rng(9), ...c.look });
  crewLook();
}
CREW.forEach((c, i) => { const k = outfitOf(c), had = c.id in outfit; outfitApply(i, k); if (!had) delete outfit[c.id]; });
function aptRobe() {
  const i = crew.cur, c = CREW[i], O = OUTFITS[c.id], cur = outfitOf(c);
  dialog(`衣架 · ${c.name}`, `${c.name} 的衣服都掛在這裡（每間安全屋的衣架掛的是同一批）。現在穿的是「${O[cur].name}」。`, [
    ...O.flatMap((o, k) => outfitOk(o) ? [{ t: k === cur ? `${o.name}（現在穿的）` : o.name, fn: () => { closeDialog(); if (k !== cur) { outfitApply(i, k, true); toast(`${c.name} 換上${o.name}`); } } }] : []),
    { t: '算了', fn: closeDialog },
  ]);
}
const aptFace = id => APT[id].face || 1;
const aptOut = id => spotW({ x: APT[id].door.x, z: APT[id].door.z + 1.4 * aptFace(id), yaw: aptFace(id) > 0 ? 0 : Math.PI });   // 出門站的位置（世界座標）
const aptSet = id => 'apt_' + id;
for (const id of ROOM_IDS) {
  const a = APT[id], scn = new T.Scene(), data = { boxes: [], circles: [...a.round], lights: a.lights };
  for (const [x0, x1, z0, z1] of [...a.walls, ...a.solid]) data.boxes.push({ x0, x1, z0, z1 });
  // 程式建模的房間：地板、補上的牆、家具方塊。模型下載好之後只留補牆（原檔沒有的那兩面）
  const k = new Kit(), shell = new Kit();
  const [fx0, fx1, fz0, fz1] = [a.walls[0][1], a.walls[1][0], Math.min(a.walls[2][3], a.walls[3][3]), Math.max(a.walls[2][2], a.walls[3][2])];
  k.box((fx0 + fx1) / 2, -.05, (fz0 + fz1) / 2, fx1 - fx0, .1, fz1 - fz0, a.floor ?? (id === 'loft' ? 0x8a8072 : 0x9a9488), 10);
  k.box((fx0 + fx1) / 2, a.ceil + .05, (fz0 + fz1) / 2, fx1 - fx0, .1, fz1 - fz0, 0x1a1a1c, 2);
  a.walls.forEach(([x0, x1, z0, z1], i) => (a.add.includes(i) ? shell : k).box((x0 + x1) / 2, a.ceil / 2, (z0 + z1) / 2, x1 - x0, a.ceil, z1 - z0, 0x4a4c54, 2));
  for (const [x0, x1, z0, z1] of a.solid) k.box((x0 + x1) / 2, .4, (z0 + z1) / 2, x1 - x0, .8, z1 - z0, 0x5a4e44, 2);
  for (const c of a.round) k.cyl(c.x, a.ceil / 2, c.z, .12, .12, a.ceil, 8, 0x2a2a2a, 15);
  if (a.up) {   // 第二層的樓板、欄杆與踏階（電梯是一個箱子）
    const y = a.up.y;
    for (const [x0, x1, z0, z1] of a.up.rects) k.box((x0 + x1) / 2, y - .12, (z0 + z1) / 2, x1 - x0, .24, z1 - z0, 0x6a625a, 10);
    if (a.up.lift) { const [lx, , lz] = a.up.path[1]; k.box(lx, y / 2, lz, 1.6, y, 1.6, 0x3a3c42, 15); }
    else for (const P of a.up.path.slice(1, -1)) if (P[1] > .05) k.box(P[0], P[1] - .06, P[2], .8, .12, .5, 0x6a625a, 10);
  }
  // 窗景：一片發光的城市剪影（只在程式建模版）
  if (id === 'loft') k.box(-3.8, 3, 1, .05, 6, 9.8, 0x3a4a8a, 11); else if (id === 'villa') k.box(3.9, 3.5, 6, 16.2, 7, .05, 0x2a3a5a, 11).box(19.1, 3.5, 6, 6.6, 7, .05, 0x2a3a5a, 11);
  const fb = new T.Mesh(k.build(), MAT.uber); scn.add(fb);
  // 出口的門板（兩種版本都要看得到）
  if (a.cut) {   // 拉開的落地窗：框滑到隔壁那扇的內側
    const [cx0, cx1, cz0] = a.cut, w = cx1 - cx0, x = cx0 - w / 2 + .1, z = cz0 - .02;
    shell.box(x - w / 2, 1.3, z, .06, 2.6, .06, 0x2a2c30, 15).box(x + w / 2, 1.3, z, .06, 2.6, .06, 0x2a2c30, 15).box(x, 2.6, z, w, .06, .06, 0x2a2c30, 15).box(x, .03, z, w, .06, .06, 0x2a2c30, 15);
  }
  if (a.robe) {   // 衣架（換裝）：兩根立柱、橫桿、腳座與五件掛著的衣服；ry 只有 0 或 90°
    const { x, z, ry } = a.robe, at = u => [x + Math.cos(ry) * u, z - Math.sin(ry) * u];
    for (const u of [-.62, .62]) { const [px, pz] = at(u); shell.box(px, .875, pz, .04, 1.75, .04, 0x2a2a2c, 15, 0, ry).box(px, .02, pz, .06, .04, .45, 0x2a2a2c, 15, 0, ry); }
    shell.box(x, 1.72, z, 1.3, .03, .03, 0x8a8c90, 15, 0, ry);
    ROBE_COLS.forEach((c, i) => { const [px, pz] = at(-.44 + i * .22); shell.box(px, 1.69, pz, .01, .06, .01, 0x8a8c90, 15).box(px, 1.6, pz, .05, .1, .42, c, 2, 0, ry).box(px, 1.24, pz, .05, .64, .34, c, 2, 0, ry); });   // 掛鉤、肩線、衣身
    const [hx, hz] = Math.abs(Math.sin(ry)) > .5 ? [.25, .7] : [.7, .25];
    data.boxes.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
  }
  shell.box(a.frame.x, 1.15, a.frame.z, 1.2, 2.3, .06, 0x4a3a2a, 10, 0, a.frame.ry).box(a.frame.x, 2.38, a.frame.z, 1.4, .12, .1, 0xffd8a0, 11, 0, a.frame.ry);
  scn.add(new T.Mesh(shell.build(), MAT.uber));
  a.fb = fb; a.scn = scn; a.req = false;
  // door 是邏輯座標（擺門牌、互動提示的 near 會換算）；doorW、VENUES 的 door 與 out 是世界座標
  a.doorW = WP(a.door.x, a.door.z);
  VENUES[id] = { scene: scn, data, spawn: a.spawn, name: a.name, toast: a.name, dist: a.dist, ceil: a.ceil, door: a.doorW, out: aptOut(id) };
  // 天花板依位置（99-main.js 的相機）：under 是一樓天花板比較低的範圍 [x0, x1, z0, z1, 高]；在第二層用 up.ceil
  if (a.under || a.up) VENUES[id].ceilAt = (x, z) => {
    const V = VENUES[id];
    if (V.lv) return a.up.ceil;
    for (const [ux0, ux1, uz0, uz1, c] of a.under || []) if (x > ux0 && x < ux1 && z > uz0 && z < uz1) return c;
    return a.ceil;
  };
  if (a.up) {
    // 第二層：自己一套碰撞（夾層四周用 low 的盒圍起來：欄杆擋人不擋相機），lvs[V.lv] 是目前這層；ceilAt 給相機
    // 走得到的是 rects 的聯集：外框往外 0.6 m 的範圍裡、不在聯集內的 0.25 m 格子逐列合併成 low 的盒
    const u = a.up, lv1 = { boxes: [], circles: [...u.round], lights: a.lights }, G = .25, inU = (x, z) => u.rects.some(([rx0, rx1, rz0, rz1]) => x > rx0 && x < rx1 && z > rz0 && z < rz1);
    const X0 = Math.min(...u.rects.map(r => r[0])) - .6, X1 = Math.max(...u.rects.map(r => r[1])) + .6, Z0 = Math.min(...u.rects.map(r => r[2])) - .6, Z1 = Math.max(...u.rects.map(r => r[3])) + .6;
    for (let z = Z0; z < Z1 - 1e-6; z += G) for (let x = X0; x < X1 - 1e-6;) {
      if (inU(x + G / 2, z + G / 2)) { x += G; continue; }
      let e = x + G; while (e < X1 - 1e-6 && !inU(e + G / 2, z + G / 2)) e += G;
      lv1.boxes.push({ x0: x, x1: e, z0: z, z1: z + G, low: 1 }); x = e;
    }
    for (const [bx0, bx1, bz0, bz1] of u.boxes) lv1.boxes.push({ x0: bx0, x1: bx1, z0: bz0, z1: bz1 });
    Object.assign(VENUES[id], { lvs: [data, lv1], lv: 0, lvY: 0 });
  }
}
// 換層：碰撞表、地板高度（40-people.js 的 fy、99-main.js 的相機地板）
function aptLevel(id, k) {
  const V = VENUES[id];
  if (!V.lvs) return;
  V.lv = k; V.lvY = k ? APT[id].up.y : 0;
  if (player.where === id) { activeBoxes = V.lvs[k].boxes; activeCircles = V.lvs[k].circles; colDirty(); }
}
// 上下樓：照 up.path 走（下樓倒著走），走完才換層；水平移動時播走路動畫，垂直的那段（電梯）站著
function aptClimb(id, k) {
  const path = k ? APT[id].up.path : [...APT[id].up.path].reverse();
  player.ride = { id, k, pts: [[player.x, player.y, player.z], ...path], i: 0, d: 0, sp: 1.5 };
  player.v = 0; player.dance = 0; player.crouch = false;
}
function aptRide(dt) {
  const R = player.ride, P = R.pts;
  let step = R.fade ? 0 : R.sp * dt;
  while (step > 0 && R.i < P.length - 1) {
    if (P[R.i + 1] === 'fade') {   // 電梯：淡出時換到下一個點（另一層），淡入後接著走
      R.fade = true; step = 0;
      transition(() => { R.i += 2; R.d = 0; R.fade = false; camState.snap = true; });
      break;
    }
    const A = P[R.i], B = P[R.i + 1], left = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) - R.d;
    if (step < left) { R.d += step; step = 0; } else { step -= left; R.i++; R.d = 0; }
  }
  const A = P[R.i], B = P[Math.min(R.i + 1, P.length - 1)] === 'fade' ? A : P[Math.min(R.i + 1, P.length - 1)], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), t = L > 1e-4 ? R.d / L : 0;
  player.x = A[0] + (B[0] - A[0]) * t; player.y = A[1] + (B[1] - A[1]) * t; player.z = A[2] + (B[2] - A[2]) * t;
  const hx = B[0] - A[0], hz = B[2] - A[2], walk = !R.fade && Math.hypot(hx, hz) > .05;
  if (walk) player.yaw += wrapA(Math.atan2(hx, hz) - player.yaw) * (1 - Math.exp(-10 * dt));
  player.v = 0;
  if (walk) player.walkPh += dt * R.sp * .55;
  const a = walk ? ANIM.walk : ANIM.idle;
  if (a !== player.anim) { player.prevAnim = player.anim; player.anim = a; player.blend = 1; }
  player.blend = Math.max(0, player.blend - dt * 5);
  me.anim(0, a, player.walkPh - uTimeNow(), 1, 0);
  me.anim2(0, player.prevAnim, player.blend, 1);
  me.place(0, player.x, player.y, player.z, player.yaw);
  me.flush();
  const ph = player.walkPh * 2;
  if (walk && Math.floor(ph) !== Math.floor(player.stepT)) sfx.step(false, true);
  player.stepT = ph;
  if (R.i >= P.length - 1) { player.ride = null; aptLevel(R.id, R.k); }
}
// 街上的門：發光門牌與門板（門在街區南面，朝 +z；face −1 的朝 −z）
{
  const k = new Kit(), SIGN = { loft: 0xd9b46a, villa: 0x8ad0c0, office: 0xe8ecf0, mini: 0xe8a060, l16: 0xffb070, i14: 0xf0e8d8, lr: 0xc8ccd0, pub: 0xff9a3a, store: 0x5ad8ff };
  for (const id of ROOM_IDS) {
    const { x, z } = APT[id].door, f = aptFace(id);
    // 門板與門牌凸出牆面 5 公分（和立面同一個平面會被櫥窗蓋住）
    k.box(x, 1.2, z - .05 * f, 1.6, 2.4, .2, 0x1c1a18, 10).box(x, 2.62, z + .02 * f, 1.9, .26, .1, SIGN[id], 11);
    if (!APT[id].open) {   // 車庫門（捲門）：門的東邊 3.5 m
      const gx = x + GAR_DX;
      k.box(gx, 1.25, z - .05 * f, 2.8, 2.5, .2, 0x4a4c50, 2).box(gx, 2.62, z + .02 * f, .5, .08, .1, SIGN[id], 11);
      for (let i = 0; i < 8; i++) k.box(gx, .2 + i * .3, z + .06 * f, 2.7, .04, .04, 0x2a2c30, 2);
    }
    if (id === 'office') colliders.push({ x0: x - 1, x1: x + 1, z0: z, z1: z + .3 });   // 島上的門前沒有人行道，門板本身要擋住
  }
  cityAddAny(new T.Mesh(k.build(), MAT.uber));   // 九扇門分在不同的區
}
// ─── 安全屋車庫（原始規格：儲存改裝過的私人載具）───
// 和 GARAGE 07 是同一個車庫（65-motors.js 的 motors.owned／stowed）：開自己的車停到買下的安全屋門口，按 E 停進去並直接進門；門旁的捲門走過去按 E，任一台都開得出來
const aptCurb = id => { const a = APT[id]; return spotW({ x: a.door.x + GAR_DX, z: a.door.z + aptFace(id) * (SW + HR * .5), yaw: Math.PI / 2 }); };   // 車停的位置（世界座標，靠門這側的車道）
function aptStow(id) {
  const v = kestrel;
  exitVehicle();
  motors.stowed = true; saveMotors();
  v.g.visible = false; v.x = v.z = 9999; poseVehicle(v);
  rebuildGarage();
  aptEnter(id); toast(`${CARS[motors.cur].name} 停進${APT[id].name}的車庫`);
}
function aptCarOut(id, cid) {
  closeDialog();
  motors.cur = cid; motors.stowed = false; saveMotors();
  applyCar(kestrel, cid, motors.paint[cid]); placeCarAt(aptCurb(id)); rebuildGarage();
  enterVehicle(kestrel); camState.yaw = kestrel.yaw; camState.snap = true;
  toast(`${CARS[cid].name} 開出車庫`);
}
function aptGarage(id, pg = 0) {   // 一頁六台（對話框的數字鍵到 9），多的翻頁
  const ids = [motors.cur, ...motors.owned.filter(c => c !== motors.cur)], pages = Math.ceil(ids.length / 6);
  pg = (pg + pages) % pages;
  dialog(`${APT[id].name} · 車庫${pages > 1 ? `（${pg + 1}/${pages}）` : ''}`, `車子和 GARAGE 07 放在同一個車庫，從這裡也開得出來。${motors.stowed ? '' : `\n${CARS[motors.cur].name} 現在停在外面，選它會把它開回門口。`}`, [
    ...ids.slice(pg * 6, pg * 6 + 6).map(c => ({ t: CARS[c].name, fn: () => aptCarOut(id, c) })),
    ...(pages > 1 ? [{ t: '下一頁', fn: () => aptGarage(id, pg + 1) }] : []), { t: '離開', fn: closeDialog },
  ]);
}
// 下載室內模型，換掉程式建模的房間
function aptLoad(id) {
  const a = APT[id];
  if (a.req || !GLB_ON) return;
  a.req = true;
  loadProps(aptSet(id)).then(items => {
    if (!items || !items[id]) return;
    a.fb.visible = false;
    const o = propObject(items[id], 0, 0, 0);
    if (a.cut) o.traverse(m => { if (m.isMesh && m.material.transparent) m.material = aptCutMat(m.material, a.cut); });
    a.scn.add(o);
  });
}
// 拉開的落地窗：原檔的玻璃是橫跨整面牆的幾個大三角形，拿不掉一扇，改用透明材質的副本（26-glb.js 的 CUT，共用 uniforms）丟掉那一扇範圍裡的像素
function aptCutMat(m, [x0, x1, z0, z1]) {
  return new T.ShaderMaterial({ name: m.name, uniforms: m.uniforms, side: m.side, transparent: true, depthWrite: m.depthWrite,
    defines: { ...m.defines, CUT: `vec4(${x0.toFixed(2)}, ${x1.toFixed(2)}, ${z0.toFixed(2)}, ${z1.toFixed(2)})` } });
}
function aptUpdate() {
  if (!GLB_ON) return;
  const px = pX(), pz = pZ();
  for (const id of ROOM_IDS) if (!APT[id].req && Math.hypot(px - APT[id].doorW.x, pz - APT[id].doorW.z) < 70) aptLoad(id);
}
const aptEstate = id => ESTATES.find(e => e.id === id);
function aptEnter(id) {
  if (!glbDone.has('p:' + aptSet(id)) && GLB_ON) glbBatch.add('p:' + aptSet(id));
  aptLevel(id, 0); player.ride = null;   // 從門口進來一定在一樓
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
  if (p.mode === 'drive') {   // 自己的車停到買下的安全屋門口
    const v = p.veh;
    if (v !== kestrel || motors.test || Math.hypot(v.vx, v.vz) > 2) return null;
    for (const id of APT_IDS) {
      if (!estOwned(id)) continue;
      const c = aptCurb(id);
      if (Math.hypot(v.x - c.x, v.z - c.z) < 7) return { key: 'E', text: `停進車庫 <i>· ${APT[id].name}</i>`, fn: () => aptStow(id) };
    }
    return null;
  }
  if (p.mode !== 'walk') return null;
  if (p.where === 'out') {
    for (const id of ROOM_IDS) {
      const d = APT[id].door;
      if (!APT[id].open && estOwned(id) && near(d.x + GAR_DX, d.z + .8 * aptFace(id), 1.5)) return { key: 'E', text: `開車出門 <i>· ${APT[id].name}的車庫</i>`, fn: () => aptGarage(id) };
      if (!near(d.x, d.z + .8 * aptFace(id), 1.8)) continue;
      return APT[id].open || estOwned(id) ? { key: 'E', text: `進入${APT[id].name}`, fn: () => aptEnter(id) }
        : { key: 'E', text: `看房 <i>· ${APT[id].name} ${money(aptEstate(id).price)}</i>`, fn: () => aptBuyAtDoor(id) };
    }
    return null;
  }
  const a = APT[p.where];
  if (!a || p.ride) return null;
  // 第二層：樓梯口上下樓；在樓上只有下樓這一項
  if (a.up) {
    const V = VENUES[p.where], P = a.up.path, e = V.lv ? P[P.length - 1] : P[0];
    if (near(e[0], e[2], 1.3)) return { key: 'E', text: V.lv ? (a.up.lift ? '搭電梯下樓' : '下樓') : (a.up.lift ? '搭電梯上樓' : '上樓'), fn: () => aptClimb(p.where, V.lv ? 0 : 1) };
    if (V.lv) return null;
  }
  if (near(a.exit.x, a.exit.z, 1.5)) return { key: 'E', text: '回到街上', fn: exitVenue };
  if (a.till && near(a.till.x, a.till.z, 1.6)) return { key: 'E', text: `買點吃的 <i>· ${money(SNACK)} 補滿生命</i>`, fn: aptSnack };
  if (a.bar && near(a.bar.x, a.bar.z, 1.6)) return { key: 'E', text: '點一杯', fn: () => toast(W.stars ? '酒保瞄了一眼窗外的警燈，假裝沒看到你' : '酒保推來一杯黑啤酒，記在你的帳上') };
  if (a.open) return null;
  if (a.robe && near(a.robe.x, a.robe.z, 1.5)) return { key: 'E', text: '換裝 <i>· 衣架</i>', fn: aptRobe };
  if (near(a.nap.x, a.nap.z, 2)) return { key: 'E', text: '睡一覺 <i>· 推進 6 小時並存檔</i>', fn: aptNap };
  if (a.desk && near(a.desk.x, a.desk.z, 1.6)) {   // 島上辦公室：辦公桌收保險箱
    const n = Math.floor(motors.props.safe[p.where] || 0);
    return { key: 'E', text: `收取保險箱 <i>· ${money(n)}</i>`, fn: () => { const got = estCollect(p.where); toast(got ? `收了 ${money(got)}` : '保險箱是空的'); if (got) sfx.pickup(); } };
  }
  return null;
});

// 測試 API（window.__nc.gta.apt）
const aptApi = { APT, load: aptLoad, enter: aptEnter, nap: aptNap, out: aptOut, level: aptLevel, climb: aptClimb, OUTFITS, outfit, outfitOf, wear: (k, i = crew.cur) => outfitApply(i, k, true), curb: aptCurb, stow: aptStow, carOut: aptCarOut, garage: aptGarage };
