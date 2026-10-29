// ═══ 服裝店：12-wearshops.js 挑好的 36 個一樓店面，四種店型各一個共用的室內場館 'wear_<型>'（同型的店換招牌與店名，像地鐵站換站名牌）═══
// 室內座標：門在 z 0、往 +z 走進去；寬 x −5..5、深 z 0..13、天花板 3.3 m。中間的展示台站三個穿著本店主打的假人，後面右邊是櫃台與店員，後面左邊是試衣間。
// 在櫃台按 E 開選單：分類 → 款式（價錢、已買、穿著中）；沒買的直接買下穿上，買過的穿上或脫下。同一類只穿一件，褲子與裙子二擇一。
// 存檔（65-motors.js 第 15 版）：motors.wear = { own: [款號], on: { 主角代號: [款號] } }，每位主角各穿各的。
const WEAR_W = 5, WEAR_D = 13, WEAR_CEIL = 3.3;
const WEAR_SPAWN = { x: 0, z: 1.2, yaw: 0 }, WEAR_COUNTER = { x: 2.9, z: 9.7 }, WEAR_CLERK = { x: 2.9, z: 11.1, yaw: Math.PI }, WEAR_DOOR_R = 1.6;
const WEAR_PODIUM = [{ x: -1.1, z: 5.6, yaw: .35 }, { x: 0, z: 6.1, yaw: 0 }, { x: 1.1, z: 5.6, yaw: -.35 }];
const WEAR_THEME = {
  budget: { floor: [0xd6d3cb, 0xc6c2b8], wall: 0xe6e1d5, trim: 0xf0b81c, rail: 0xb8bcc0, light: 0xf4f6ff, accent: 0xffd23a,
    cloth: [0x2b4a7a, 0xd8d2c4, 0x7a2a2a, 0x3a5a3a, 0x1c1c20, 0xe0a030, 0x8a8a8a, 0xc8b49a], env: { top: 0x8a8c8a, bot: 0x5a5852, fog: 0x2a2a28 } },
  street: { floor: [0x585654, 0x4e4c4a], wall: 0x26262a, trim: 0x9a7a52, rail: 0x1a1a1c, light: 0xffe0c8, accent: 0xff3fb4,
    cloth: [0x111114, 0xe8e4dc, 0xd83a2a, 0x2a4a2a, 0x6a5a48, 0xff3fb4, 0x3a4a6a, 0xc8c040], env: { top: 0x3a3438, bot: 0x2a2224, fog: 0x1a1418 } },
  sport: { floor: [0x2a3a48, 0x26343f], wall: 0xe8ecef, trim: 0x0d3a8a, rail: 0xc8ccd0, light: 0xf0faff, accent: 0x4ee6ff,
    cloth: [0x0d3a8a, 0xf2f2f0, 0xe8322a, 0x1a1a1e, 0x4ee6ff, 0xf2d020, 0x2a6a4a, 0x8a8e94], env: { top: 0x7a8a96, bot: 0x3a4650, fog: 0x1a2028 } },
  boutique: { floor: [0x4a3020, 0x3e2818], wall: 0x1e2a24, trim: 0xc9a46a, rail: 0xc9a46a, light: 0xffd8a0, accent: 0xf0c890,
    cloth: [0x14141a, 0xe8e0d0, 0x5a1a2a, 0x2a3a4a, 0xa08060, 0x3a2a20, 0x6a6a5a, 0xc8b8a0], env: { top: 0x4a3a2a, bot: 0x2a1e14, fog: 0x1c140e } },
};
const WSHOP = { cur: -1, dummy: {}, sign: {} };
const wearHash = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
// 掛著的衣服（側面看是一件件的肩線與袖子）：沿 z 排在衣桿上，x 是衣桿的位置
function wearHang(k, x, z, y, col, long, tr) {
  const h = long ? .95 : .62;
  k.cyl(x, y + .06, z, .006, .006, .1, 4, tr, 15);
  k.box(x, y - .02, z, .4, .025, .012, tr, 15, 0, 0, 0);
  k.box(x, y - h / 2 - .02, z, .44, h, .035, col, 2);
  k.box(x, y - .2, z + .02, .5, .3, .02, col, 2);   // 袖子收在兩側
  k.box(x, y - h - .02, z, .44, .03, .04, col & 0xf0f0f0, 2);   // 下襬的反摺
}
// 摺好疊著的衣服
function wearStack(k, x, y, z, cols, n, sx = .32, sz = .26) {
  for (let i = 0; i < n; i++) k.box(x + (i % 2) * .006, y + .025 + i * .045, z, sx, .042, sz, cols[i % cols.length], 2);
}
// 一雙鞋（鞋墊、鞋面、鞋頭、鞋底）
function wearShoe(k, x, y, z, ry, col, sole) {
  for (const d of [-.055, .055]) {
    const cx = x + Math.cos(ry) * d, cz = z - Math.sin(ry) * d;
    k.box(cx, y + .015, cz, .09, .03, .27, sole, 2, 0, ry, 0).box(cx, y + .06, cz - Math.cos(ry) * .02, .085, .07, .2, col, 2, 0, ry, 0).add(new T.SphereGeometry(.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), col, 2, tf(cx + Math.sin(ry) * .09, y + .03, cz + Math.cos(ry) * .09, 0, ry, 0));
  }
}
function wearBuild(type) {
  const th = WEAR_THEME[type], S = new T.Scene(), data = { boxes: [], circles: [], lights: [] }, k = new Kit(), B = data.boxes;
  const pick = (i, j) => th.cloth[Math.floor(wearHash(i, j) * th.cloth.length)];
  const wall = (x0, x1, z0, z1, col = th.wall, mat = 2) => { k.box((x0 + x1) / 2, WEAR_CEIL / 2, (z0 + z1) / 2, x1 - x0, WEAR_CEIL, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  // 地板
  if (type === 'boutique') {   // 錯縫的深色木地板（底下墊一整塊，錯開的那半塊才不會露縫）
    k.box(0, -.06, WEAR_D / 2, WEAR_W * 2, .1, WEAR_D, 0x2a1a10, 2);
    for (let x = -WEAR_W, i = 0; x < WEAR_W - .01; x += .25, i++) for (let z = (i % 2) * -.45; z < WEAR_D; z += .9) { const z0 = Math.max(0, z), z1 = Math.min(WEAR_D, z + .9); k.box(x + .125, -.005, (z0 + z1) / 2, .245, .01, z1 - z0 - .006, th.floor[(i + Math.round(z / .9)) & 1], 10); }
  }
  else if (type === 'budget') for (let x = -WEAR_W; x < WEAR_W; x += .6) for (let z = 0; z < WEAR_D; z += .6) k.box(x + .3, -.05, z + .3, .59, .1, .59, th.floor[(Math.round(x / .6) + Math.round(z / .6)) & 1], 10);
  else {
    k.box(0, -.05, WEAR_D / 2, WEAR_W * 2, .1, WEAR_D, th.floor[0], type === 'street' ? 10 : 2);
    if (type === 'street') for (let z = 1.5; z < WEAR_D; z += 3) k.box(0, .002, z, WEAR_W * 2, .004, .02, 0x3a3836, 2);   // 水泥地的切縫
    else { for (const x of [-1.6, 1.6]) k.box(x, .002, 6.5, .06, .004, 11, 0xf2f2f0, 2); k.box(0, .002, 3.2, 3.2, .004, .06, 0xf2f2f0, 2); }   // 運動店的跑道線
  }
  k.box(0, WEAR_CEIL + .05, WEAR_D / 2, WEAR_W * 2 + .4, .1, WEAR_D + .4, type === 'boutique' ? 0x14100c : type === 'street' ? 0x1a1a1c : 0xe8e8e4, 2);
  // 牆：前牆中間是門，兩邊是櫥窗
  wall(-WEAR_W - .3, -WEAR_W, 0, WEAR_D); wall(WEAR_W, WEAR_W + .3, 0, WEAR_D); wall(-WEAR_W - .3, WEAR_W + .3, WEAR_D, WEAR_D + .3);
  for (const s of [-1, 1]) {
    k.box(s * 3, .3, -.15, 4, .6, .3, th.wall, 2).box(s * 3, 3, -.15, 4, .6, .3, th.wall, 2).box(s * 3, 1.65, -.15, 3.96, 2.1, .04, 0x8aa0a8, 1);
    k.box(s * 4.95, 1.65, -.15, .1, 3.3, .3, th.trim, 15).box(s * 1.05, 1.65, -.15, .1, 3.3, .3, th.trim, 15);
  }
  B.push({ x0: -WEAR_W, x1: -.95, z0: -.3, z1: 0 }, { x0: .95, x1: WEAR_W, z0: -.3, z1: 0 });
  k.box(0, 2.95, -.15, 1.9, .7, .3, th.wall, 2).box(0, 1.25, -.12, 1.8, 2.5, .04, 0x9ab0b8, 1).box(0, 1.25, -.1, .04, 2.5, .06, th.trim, 15);   // 玻璃門
  // 護牆板、踢腳板、腰線
  for (const s of [-1, 1]) { k.box(s * (WEAR_W - .02), .06, WEAR_D / 2, .04, .12, WEAR_D, th.trim, 2); k.box(s * (WEAR_W - .02), 2.5, WEAR_D / 2, .03, .05, WEAR_D, th.trim, type === 'boutique' ? 15 : 2); }
  k.box(0, .06, WEAR_D - .02, WEAR_W * 2, .12, .04, th.trim, 2);
  if (type === 'street') {
    // 合板牆面與水泥牆上的色塊
    for (let z = 1.2; z < 9.6; z += 1.22) k.box(-WEAR_W + .03, 1.25, z + .6, .03, 2.4, 1.2, 0x9a7a52, 10);
    for (const [y, z, w, h, c] of [[2.7, 3, 2.4, .5, 0xff3fb4], [2.85, 6.4, 1.6, .3, 0x4ee6ff], [2.6, 8.6, 1.2, .7, 0xf2d020]]) k.box(WEAR_W - .03, y, z, .02, h, w, c, 2);
  }
  if (type === 'sport') for (let z = .4; z < WEAR_D; z += 2.4) k.box(WEAR_W - .03, 2.2, z + 1.2, .02, .12, 2.2, th.trim, 2);   // 運動店的斜條
  // ─── 左牆：一長排衣桿（掛上衣、外套）；右牆前段：衣桿或層架 ───
  const railL = -WEAR_W + .45, railR = WEAR_W - .45;
  k.box(railL, 1.75, 4.5, .03, .03, 6.6, th.rail, type === 'boutique' ? 3 : 15);
  for (const z of [1.25, 4.5, 7.75]) k.box(railL - .22, 1.75, z, .45, .03, .03, th.rail, 15);
  for (let z = 1.4, i = 0; z < 7.7; z += type === 'boutique' ? .34 : .17, i++) wearHang(k, railL, z, 1.75, pick(i, 1), i % 5 === 4 && type !== 'sport', th.rail);
  B.push({ x0: -WEAR_W, x1: railL + .3, z0: 1, z1: 8 });
  if (type === 'sport' || type === 'street') {
    // 鞋牆：發光的層板
    for (let y = .5; y < 2.5; y += .45) {
      k.box(railR + .2, y, 4.5, .36, .035, 6.4, th.rail, 2).box(railR + .02, y - .02, 4.5, .01, .01, 6.4, th.accent, 8);
      for (let z = 1.6, i = 0; z < 7.6; z += .5, i++) wearShoe(k, railR + .2, y + .02, z, -Math.PI / 2, pick(i, y * 10), i % 3 ? 0xf2f2f0 : 0x1a1a1a);
    }
    B.push({ x0: railR, x1: WEAR_W, z0: 1.2, z1: 7.8 });
  } else {
    k.box(railR, 1.25, 4.5, .03, .03, 6.6, th.rail, type === 'boutique' ? 3 : 15);
    for (let z = 1.4, i = 0; z < 7.7; z += type === 'boutique' ? .38 : .17, i++) wearHang(k, railR, z, 1.25, pick(i, 2), false, th.rail);
    k.box(railR + .15, 2.2, 4.5, .5, .035, 6.4, th.rail, 2);
    for (let z = 1.6, i = 0; z < 7.6; z += .55, i++) wearStack(k, railR + .15, 2.22, z, [pick(i, 3), pick(i, 4)], 3);
    B.push({ x0: railR - .3, x1: WEAR_W, z0: 1, z1: 8 });
  }
  // ─── 中間：展示台與三個假人（假人在 wearDummies），前面是平台桌 ───
  if (type === 'boutique') { k.cyl(0, .08, 5.8, 1.9, 1.95, .16, 40, 0xe8e2d8, 2); k.cyl(0, .165, 5.8, 1.88, 1.88, .01, 40, th.trim, 3); }
  else k.box(0, .08, 5.8, 3.6, .16, 1.4, type === 'street' ? 0x1a1a1c : type === 'sport' ? 0x0d3a8a : 0xf2efe8, type === 'sport' ? 2 : 10);
  data.circles.push({ x: 0, z: 5.8, r: 1.6 });
  if (type === 'budget') {
    // 平價店：兩張堆滿摺好衣服的平台桌與黃色的價錢牌
    for (const [x, z] of [[-1.6, 3], [1.6, 3]]) {
      k.box(x, .4, z, 1.4, .8, .8, 0xe8e4da, 10).box(x, .81, z, 1.44, .02, .84, 0xc8c4b8, 2);
      for (let i = 0; i < 4; i++) wearStack(k, x - .5 + i * .33, .82, z - .18, [pick(i + x, 5), pick(i, 6)], 3 + (i % 2), .3, .25), wearStack(k, x - .5 + i * .33, .82, z + .18, [pick(i - x, 7)], 2 + (i % 3), .3, .25);
      k.box(x, 1.05, z - .43, .36, .2, .01, 0xffd23a, 2).box(x, 1.05, z - .436, .3, .05, .002, 0x1a1a1a, 2).box(x, .92, z - .43, .01, .1, .01, 0x1a1a1a, 15);
      B.push({ x0: x - .75, x1: x + .75, z0: z - .45, z1: z + .45 });
    }
  } else if (type === 'boutique') {
    // 精品店：大理石的低檯（擺包包與墨鏡的展示盒）
    for (const [x, z] of [[-1.7, 3], [1.7, 3]]) {
      k.box(x, .45, z, 1.1, .9, .6, 0xe8e2d8, 10).box(x, .91, z, 1.14, .02, .64, th.trim, 3).box(x, 1.05, z, .9, .26, .45, 0x9ab0b8, 1);
      for (let i = 0; i < 3; i++) k.box(x - .3 + i * .3, .99, z, .22, .14, .1, pick(i, 8), 10).cyl(x - .3 + i * .3, 1.07, z, .04, .04, .01, 6, th.trim, 3);
      B.push({ x0: x - .6, x1: x + .6, z0: z - .35, z1: z + .35 });
    }
  } else {
    // 街頭與運動店：一座圓形衣架與一張長凳
    k.cyl(-1.8, .7, 3, .02, .02, 1.4, 6, th.rail, 15).cyl(-1.8, .02, 3, .3, .32, .04, 16, th.rail, 15);
    k.add(new T.TorusGeometry(.5, .015, 6, 24), th.rail, 15, tf(-1.8, 1.4, 3, Math.PI / 2, 0, 0));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = -1.8 + Math.sin(a) * .5, z = 3 + Math.cos(a) * .5; k.box(x, 1.08, z, .05, .6, .4, pick(i, 9), 2, 0, a, 0); }
    data.circles.push({ x: -1.8, z: 3, r: .62 });
    k.box(1.8, .42, 3, 1.4, .06, .42, type === 'street' ? 0x9a7a52 : 0x2a3a48, 10).box(1.25, .2, 3, .06, .4, .36, th.rail, 15).box(2.35, .2, 3, .06, .4, .36, th.rail, 15);
    B.push({ x0: 1.1, x1: 2.5, z0: 2.8, z1: 3.2 });
  }
  // ─── 後面右邊：櫃台、收銀機、後牆的招牌（wearArrive 換字）───
  const cx = WEAR_COUNTER.x, cz = WEAR_COUNTER.z + .55;
  k.box(cx, .5, cz, 2.6, 1, .6, type === 'boutique' ? 0xe8e2d8 : type === 'street' ? 0x9a7a52 : th.trim, 10).box(cx, 1.01, cz, 2.7, .03, .7, type === 'boutique' ? th.trim : 0x1a1a1c, type === 'boutique' ? 3 : 10);
  k.box(cx, .25, cz - .31, 2.6, .05, .01, th.accent, 8);
  k.box(cx + .7, 1.12, cz, .34, .18, .3, 0x2a2c30, 2).box(cx + .7, 1.3, cz - .05, .28, .18, .02, 0x6ad0ff, 8);
  k.box(cx - .6, 1.04, cz, .4, .03, .3, 0xe8e0d0, 2).box(cx - .6, 1.08, cz, .36, .05, .26, 0xf0ece4, 2);   // 包裝紙袋
  B.push({ x0: cx - 1.35, x1: cx + 1.35, z0: cz - .35, z1: cz + .35 });
  k.box(WEAR_CLERK.x, 1.7, WEAR_D - .06, 3, 1.4, .06, 0x111114, 2);
  // ─── 後面左邊：兩間試衣間（簾子）與一面大鏡子（不做真的反射：霧面的鏡面加兩道斜的高光）───
  for (const x of [-4, -2.6]) {
    k.box(x - .7, 1.2, 11.7, .06, 2.4, 2.4, th.wall === 0xe8ecef ? 0xd0d6da : th.wall, 2).box(x, 2.38, 10.5, 1.4, .04, .04, th.rail, 15);
    for (let i = 0; i < 9; i++) k.box(x - .62 + i * .155, 1.25, 10.52 + (i % 2) * .04, .16, 2.25, .03, type === 'boutique' ? 0x5a1a2a : type === 'street' ? 0x1a1a1c : type === 'sport' ? 0x0d3a8a : 0x8a8a84, 2);
  }
  k.box(-1.9, 1.2, 11.7, .06, 2.4, 2.4, th.wall, 2);
  B.push({ x0: -WEAR_W, x1: -1.85, z0: 10.45, z1: WEAR_D });
  k.box(-1.2, 1.3, WEAR_D - .05, .9, 2, .03, 0x8a949a, 2).box(-1.45, 1.6, WEAR_D - .068, .06, 1.1, .002, 0xc8d0d4, 2).box(-1.32, 1.5, WEAR_D - .068, .025, .8, .002, 0xc8d0d4, 2).box(-1.2, 1.3, WEAR_D - .03, 1, 2.1, .02, th.trim, 2);   // 大鏡子
  // ─── 燈：平價店的日光燈管、街頭店的工業吊燈、運動店的燈條、精品店的暖色投射燈 ───
  const lc = lin(th.light);
  if (type === 'budget') { for (const z of [2.5, 5.5, 8.5, 11.2]) for (const x of [-2.4, 2.4]) k.box(x, WEAR_CEIL - .04, z, .14, .05, 1.8, 0xf8f8ff, 11); data.lights.push(...[2.5, 5.5, 8.5, 11.2].map(z => ({ x: 0, y: 2.9, z, col: lc, r: 7, i: 1.15 }))); }
  else if (type === 'street') {
    for (const [x, z] of [[-2.6, 3], [0, 5.8], [2.6, 3], [-2.6, 8], [2.6, 8], [2.9, 10.6]]) { k.cyl(x, WEAR_CEIL - .4, z, .005, .005, .8, 4, 0x111111, 15); k.add(new T.ConeGeometry(.2, .2, 14, 1, true), 0x1a1a1c, 15, tf(x, WEAR_CEIL - .85, z)); k.add(new T.SphereGeometry(.07, 10, 6), 0xffd8a0, 8, tf(x, WEAR_CEIL - .93, z)); data.lights.push({ x, y: 2.3, z, col: lc, r: 5.5, i: .95 }); }
    k.box(0, WEAR_CEIL - .02, 6.5, .05, .02, 11, 0xff3fb4, 8);
    data.lights.push({ x: 0, y: 3, z: 6.5, col: lin(0xff3fb4), r: 6, i: .5 });
  } else if (type === 'sport') {
    for (const x of [-2.5, 0, 2.5]) k.box(x, WEAR_CEIL - .03, 6.5, .08, .04, 11.5, 0xf0faff, 11);
    data.lights.push(...[2.5, 6, 9.5].map(z => ({ x: 0, y: 2.9, z, col: lc, r: 7, i: 1.1 })), { x: 4.4, y: 1.5, z: 4.5, col: lin(0x4ee6ff), r: 4, i: .6 });
  } else {
    for (const [x, z] of [[0, 5.8], [-1.7, 3], [1.7, 3], [-4.2, 4.5], [4.2, 4.5], [2.9, 10.4], [-1.2, 11.5]]) { k.cyl(x, WEAR_CEIL - .03, z, .07, .07, .04, 12, th.trim, 3); k.cyl(x, WEAR_CEIL - .06, z, .04, .04, .02, 10, 0xffe0b0, 8); data.lights.push({ x, y: 2.8, z, col: lc, r: 4.5, i: .9 }); }
    for (let x = -3; x <= 3; x += 3) { k.cyl(x, WEAR_CEIL - .45, 8.6, .005, .005, .9, 4, th.trim, 3); k.add(new T.SphereGeometry(.16, 14, 10), 0xffd8a0, 11, tf(x, WEAR_CEIL - .95, 8.6)); }
  }
  data.lights.push({ x: 0, y: 2.2, z: .6, col: lin(th.accent), r: 4, i: .5 });
  S.add(new T.Mesh(k.build(), MAT.uber));
  // 後牆的招牌：自己的畫布，換店時用 12-wearshops.js 那一型的畫法重畫
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  const sg = new T.Mesh(new T.PlaneGeometry(2.8, .525), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
  sg.position.set(WEAR_CLERK.x, 1.75, WEAR_D - .1); sg.rotation.y = Math.PI; S.add(sg);
  WSHOP.sign[type] = { cv, tex };
  ENV['wear_' + type] = { lampOn: 0, wet: 0, fogDen: .02, fog: th.env.fog, fogHi: th.env.fog, top: th.env.top, bot: th.env.bot };
  VENUES['wear_' + type] = { scene: S, data, spawn: WEAR_SPAWN, name: '', toast: '', dist: '', ceil: WEAR_CEIL, door: { x: 0, z: 0 }, out: { x: 0, z: 0, yaw: 0 } };
}
for (const t of WEAR_TYPES) wearBuild(t);
// 店員與假人（crowd 一型一份）；假人是白色的人台：沒有頭髮、皮膚是消光白，只穿本店主打的款式
const WEAR_MANNE = lin(0xe8e6e2);
function wearFeature(type, n) {
  const l = WEAR.filter(w => w.shops.includes(type)), out = [];
  for (let j = 0; j < n; j++) {
    const set = [];
    for (let k = 0; k < l.length; k++) { const w = l[(j * 2 + k) % l.length]; if (set.some(id => wearClash(WEAR_BY[id], w))) continue; set.push(w.id); }
    out.push(set);
  }
  return out;
}
for (const t of WEAR_TYPES) {
  const V = VENUES['wear_' + t], feat = wearFeature(t, 3), cr = crowd(4);
  WEAR_PODIUM.forEach((p, j) => {
    cr.look(j, { r: rng(2700 + j), female: j === 1, skin: WEAR_MANNE, hair: WEAR_MANNE, top: WEAR_MANNE, bot: WEAR_MANNE, shoe: WEAR_MANNE, coat: 0, skirt: 0, longHair: 0, hat: 0, glowI: 0, scale: 1, wear: feat[j] });
    cr.anim(j, ANIM.idle, 0, 0, 0); cr.place(j, p.x, .16, p.z, p.yaw);
  });
  cr.look(3, { r: rng(2710 + WEAR_TYPES.indexOf(t)), female: t !== 'street', coat: 0, wear: feat[0] });
  cr.anim(3, ANIM.idle, 0, 1, 0); cr.place(3, WEAR_CLERK.x, 0, WEAR_CLERK.z, WEAR_CLERK.yaw); cr.flush();
  V.scene.add(cr.mesh); V.data.circles.push({ x: WEAR_CLERK.x, z: WEAR_CLERK.z, r: .3 });
  WSHOP.dummy[t] = cr;
}
function wearArrive(i) {
  const s = WEAR_SHOPS[i], V = VENUES['wear_' + s.type], sg = WSHOP.sign[s.type];
  WSHOP.cur = i;
  V.name = s.name; V.toast = `${s.name} · ${s.sub}`; V.dist = s.d;
  V.door = WP(s.door.x, s.door.z); V.out = spotW(s.out);
  const c = sg.cv.getContext('2d'); c.clearRect(0, 0, 512, 96); WEAR_SIGN[s.type](c, s); sg.tex.needsUpdate = true;
}
function wearEnter(i) { wearArrive(i); enterVenue('wear_' + WEAR_SHOPS[i].type); }

// ─── 玩家身上穿的（40-people.js 的 look 讀 WEAR_ME.on()）───
const wearWho = () => CREW[crew.cur].id;
const wearOn = () => motors.wear.on[wearWho()] || (motors.wear.on[wearWho()] = []);
WEAR_ME.on = () => (motors.wear.on[wearWho()] || []).filter(id => WEAR_BY[id]);
function wearRefresh() { me.look(0, { r: rng(9), ...CREW[crew.cur].look }); }
// 穿上：同一類（配件是同一個位置）換掉，褲子與裙子二擇一（wearClash），帽子蓋掉頭髮的事交給 40-people.js
function wearPut(id) {
  const w = WEAR_BY[id], on = wearOn();
  for (let k = on.length - 1; k >= 0; k--) { const o = WEAR_BY[on[k]]; if (!o || wearClash(w, o)) on.splice(k, 1); }
  on.push(id);
}
function wearOff(id) { const on = wearOn(), k = on.indexOf(id); if (k >= 0) on.splice(k, 1); }
function wearPick(id) {
  const w = WEAR_BY[id], own = motors.wear.own.includes(id), on = wearOn().includes(id);
  if (!own) {
    if (motors.cash < w.price) { toast(`現金不夠，還差 ${money(w.price - motors.cash)}`); return false; }
    motors.cash -= w.price; motors.wear.own.push(id); wearPut(id); sfx.pickup();
    toast(`買下 ${w.name} −${money(w.price)}`);
  } else if (on) { wearOff(id); toast(`脫下 ${w.name}`); }
  else { wearPut(id); toast(`穿上 ${w.name}`); }
  saveMotors(); wearRefresh();
  return true;
}
// 櫃台的選單
function wearMenu() {
  const s = WEAR_SHOPS[WSHOP.cur], who = `${s.name} · 櫃台`, list = WEAR.filter(w => w.shops.includes(s.type));
  const cats = Object.keys(WEAR_CATS).filter(c => list.some(w => w.cat === c));
  const top = () => dialog(who, `${s.sub}。要看哪一類？身上穿的會直接換。現金 ${money(motors.cash)}。`, [
    ...cats.map(c => ({ t: `${WEAR_CATS[c]}（${list.filter(w => w.cat === c).length}）`, fn: () => cat(c) })),
    ...(wearOn().length ? [{ t: '全部脫掉', fn: () => { wearOn().length = 0; saveMotors(); wearRefresh(); toast('換回原本的衣服'); top(); } }] : []),
    { t: '先看看', fn: closeDialog },
  ]);
  const cat = c => {
    const on = wearOn();
    dialog(who, `${WEAR_CATS[c]}。現金 ${money(motors.cash)}。`, [
      ...list.filter(w => w.cat === c).map(w => {
        const own = motors.wear.own.includes(w.id), wear = on.includes(w.id);
        return { t: `${w.name} · ${wear ? '穿著中（脫下）' : own ? '已買（穿上）' : money(w.price)}`, fn: () => { wearPick(w.id); cat(c); } };
      }),
      { t: '回上一層', fn: top },
    ]);
  };
  top();
}
ctxHooks.push(() => {
  const p = player;
  if (p.mode !== 'walk' || p.ride) return null;
  if (p.where === 'out') {
    for (const s of WEAR_SHOPS) {
      const d = s.doorW || (s.doorW = WP(s.door.x, s.door.z));
      if (Math.abs(p.x - d.x) < WEAR_DOOR_R && Math.abs(p.z - d.z) < WEAR_DOOR_R && Math.hypot(p.x - d.x, p.z - d.z) < WEAR_DOOR_R) return { key: 'E', text: `進服裝店 <i>· ${s.name}</i>`, fn: () => wearEnter(s.i) };
    }
    return null;
  }
  if (!p.where.startsWith('wear_')) return null;
  if (p.z < 1.1 && Math.abs(p.x) < 1.2) return { key: 'E', text: `出去 <i>· ${WEAR_SHOPS[WSHOP.cur].d}</i>`, fn: () => exitVenue() };
  if (Math.hypot(p.x - WEAR_COUNTER.x, p.z - WEAR_COUNTER.z) < 1.3) return { key: 'E', text: '櫃台 <i>· 買衣服、換衣服</i>', fn: wearMenu };
  return null;
});
// 大地圖（91-map.js）
function wearBlips(add) {
  for (const s of WEAR_SHOPS) add('wear', { name: s.name, txt: '衣', ...WP(s.door.x, s.door.z), type: `服裝店 · ${{ budget: '平價', street: '街頭', sport: '運動', boutique: '精品' }[s.type]}`, desc: `${s.d}的一樓店面，${s.sub}。進去在櫃台按 E 買衣服、換衣服。` });
}
gtaApi.wear = {
  WSHOP, shops: WEAR_SHOPS, items: WEAR, enter: i => wearEnter(i), pick: id => wearPick(id), put: id => { wearPut(id); wearRefresh(); }, off: () => { wearOn().length = 0; wearRefresh(); }, on: () => WEAR_ME.on(),
  // 驗收：玩家擺到某間店的門口（世界座標）
  atDoor(i) { const s = WEAR_SHOPS[i], d = WP(s.door.x, s.door.z), o = spotW(s.out); setWhere('out'); player.x = d.x; player.z = d.z; player.y = groundH(d.x, d.z); player.yaw = o.yaw + Math.PI; camState.yaw = player.yaw; camState.snap = true; },
  COUNTER: WEAR_COUNTER,
  // 驗收：外套蓋住底下那件的頂點數（wearUnder）與沒蓋住的頂點依綁定姿勢的高度、離中線、前後分格的數量
  under(sex, jid, wid) {
    const h = wearUnder(sex, WEAR_BY[jid], WEAR_BY[wid]), P = PEOPLE.wear[sex][WEAR_BY[wid].shape].pos, miss = {};
    let k = 0;
    for (let i = 0; i < h.length; i++) if (h[i]) k++; else { const t = [P[i * 3 + 1].toFixed(1), Math.abs(P[i * 3]).toFixed(1), P[i * 3 + 2] > 0 ? 'f' : 'b'].join(); miss[t] = (miss[t] || 0) + 1; }
    return { cov: k, n: h.length, miss: Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 12) };
  },
};
// 開場時主角的外觀在 69-crew.js 就套好了（那時還讀不到存檔裡的衣服），這裡補穿一次
wearRefresh();
