// ═══ VELOCE MOTORS 展示廳：三層樓的美式豪華車行（胡桃木護牆、黃銅、大理石、水晶吊燈、天窗） ═══
// 門在 z = 0，室內 x −SV_W..SV_W、z 0..SV_D，每層 SV_FH 高。中間是挑空到屋頂的中庭（|x| < SV_ATR、z < SV_VOID），
// 實車沿左右兩側的展廊擺（每層每側 8 台，車頭斜朝中庭），中庭一樓是旋轉台上的鎮店之寶、接待櫃台與休息區；
// 二樓後方是會員酒吧與撞球檯，三樓後方是點唱機、老加油機與閱覽角。後方正中間是玻璃電梯（E 選樓層），二、三樓的中庭邊是黃銅欄杆。
// 每層一套碰撞與燈（show.lv[k]），換層走 showLevel(k)：VENUES.show.data／lvs／lvY 跟著換（40-people.js 的地板、99-main.js 的相機）。
// 明亮的展廳：環境光拉高、地板與上半牆改成淺色；post 是 70-render.js 的場館後製（曝光、泛光門檻與強度、高光肩部），
// 水晶吊燈、天窗與車漆的反光收在肩部的漸近值以下，不會燒成整片白
ENV.show = { lampOn: 0, wet: 0, fogDen: .003, fog: 0x4a4036, fogHi: 0x5a4e40, top: 0xd8ccba, bot: 0x7a6c5e, post: { exp: 1.04, thr: 1.8, bloom: .4, knee: 1.0, range: .85 } };
const SV_W = 17, SV_D = 52, SV_FH = 6, SV_NF = 3, SV_ATR = 6, SV_VOID = 42.4, SV_ROOF = SV_NF * SV_FH;
const SV_CX = 11.8, SV_SLOT = [7, 12, 17, 22, 27, 32, 37, 42], SV_YAW = 2.06;   // 車的中心 x、各格的 z、左側車頭朝向（右側取負）
const SV_LIFT = { x: 0, z: 45.4 }, SELLER = { x: 0, z: 35.4 }, SV_HERO = { id: 'c110', x: 0, z: 18 };
// 各樓層的車（左、右各 8 格）；CAR_ORDER 裡沒排到的車自動補進空格（街頭車除外）
const SHOW_FLOORS = [
  { name: '1F · 日系經典與 BMW M', L: ['ae86', 'rx7', 'supra', 'r34', 'nsx', 'r35', 'e34', 'evo190'], R: ['e92', 'm3c', 'm4wb', 'm4csl', 'm3gtr', 'm3t24', 'm4gt3'] },
  { name: '2F · 歐洲超跑', L: ['gt3rs', 'gt3r', 'p930', 'rwb', 'f40', 'f8', 'f488c', 'sf90'], R: ['p1', 'svj', 'sc20', 'evija', 'spano', 'spano8', 'scg'] },
  { name: '3F · 美式、賓士、概念車與機車', L: ['chall', 'zr1', 'charger', 'police', 'mosler', 'slk55', 'c63dtm', 'csl3'], R: ['giulietta', 'nevera', 'energ', 'p9x8', 's1krr', 's1krr19', 'zx6r', 'v4'] },
];
{
  const placed = new Set([SV_HERO.id, ...SHOW_FLOORS.flatMap(f => [...f.L, ...f.R])]);
  for (const id of CAR_ORDER) if (!placed.has(id) && !CARS[id].street) { const f = SHOW_FLOORS.find(f => f.L.length < 8 || f.R.length < 8); if (!f) break; (f.R.length < 8 ? f.R : f.L).push(id); }
}
const showScene = new T.Scene();
const show = { lv: [0, 1, 2].map(() => ({ boxes: [], circles: [], lights: [] })), cars: [], spin: [], people: null, cab: null };

// ─── 招牌、海報與樓層牌：自己的貼圖（20-props.js 的招牌圖集已滿） ───
const svAtlas = document.createElement('canvas'); svAtlas.width = 1280; svAtlas.height = 1280;
const svCells = {};
let svX = 0, svY = 0, svRow = 0;
function svCell(name, w, h, draw) {
  if (svX + w > svAtlas.width) { svX = 0; svY += svRow + 2; svRow = 0; }
  const c = svAtlas.getContext('2d'), x = svX, y = svY; svX += w + 2; svRow = Math.max(svRow, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); draw(c, w, h); c.restore();
  svCells[name] = { u0: x / svAtlas.width, v0: 1 - (y + h) / svAtlas.height, u1: (x + w) / svAtlas.width, v1: 1 - y / svAtlas.height };
  if (y + h > svAtlas.height) console.warn('showroom atlas overflow', name);
}
// 復古賽事海報（名稱都是原創）：底色漸層、太陽或山、路面透視線、車的剪影、標題與年份
const POSTERS = [
  ['NEON CITY', 'GRAND PRIX', '1967', '#1b2a4a', '#e8b04a', '#f2ead6', 'sun'],
  ['VELOCE', 'CUP', '1972', '#7a1c1c', '#f2c35a', '#f2ead6', 'road'],
  ['COASTAL', '500', '1964', '#0f4a5a', '#f08a4a', '#f2ead6', 'sea'],
  ['DESERT', 'RUN', '1969', '#a8541c', '#f2d07a', '#2a1a10', 'sun'],
  ['MIDNIGHT', 'DRAG', '1977', '#141018', '#ff4f9a', '#f2ead6', 'road'],
  ['HARBOR', 'HILLCLIMB', '1961', '#2f4a2a', '#e8c25a', '#f2ead6', 'hill'],
  ['NORTH RIDGE', 'RALLY', '1974', '#3a2a4a', '#9fd0e8', '#f2ead6', 'hill'],
  ['TWIN BRIDGES', '12 HOURS', '1959', '#5a3a1c', '#e8d8b0', '#1a1410', 'sea'],
];
POSTERS.forEach(([t1, t2, yr, bg, ac, ink, kind], i) => svCell('SV_P' + i, 256, 384, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg); g.addColorStop(1, '#0a0806'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = ac;
  if (kind === 'sun') { c.beginPath(); c.arc(w / 2, 170, 70, 0, 6.2832); c.fill(); for (let k = 0; k < 5; k++) { c.fillStyle = bg; c.fillRect(40, 175 + k * 13, w - 80, 4 + k); } }
  else if (kind === 'hill') { c.beginPath(); c.moveTo(0, 250); c.lineTo(70, 150); c.lineTo(120, 200); c.lineTo(190, 120); c.lineTo(256, 230); c.lineTo(256, 260); c.lineTo(0, 260); c.fill(); }
  else if (kind === 'sea') { c.beginPath(); c.arc(190, 120, 34, 0, 6.2832); c.fill(); for (let k = 0; k < 6; k++) { c.globalAlpha = .5; c.fillRect(0, 200 + k * 9, w, 3); } c.globalAlpha = 1; }
  // 路面：往中間消失的兩條邊線與中線
  c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.moveTo(w / 2 - 6, 220); c.lineTo(w / 2 + 6, 220); c.lineTo(w, 330); c.lineTo(0, 330); c.fill();
  c.strokeStyle = ac; c.lineWidth = 3; for (let k = 0; k < 5; k++) { const y0 = 230 + k * 20; c.beginPath(); c.moveTo(w / 2, y0); c.lineTo(w / 2, y0 + 9); c.stroke(); }
  // 車的剪影（流線型的跑車側面）
  c.fillStyle = ink; c.beginPath(); c.moveTo(50, 300); c.bezierCurveTo(60, 278, 95, 270, 110, 262); c.bezierCurveTo(140, 246, 175, 248, 196, 266); c.lineTo(214, 274); c.bezierCurveTo(222, 282, 222, 296, 214, 300); c.closePath(); c.fill();
  c.fillStyle = '#0a0806'; for (const x of [84, 186]) { c.beginPath(); c.arc(x, 300, 13, 0, 6.2832); c.fill(); }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink;
  c.font = `800 ${t1.length > 9 ? 26 : 32}px ${FONT_C}`; c.fillText(t1, w / 2, 36);
  c.fillStyle = ac; c.font = `900 ${t2.length > 7 ? 30 : 40}px ${FONT_B}`; c.fillText(t2, w / 2, 76);
  c.fillStyle = ink; c.font = `700 22px ${FONT_C}`; c.fillText(yr, w / 2, 356);
  c.strokeStyle = ac; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
}));
svCell('SV_PLAQUE', 512, 128, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e8c46a'); g.addColorStop(.5, '#a8803a'); g.addColorStop(1, '#d8b058'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#5a3e14'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#3a2608'; c.font = `800 46px ${FONT_C}`; c.fillText('VELOCE MOTORS', w / 2, 52); c.font = `700 20px ${FONT_C}`; c.fillText('FINE AUTOMOBILES  ·  EST. 1958', w / 2, 96);
});
SHOW_FLOORS.forEach((f, i) => svCell('SV_F' + i, 512, 96, (c, w, h) => {
  plate(c, w, h, '#1a1008'); c.strokeStyle = '#c9a24a'; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12);
  c.textBaseline = 'middle'; c.fillStyle = '#e8c46a'; c.textAlign = 'left'; c.font = `800 52px ${FONT_C}`; c.fillText((i + 1) + 'F', 26, h / 2 + 2);
  c.font = `600 26px ${FONT_H}`; c.fillStyle = '#efe4c8'; c.fillText(f.name.replace(/^\dF · /, ''), 118, h / 2 + 2);
}));
svCell('SV_BAR', 512, 128, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, "Members' Lounge", w / 2, h * .52, 60, '#ffb060', FONT_S, 700); });
svCell('SV_1958', 384, 128, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, 'SINCE 1958', w / 2, h * .5, 64, '#2cf2d8', FONT_C, 800); });
svCell('SV_V8', 384, 96, (c, w, h) => {
  plate(c, w, h, '#120c06'); c.strokeStyle = '#c9a24a'; c.lineWidth = 3; c.strokeRect(5, 5, w - 10, h - 10);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e8c46a'; c.font = `800 34px ${FONT_C}`; c.fillText('THE HEART OF IT ALL', w / 2, 36); c.font = `600 18px ${FONT_H}`; c.fillStyle = '#d8c8a8'; c.fillText('7.0 升自然進氣 V8 · 1968', w / 2, 70);
});
const svTex = new T.CanvasTexture(svAtlas);
svTex.colorSpace = T.SRGBColorSpace; svTex.anisotropy = 8; svTex.minFilter = T.LinearMipmapLinearFilter;
const MAT_SV = MAT_SIGN.clone(); MAT_SV.uniforms = { ...shared(ALLU), tAtlas: { value: svTex } };
// 牌子：name 在 svCells 用自己的貼圖，否則用 20-props.js 的招牌圖集；ry 是牌面朝向（0 = 朝 +z），glow 是亮度
function svSign(name, x, y, z, ry, w, h, glow = 1, kind = 0) {
  const own = name in svCells, c = own ? svCells[name] : cells[name], g = new T.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(c.u0, c.u1, uv.getX(i)), lerp(c.v0, c.v1, uv.getY(i)));
  g.setAttribute('aS', new T.Float32BufferAttribute(new Array(uv.count).fill(0).flatMap(() => [Math.random(), kind, glow, 0]), 4));
  const m = new T.Mesh(g, own ? MAT_SV : MAT_SIGN); m.position.set(x, y, z); m.rotation.y = ry; showScene.add(m); return m;
}

// ─── 建築 ───
{
  const k = new Kit(), S = showScene, L = show.lv;
  const walnut = 0x4a2a16, walnutD = 0x2e1a0e, brass = 0xc9a24a, marble = 0xd8d2c6, marbleD = 0xb8ad9a, cream = 0xefe6d2, leather = 0x5a2e1a;
  const allBox = b => { for (const l of L) l.boxes.push({ ...b }); };
  const allCirc = c => { for (const l of L) l.circles.push({ ...c }); };
  // 外牆（三層共用的碰撞）：前牆在一樓留門
  allBox({ x0: -SV_W - .4, x1: -SV_W, z0: 0, z1: SV_D }); allBox({ x0: SV_W, x1: SV_W + .4, z0: 0, z1: SV_D }); allBox({ x0: -SV_W - .4, x1: SV_W + .4, z0: SV_D, z1: SV_D + .4 });
  L[0].boxes.push({ x0: -SV_W, x1: -1.4, z0: -.4, z1: 0 }, { x0: 1.4, x1: SV_W, z0: -.4, z1: 0 }, { x0: -1.4, x1: 1.4, z0: -.7, z1: -.3 });
  for (const l of L.slice(1)) l.boxes.push({ x0: -SV_W, x1: SV_W, z0: -.4, z1: 0 });
  // 中庭挑空：二、三樓不能走進去（low：擋人不擋相機）
  for (const l of L.slice(1)) l.boxes.push({ x0: -SV_ATR, x1: SV_ATR, z0: -1, z1: SV_VOID, low: 1 });
  // 電梯井
  allBox({ x0: -1.65, x1: 1.65, z0: SV_LIFT.z + 1.2, z1: SV_LIFT.z + 4.8 });

  for (let f = 0; f < SV_NF; f++) {
    const Y = f * SV_FH;
    // 地板：米色拋光大理石＋黃銅分割線（一樓整片；樓上是兩側展廊與後方的走道，中庭留空）
    const floorRect = (x0, x1, z0, z1) => {
      k.box((x0 + x1) / 2, Y - .25, (z0 + z1) / 2, x1 - x0, .5, z1 - z0, marbleD, 40);
      for (let x = Math.ceil(x0 / 2.5) * 2.5; x < x1; x += 2.5) k.box(x, Y + .002, (z0 + z1) / 2, .03, .004, z1 - z0, brass, 15);
      for (let z = Math.ceil(z0 / 2.5) * 2.5; z < z1; z += 2.5) k.box((x0 + x1) / 2, Y + .002, z, x1 - x0, .004, .03, brass, 15);
    };
    if (f === 0) floorRect(-SV_W, SV_W, 0, SV_D);
    else { floorRect(-SV_W, -SV_ATR, 0, SV_D); floorRect(SV_ATR, SV_W, 0, SV_D); floorRect(-SV_ATR, SV_ATR, SV_VOID, SV_D); }
    // 展廊的天花板：樓板下的胡桃木藻井（格子裡是奶油色的平頂），每台車上方一盞崁燈
    const cy = Y + SV_FH - .5;
    for (const s of [-1, 1]) {
      const x0 = s * SV_ATR, x1 = s * SV_W, xm = (x0 + x1) / 2;
      k.box(xm, cy + .02, SV_D / 2, SV_W - SV_ATR, .04, SV_D, 0xe6dccb, 2);
      for (let z = 0; z <= SV_D; z += 2.5) k.box(xm, cy - .14, z, SV_W - SV_ATR, .28, .16, walnut, 23);
      for (let x = SV_ATR + 2.75; x < SV_W; x += 2.75) k.box(s * x, cy - .14, SV_D / 2, .16, .28, SV_D, walnut, 25);
      if (f < SV_NF - 1) k.box(s * (SV_ATR - .02), cy - .05, SV_VOID / 2, .1, .7, SV_VOID, walnutD, 10).box(s * (SV_ATR - .05), cy - .38, SV_VOID / 2, .05, .04, SV_VOID, brass, 3);   // 樓板邊緣的胡桃木封邊與黃銅線
    }
    if (f < SV_NF - 1) for (let z = SV_VOID + 2; z < SV_D; z += 2.5) k.box(0, cy - .14, z, SV_ATR * 2, .28, .16, walnut, 23);
    if (f < SV_NF - 1) k.box(0, cy - .05, SV_VOID - .02, SV_ATR * 2, .7, .1, walnutD, 10).box(0, cy - .38, SV_VOID - .05, SV_ATR * 2, .04, .05, brass, 3);
    // 側牆：胡桃木腰板＋黃銅扶手線，上面是奶油色牆板與胡桃木框線；每格之間一根壁柱（黃銅柱頭）
    for (const s of [-1, 1]) {
      const wx = s * (SV_W - .02);
      k.box(wx, Y + .55, SV_D / 2, .04, 1.1, SV_D, walnutD, 25).box(s * (SV_W - .05), Y + 1.12, SV_D / 2, .04, .05, SV_D, brass, 3).box(s * (SV_W - .05), Y + .06, SV_D / 2, .05, .12, SV_D, 0x111111, 2);
      k.box(wx, Y + 3.3, SV_D / 2, .03, 4.4, SV_D, 0xe8dfcf, 41);
      k.box(s * (SV_W - .05), Y + 5.42, SV_D / 2, .06, .16, SV_D, walnut, 10).box(s * (SV_W - .05), Y + 1.3, SV_D / 2, .04, .06, SV_D, walnut, 10);
      for (let z = 4.5; z < SV_D - 1; z += 5) for (const dz of [.55, 4.45]) k.box(s * (SV_W - .05), Y + 3.3, z + dz, .04, 3.6, .05, 0xb89a72, 10);
      for (let z = 4.5; z < SV_D; z += 5) {
        k.box(s * (SV_W - .18), Y + 2.7, z, .3, 5.4, .5, walnutD, 24).box(s * (SV_W - .2), Y + .12, z, .36, .24, .58, brass, 15).box(s * (SV_W - .2), Y + 5.3, z, .36, .2, .58, brass, 15);
      }
    }
    // 後牆：胡桃木直紋
    k.box(0, Y + SV_FH / 2, SV_D - .02, SV_W * 2, SV_FH, .04, 0x3a2414, 10);
    for (let x = -SV_W + .15; x < SV_W; x += .3) k.box(x, Y + SV_FH / 2, SV_D - .06, .12, SV_FH - .2, .04, walnut, 24);
    k.box(0, Y + 1.12, SV_D - .07, SV_W * 2, .05, .04, brass, 3);
  }
  // 屋頂與中庭天窗（霧面發光板＋鋼格）
  k.box(0, SV_ROOF + .25, SV_D / 2, SV_W * 2 + .8, .5, SV_D + .8, 0x1a1410, 2);
  for (let z = 1.5; z < SV_VOID; z += 3) k.box(0, SV_ROOF - .02, z, SV_ATR * 2 - .6, .04, 2.7, 0x6a7a88, 11);
  for (let z = 0; z <= SV_VOID; z += 3) k.box(0, SV_ROOF - .1, z, SV_ATR * 2, .2, .12, 0x1a1b1e, 15);
  for (const x of [-SV_ATR, 0, SV_ATR]) k.box(x, SV_ROOF - .1, SV_VOID / 2, .12, .2, SV_VOID, 0x1a1b1e, 15);
  // 中庭邊的圓柱（貫穿三層，凹槽柱身，每層黃銅柱頭與柱礎）
  for (const s of [-1, 1]) for (const z of [4.5, 14.5, 24.5, 34.5]) {
    const x = s * (SV_ATR + .3);
    k.cyl(x, SV_ROOF / 2, z, .38, .38, SV_ROOF, 20, cream, 10);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.box(x + Math.cos(a) * .38, SV_ROOF / 2, z + Math.sin(a) * .38, .05, SV_ROOF, .05, 0xd8cdb8, 10, 0, -a); }
    for (let f = 0; f < SV_NF; f++) k.cyl(x, f * SV_FH + .15, z, .52, .55, .3, 20, brass, 3).cyl(x, f * SV_FH + SV_FH - .75, z, .5, .4, .3, 20, brass, 3);
    allCirc({ x, z, r: .55 });
  }
  // 二、三樓中庭邊的黃銅欄杆（胡桃木扶手）
  for (let f = 1; f < SV_NF; f++) {
    const Y = f * SV_FH, rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, ry = Math.atan2(ux, uz);
      k.box((x0 + x1) / 2, Y + 1.05, (z0 + z1) / 2, .14, .08, len, walnut, 10, 0, ry).box((x0 + x1) / 2, Y + .12, (z0 + z1) / 2, .06, .05, len, brass, 3, 0, ry);
      for (let d = 0; d <= len; d += .16) k.box(x0 + ux * d, Y + .58, z0 + uz * d, .025, .9, .025, brass, 15);
      for (let d = 0; d <= len; d += 2.4) k.cyl(x0 + ux * d, Y + .55, z0 + uz * d, .045, .045, 1.05, 10, brass, 3).cyl(x0 + ux * d, Y + 1.12, z0 + uz * d, .07, .07, .06, 12, brass, 3);
    };
    rail(-SV_ATR, .3, -SV_ATR, SV_VOID); rail(SV_ATR, .3, SV_ATR, SV_VOID); rail(-SV_ATR, SV_VOID, SV_ATR, SV_VOID);
  }
  // 前面：三層樓高的玻璃立面（黃銅框），一樓中間是玻璃門與門楣
  for (let f = 0; f < SV_NF; f++) {
    const Y = f * SV_FH;
    k.box(0, Y + SV_FH - .25, -.15, SV_W * 2, .5, .3, walnutD, 10);
    for (const x of f ? [-SV_W + .1, -8.5, 0, 8.5, SV_W - .1] : [-SV_W + .1, -8.5, -1.45, 1.45, 8.5, SV_W - .1]) k.box(x, Y + SV_FH / 2, -.1, .14, SV_FH, .16, brass, 15);
    k.box(0, Y + .1, -.1, SV_W * 2, .2, .2, brass, 15);
  }
  k.box(0, 3.05, -.1, 2.9, .12, .2, brass, 3).box(0, 3.4, -.25, 3.4, .5, .5, walnutD, 10);
  for (const s of [-1, 1]) k.box(s * .7, 1.5, -.14, 1.36, 2.9, .04, 0x0a0c10, 10).box(s * .12, 1.15, -.1, .04, 1.1, .05, brass, 3);
  // 入口的大理石地坪紋章：同心圓、十六道黃銅放射線
  { const mx = 0, mz = 6;
    k.cyl(mx, .004, mz, 3.1, 3.1, .008, 64, brass, 15).cyl(mx, .008, mz, 2.95, 2.95, .008, 64, marble, 10).cyl(mx, .012, mz, 2.1, 2.1, .008, 64, 0x3a1c14, 10).cyl(mx, .016, mz, 1.95, 1.95, .008, 64, marble, 10).cyl(mx, .02, mz, .55, .55, .008, 48, marbleD, 10).cyl(mx, .024, mz, .4, .4, .008, 48, brass, 15);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 1.4 : 1.9; k.box(mx + Math.sin(a) * (r / 2 + .3), .026, mz + Math.cos(a) * (r / 2 + .3), .06, .006, r - .6, brass, 15, 0, a); } }
  // 中庭的鎮店之寶：兩層的旋轉台、黃銅環、暖白燈環、絨布繩欄
  k.cyl(SV_HERO.x, .08, SV_HERO.z, 3.7, 3.8, .16, 64, 0x111114, 10).add(new T.TorusGeometry(3.72, .035, 6, 72), brass, 3, tf(SV_HERO.x, .16, SV_HERO.z, Math.PI / 2, 0, 0)).add(new T.TorusGeometry(3.82, .018, 4, 72), 0xffe2b0, 11, tf(SV_HERO.x, .03, SV_HERO.z, Math.PI / 2, 0, 0));
  L[0].circles.push({ x: SV_HERO.x, z: SV_HERO.z, r: 3.8 });
  // 接待櫃台：胡桃木直紋面板、黃銅底座、白大理石檯面、綠色銀行家檯燈
  { const dz = 34;
    k.box(0, .52, dz, 5.2, 1.04, 1, walnut, 10).box(0, 1.07, dz, 5.5, .07, 1.2, marble, 10).box(0, .07, dz - .02, 5.3, .14, 1.04, brass, 15);
    for (let x = -2.45; x <= 2.45; x += .175) k.box(x, .58, dz - .52, .08, .86, .03, walnutD, 10);
    for (const s of [-1, 1]) { k.cyl(s * 1.8, 1.14, dz + .2, .1, .12, .04, 12, brass, 3).cyl(s * 1.8, 1.32, dz + .2, .015, .015, .34, 6, brass, 3).add(new T.CylinderGeometry(.05, .2, .14, 16, 1), 0x1e5a32, 10, tf(s * 1.8, 1.52, dz + .2, 0, 0, Math.PI / 2 * .0)).add(new T.SphereGeometry(.04, 8, 6), 0xffe2b0, 11, tf(s * 1.8, 1.46, dz + .2)); }
    k.box(.5, 1.32, dz + .25, .62, .4, .03, 0x0a0c10, 1, -.15).box(.5, 1.12, dz + .3, .14, .06, .12, 0x1a1b1e, 2).box(-.6, 1.115, dz + .1, .4, .02, .3, cream, 2);
    L[0].boxes.push({ x0: -2.75, x1: 2.75, z0: dz - .6, z1: dz + .6 });
    k.box(0, .48, dz + 1.3, .55, .1, .55, leather, 10).box(0, .85, dz + 1.58, .55, .7, .1, leather, 10).cyl(0, .24, dz + 1.3, .04, .2, .44, 10, brass, 3);
    L[0].circles.push({ x: 0, z: dz + 1.3, r: .35 }); }
  // 休息區（中庭左邊）：酒紅地毯、拉扣皮沙發、胡桃木茶几、兩張皮扶手椅
  { const lx = -3.3, lz = 27;
    k.box(lx, .006, lz, 5, .012, 4.4, 0x5a1a1a, 10).box(lx, .009, lz, 4.6, .012, 4, 0x6e2420, 10);
    for (const [x0, z0, w, d] of [[lx, lz - 2.05, 4.8, .08], [lx, lz + 2.05, 4.8, .08], [lx - 2.35, lz, .08, 4.2], [lx + 2.35, lz, .08, 4.2]]) k.box(x0, .012, z0, w, .006, d, 0xc9a24a, 10);
    const sx = lx - 1.6;
    k.box(sx, .3, lz, .95, .3, 2.6, leather, 10).box(sx - .4, .62, lz, .2, .6, 2.6, leather, 10);
    for (const s of [-1, 1]) k.cyl(sx, .5, lz + s * 1.35, .22, .22, .95, 16, leather, 10, 0, 0, Math.PI / 2);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) k.add(new T.SphereGeometry(.018, 6, 4), 0x2a140a, 2, tf(sx - .29, .55 + j * .2, lz - 1.1 + i * .275));
    for (const s of [-1, 1]) k.box(sx, .07, lz + s * 1.1, .8, .14, .1, walnutD, 10);
    k.box(lx + .1, .42, lz, 1.0, .06, 1.6, walnut, 10).box(lx + .1, .2, lz, .9, .04, 1.4, walnutD, 10);
    for (const [x, z] of [[-.4, -.7], [.4, -.7], [-.4, .7], [.4, .7]]) k.cyl(lx + .1 + x, .21, lz + z, .025, .025, .42, 6, brass, 3);
    k.add(new T.SphereGeometry(.12, 12, 8), 0x2a6a3a, 10, tf(lx + .1, .52, lz - .3)).cyl(lx + .1, .5, lz + .35, .12, .12, .1, 12, cream, 10);
    for (const s of [-1, 1]) { const ax = lx + 1.5, az = lz + s * 1.15; k.box(ax, .28, az, .9, .3, .9, leather, 10).box(ax + .38, .6, az, .14, .55, .9, leather, 10).box(ax, .5, az + .42 * s * 1, .9, .3, .14, leather, 10).box(ax, .5, az - .42 * s, .9, .3, .14, leather, 10); L[0].circles.push({ x: ax, z: az, r: .55 }); }
    L[0].boxes.push({ x0: sx - .55, x1: sx + .48, z0: lz - 1.55, z1: lz + 1.55 }, { x0: lx - .4, x1: lx + .6, z0: lz - .8, z1: lz + .8 });
    // 對面：V8 引擎展示台（黃銅繩欄、說明牌）
    const ex = 3.3, ez = 27;
    k.box(ex, .35, ez, 1.6, .7, 1.2, walnutD, 10).box(ex, .72, ez, 1.7, .04, 1.3, brass, 3);
    k.box(ex, 1.0, ez, .6, .5, .9, 0x3a3e44, 15);
    for (const s of [-1, 1]) { k.box(ex + s * .24, 1.33, ez, .26, .24, .86, 0xb3121a, 10, 0, 0, s * .5); for (let i = 0; i < 4; i++) k.cyl(ex + s * .5, 1.22, ez - .33 + i * .22, .05, .05, .14, 8, 0xd8dce2, 3, 0, 0, Math.PI / 2); }
    k.cyl(ex, 1.55, ez, .22, .22, .1, 20, 0xd8dce2, 3).box(ex, 1.4, ez + .52, .3, .2, .08, 0xd8dce2, 3);
    for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) k.cyl(ex + x, .5, ez + z, .04, .05, 1, 10, brass, 3).add(new T.SphereGeometry(.06, 10, 8), brass, 3, tf(ex + x, 1.02, ez + z)).cyl(ex + x, .03, ez + z, .16, .16, .04, 14, brass, 3);
    L[0].boxes.push({ x0: ex - 1.4, x1: ex + 1.4, z0: ez - 1.1, z1: ez + 1.1 }); }
  // 盆栽棕櫚（入口兩側、電梯旁）
  for (const [x, z, f] of [[-5.1, 1.6, 0], [5.1, 1.6, 0], [-3.4, SV_LIFT.z + 2.8, 0], [3.4, SV_LIFT.z + 2.8, 0], [-3.4, SV_LIFT.z + 2.8, 1], [3.4, SV_LIFT.z + 2.8, 1], [-3.4, SV_LIFT.z + 2.8, 2], [3.4, SV_LIFT.z + 2.8, 2]]) {
    const Y = f * SV_FH;
    k.cyl(x, Y + .4, z, .38, .3, .8, 16, 0x1a1410, 10).cyl(x, Y + .82, z, .4, .4, .05, 16, brass, 3).cyl(x, Y + 1.2, z, .05, .07, .8, 6, 0x5a4028, 2);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; k.add(new T.ConeGeometry(.16, 1.3, 4), 0x2f5a2c, 2, tf(x + Math.cos(a) * .35, Y + 1.7, z + Math.sin(a) * .35, Math.sin(a) * .9, 0, -Math.cos(a) * .9)); }
    L[f].circles.push({ x, z, r: .45 });
  }
  // 二樓後方左邊：會員酒吧（胡桃木吧台、黃銅踏腳桿、背光酒架、高腳椅）
  { const Y = SV_FH, bz = 47.2;
    k.box(-12.5, Y + .55, bz, 6, 1.1, .7, walnut, 10).box(-12.5, Y + 1.13, bz, 6.2, .06, .9, marble, 10).box(-12.5, Y + .2, bz - .42, 6, .04, .04, brass, 3);
    for (let x = -15.4; x <= -9.6; x += .2) k.box(x, Y + .6, bz - .36, .08, .9, .02, walnutD, 10);
    k.box(-12.5, Y + 2.1, SV_D - .25, 6.4, 3, .4, walnutD, 10);
    for (let r = 0; r < 4; r++) { k.box(-12.5, Y + 1.0 + r * .6, SV_D - .5, 6, .04, .3, brass, 3).box(-12.5, Y + 1.25 + r * .6, SV_D - .44, 6, .48, .02, 0xffb060, 11);
      for (let i = 0; i < 26; i++) k.cyl(-15.3 + i * .23, Y + 1.15 + r * .6, SV_D - .5, .035, .045, .26 - (i % 3) * .04, 8, [0x5a2a10, 0x1a4a2a, 0x8a6a2a, 0x2a1a3a, 0xd8c8a0][(i + r) % 5], 10); }
    for (let i = 0; i < 5; i++) { const x = -15 + i * 1.2; k.cyl(x, Y + .4, bz - .95, .04, .04, .8, 8, brass, 3).cyl(x, Y + .8, bz - .95, .2, .2, .08, 14, leather, 10).cyl(x, Y + .02, bz - .95, .2, .2, .04, 14, brass, 3); L[1].circles.push({ x, z: bz - .95, r: .25 }); }
    L[1].boxes.push({ x0: -15.6, x1: -9.4, z0: bz - .45, z1: bz + .45 }, { x0: -15.8, x1: -9.2, z0: SV_D - .6, z1: SV_D });
    svSign('SV_BAR', -12.5, Y + 4.1, SV_D - .08, Math.PI, 3.6, .9, 1.6); }
  // 二樓後方右邊：撞球檯與三盞綠罩吊燈、球桿架
  { const Y = SV_FH, px = 12.3, pz = 47.5;
    k.box(px, Y + .78, pz, 1.5, .06, 2.7, 0x1e6a3a, 2).box(px, Y + .8, pz, 1.66, .1, 2.86, walnut, 10).box(px, Y + .5, pz, 1.4, .5, 2.5, walnutD, 10);
    for (const [x, z] of [[-.6, -1.2], [.6, -1.2], [-.6, 1.2], [.6, 1.2]]) k.box(px + x, Y + .3, pz + z, .2, .6, .2, walnut, 10);
    for (let i = 0; i < 9; i++) k.add(new T.SphereGeometry(.028, 10, 8), [0xf2f0ea, 0xe8c020, 0x1f4fd8, 0xc81010, 0x6a2a8a, 0xe8782a, 0x1a6a3a, 0x7a1c1c, 0x111111][i], 0, tf(px - .3 + (i % 3) * .07, Y + .84, pz + .6 + Math.floor(i / 3) * .065));
    for (let i = -1; i <= 1; i++) { k.cyl(px, Y + 3.2, pz + i * .9, .006, .006, 2.6, 4, 0x111111, 15); k.add(new T.ConeGeometry(.24, .2, 16, 1), 0x1e5a32, 10, tf(px, Y + 1.9, pz + i * .9)); k.add(new T.SphereGeometry(.06, 8, 6), 0xffe2b0, 11, tf(px, Y + 1.78, pz + i * .9)); }
    k.box(SV_W - .1, Y + 1.6, pz, .1, 1.6, 1.2, walnut, 10);
    for (let i = 0; i < 6; i++) k.cyl(SV_W - .2, Y + 1.5, pz - .45 + i * .18, .012, .02, 1.45, 6, 0xd8b078, 10);
    L[1].boxes.push({ x0: px - .85, x1: px + .85, z0: pz - 1.45, z1: pz + 1.45 }); }
  // 三樓後方左邊：點唱機、老加油機、SINCE 1958 霓虹
  { const Y = 2 * SV_FH, gx = -15.9, gz = 49.6;
    k.box(gx, Y + .95, gz, .7, 1.7, .5, 0xb3121a, 0, 0, Math.PI / 2).box(gx + .26, Y + 1.25, gz, .02, .5, .4, cream, 2).box(gx, Y + 1.83, gz, .74, .06, .54, 0xd8dce2, 3).add(new T.SphereGeometry(.24, 16, 12), 0xfff4e0, 11, tf(gx, Y + 2.1, gz));
    L[2].boxes.push({ x0: gx - .35, x1: gx + .35, z0: gz - .4, z1: gz + .4 });
    svSign('SV_1958', -12.5, Y + 3.6, SV_D - .08, Math.PI, 2.8, .93, 1.6);
    // 閱覽角：皮扶手椅、邊桌、立燈、書架
    for (const x of [-13.6, -11.4]) { k.box(x, Y + .28, 47.6, .9, .3, .9, leather, 10).box(x, Y + .6, 48.0, .9, .6, .14, leather, 10); L[2].circles.push({ x, z: 47.6, r: .55 }); }
    k.cyl(-12.5, Y + .3, 47.4, .3, .3, .04, 16, walnut, 10).cyl(-12.5, Y + .15, 47.4, .03, .03, .3, 6, brass, 3);
    k.cyl(-10.3, Y + .8, 48.6, .02, .02, 1.6, 6, brass, 3).add(new T.CylinderGeometry(.14, .22, .3, 16, 1, true), 0xe8dcc0, 11, tf(-10.3, Y + 1.68, 48.6));
    k.box(-8.2, Y + 1.5, SV_D - .25, 2.6, 3, .4, walnutD, 10);
    for (let r = 0; r < 5; r++) { k.box(-8.2, Y + .3 + r * .6, SV_D - .3, 2.5, .04, .34, walnut, 10); for (let i = 0; i < 18; i++) k.box(-9.35 + i * .13, Y + .5 + r * .6, SV_D - .33, .08, .3 + (i % 4) * .03, .24, [0x5a1a1a, 0x1a3a5a, 0x2a4a2a, 0x8a6a3a, 0x3a2a1a][(i * 3 + r) % 5], 2); }
    L[2].boxes.push({ x0: -9.6, x1: -6.8, z0: SV_D - .5, z1: SV_D }); }
  // 三樓後方右邊：觀景沙發（面向中庭）
  { const Y = 2 * SV_FH;
    k.box(12, Y + .3, 46.2, 3, .3, .95, leather, 10).box(12, Y + .62, 46.6, 3, .6, .2, leather, 10);
    for (const s of [-1, 1]) k.cyl(12 + s * 1.55, Y + .52, 46.2, .2, .2, .9, 16, leather, 10, Math.PI / 2, 0, 0);
    k.box(12, Y + .4, 44.8, 1.2, .05, .6, walnut, 10);
    L[2].boxes.push({ x0: 10.3, x1: 13.7, z0: 45.7, z1: 46.8 }, { x0: 11.4, x1: 12.6, z0: 44.5, z1: 45.1 }); }
  S.add(new T.Mesh(k.build(), MAT.ux));   // 地板是拋光大理石、胡桃木照木紋方向、奶油色牆板是漆面灰泥（07-kitx.js 的程式紋理）
  // 三樓的點唱機（interior_props 的 jukebox；http(s) 下換成實體模型）
  const JUKE = [{ x: -16.4, y: 2 * SV_FH, z: 46.8, ry: Math.PI / 2 }];
  propSwap('show', instancedIn(S, prop('jukebox'), MAT.uber, JUKE), 'jukebox', JUKE);
  show.lv[2].boxes.push({ x0: -16.95, x1: -15.9, z0: 46.2, z1: 47.4 });
}
// ─── 壁燈（每根壁柱一盞黃銅壁燈、霧面燈罩）與鎮店之寶四周的紅絨布繩欄 ───
{
  const k = new Kit(), brass = 0xc9a24a;
  for (let f = 0; f < SV_NF; f++) for (const s of [-1, 1]) for (let z = 4.5; z < SV_D; z += 5) {
    const Y = f * SV_FH, x = s * (SV_W - .38);
    k.box(x, Y + 3.95, z, .26, .04, .04, brass, 3).cyl(s * (SV_W - .5), Y + 4.12, z, .09, .06, .2, 12, 0xfff0d8, 11).cyl(s * (SV_W - .5), Y + 3.99, z, .07, .07, .04, 12, brass, 3).box(s * (SV_W - .33), Y + 3.95, z, .04, .22, .12, brass, 3);
  }
  const R = 4.5, N = 10, rope = [];
  for (let i = 0; i < N; i++) {
    const a = (i + .5) / N * Math.PI * 2, x = SV_HERO.x + Math.cos(a) * R, z = SV_HERO.z + Math.sin(a) * R;
    if (z < SV_HERO.z - R + .6 && Math.abs(x) < 1.6) continue;   // 正面留一個缺口
    k.cyl(x, .5, z, .04, .05, 1, 10, brass, 3).add(new T.SphereGeometry(.065, 10, 8), brass, 3, tf(x, 1.03, z)).cyl(x, .025, z, .17, .17, .05, 16, brass, 3);
    rope.push([x, z, a]);
  }
  for (let i = 0; i < rope.length; i++) {
    const [x0, z0, a0] = rope[i], [x1, z1, a1] = rope[(i + 1) % rope.length];
    if (Math.abs(((a1 - a0 + Math.PI * 2) % (Math.PI * 2))) > Math.PI * 2 / N * 1.5) continue;   // 缺口兩邊不連
    const c = new T.CatmullRomCurve3([V3(x0, .92, z0), V3((x0 + x1) / 2, .74, (z0 + z1) / 2), V3(x1, .92, z1)]);
    k.add(new T.TubeGeometry(c, 10, .022, 6), 0x7a0e1e, 10);
  }
  showScene.add(new T.Mesh(k.build(), MAT.uber));
}
// ─── 水晶吊燈：中庭三盞，從屋頂垂下（三層黃銅環、燈泡、水晶墜） ───
const SV_CHAND = [9.5, 21.5, 33.5];
{
  const k = new Kit(), brass = 0xc9a24a;
  for (const z of SV_CHAND) {
    const top = SV_ROOF - .2, cy = 12.6;
    k.cyl(0, (top + cy + 1.4) / 2, z, .02, .02, top - cy - 1.4, 6, 0x111111, 15).cyl(0, cy + 1.3, z, .12, .08, .3, 16, brass, 3).cyl(0, cy + .4, z, .06, .06, 1.8, 10, brass, 3);
    [[1.7, cy + .15, 14], [1.25, cy + .65, 10], [.8, cy + 1.05, 8]].forEach(([r, y, n]) => {
      k.add(new T.TorusGeometry(r, .035, 6, 48), brass, 3, tf(0, y, z, Math.PI / 2, 0, 0));
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, bx = Math.cos(a) * r, bz = Math.sin(a) * r; k.cyl(bx, y + .09, z + bz, .03, .03, .16, 8, brass, 3).add(new T.SphereGeometry(.07, 10, 8), 0xfff0d8, 11, tf(bx, y + .22, z + bz)); k.add(new T.OctahedronGeometry(.05), 0xe8f0ff, 10, tf(bx, y - .16, z + bz)); }
    });
    k.add(new T.OctahedronGeometry(.16), 0xe8f0ff, 10, tf(0, cy - .55, z));
  }
  showScene.add(new T.Mesh(k.build(), MAT.uber));
}
// ─── 玻璃電梯：黃銅框的井道貫穿三層，車廂停在玩家所在的樓層 ───
{
  const k = new Kit(), brass = 0xc9a24a, walnut = 0x4a2a16, z0 = SV_LIFT.z + 1.2, z1 = SV_LIFT.z + 4.8;
  for (const x of [-1.62, 1.62]) for (const z of [z0, z1]) k.box(x, SV_ROOF / 2, z, .1, SV_ROOF, .1, brass, 3);
  for (let y = 0; y <= SV_ROOF; y += SV_FH / 2) for (const z of [z0, z1]) k.box(0, y + .05, z, 3.24, .08, .08, brass, 3);
  for (let y = 0; y <= SV_ROOF; y += SV_FH / 2) for (const x of [-1.62, 1.62]) k.box(x, y + .05, (z0 + z1) / 2, .08, .08, z1 - z0, brass, 3);
  k.box(0, SV_ROOF / 2, z1 - .05, 3.2, SV_ROOF, .06, 0x2a1c12, 10);
  // 每層的電梯口：門框、樓層牌
  for (let f = 0; f < SV_NF; f++) { const Y = f * SV_FH; k.box(0, Y + 2.65, z0 - .05, 2.4, .2, .14, brass, 3); for (const s of [-1, 1]) k.box(s * 1.1, Y + 1.3, z0 - .05, .14, 2.6, .14, brass, 3); svSign('SV_F' + f, 0, Y + 3.25, z0 - .14, 0, 3.4, .64, 1.1); }
  showScene.add(new T.Mesh(k.build(), MAT.uber));
  const ck = new Kit();
  ck.box(0, .04, 0, 3, .08, 3.3, 0x2a1c12, 10).box(0, 2.6, 0, 3, .08, 3.3, 0x2a1c12, 10).box(0, 2.56, 0, 1.6, .02, 1.6, 0xfff0d8, 11);
  for (const s of [-1, 1]) ck.box(s * 1.45, 1.3, .6, .06, 2.5, 2, walnut, 10).box(s * 1.42, 1, .6, .03, .05, 2, brass, 3);
  ck.box(0, 1.3, 1.6, 3, 2.5, .06, walnut, 10).box(0, 1.6, 1.56, 1.2, 1.4, .02, 0xb8a888, 3);
  const cab = new T.Mesh(ck.build(), MAT.uber); cab.position.set(0, 0, (z0 + z1) / 2); showScene.add(cab); show.cab = cab;
}
// 後牆中央：VELOCE MOTORS 大招牌與銅牌
svSign('VELOCE', 0, 15.6, SV_D - .1, Math.PI, 10, 2.5, 1.7);
svSign('SV_PLAQUE', 0, .72, 33.47, Math.PI, 1.9, .48, .8);   // 接待櫃台正面的銅牌（朝門口）
svSign('SV_V8', 3.3, .4, 26.37, Math.PI, 1.3, .33, .8);   // 引擎展示台正面的說明牌
// 前面的玻璃立面：雨夜街景（和酒吧的雨窗同一個 shader），每層四片
for (let f = 0; f < SV_NF; f++) for (const [x, w] of f ? [[-12.75, 8.4], [-4.25, 8.4], [4.25, 8.4], [12.75, 8.4]] : [[-12.75, 8.4], [-4.95, 6.9], [4.95, 6.9], [12.75, 8.4]]) {
  const m = new T.Mesh(new T.PlaneGeometry(w, SV_FH - .6), new T.ShaderMaterial({ name: 'rainWin', uniforms: shared(ALLU), vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: WINDOW_FS }));
  m.position.set(x, f * SV_FH + SV_FH / 2 - .1, -.25); showScene.add(m);
}

// ─── 車：每格一個黑色亮漆圓台（黃銅環、暖白燈環）、台前一支規格立牌、牆上一張裱框海報 ───
{
  const k = new Kit(), brass = 0xc9a24a;
  let pi = 0;
  SHOW_FLOORS.forEach((F, f) => {
    const Y = f * SV_FH;
    for (const [s, ids] of [[-1, F.L], [1, F.R]]) SV_SLOT.forEach((z, i) => {
      const x = s * SV_CX, id = ids[i];
      // 牆上的海報（每格都有，空格也掛）與畫框燈
      const wx = s * (SV_W - .09);
      k.box(wx, Y + 3.3, z, .06, 2.3, 1.62, 0x1a1008, 10).box(s * (SV_W - .12), Y + 3.3, z, .02, 2.2, 1.52, brass, 3);
      svSign('SV_P' + (pi++ % POSTERS.length), s * (SV_W - .14), Y + 3.3, z, -s * Math.PI / 2, 1.4, 2.1, .85);
      k.box(s * (SV_W - .3), Y + 4.55, z, .3, .06, .8, brass, 3).box(s * (SV_W - .42), Y + 4.51, z, .06, .02, .7, 0xfff0d8, 11);
      if (!id || !CARS[id]) return;
      k.cyl(x, Y + .07, z, 2.42, 2.45, .14, 56, 0x0c0c0e, 10).add(new T.TorusGeometry(2.43, .025, 6, 64), brass, 3, tf(x, Y + .14, z, Math.PI / 2, 0, 0)).add(new T.TorusGeometry(2.47, .014, 4, 64), 0xffe2b0, 11, tf(x, Y + .02, z, Math.PI / 2, 0, 0));
      // 規格立牌：走道邊，牌面朝走道
      const px = s * (SV_CX - 3.25), pz = z + 1.6, ry = -s * Math.PI / 2;
      k.box(px, Y + .45, pz, .05, .9, .05, brass, 3).box(px, Y + .02, pz, .3, .04, .3, 0x111214, 2);
      k.box(px, Y + .92, pz, .44, .3, .03, 0x15100a, 10, -.6, ry).box(px - s * .012, Y + .93, pz, .38, .24, .02, 0x4a4030, 11, -.6, ry);
      show.lv[f].circles.push({ x: px, z: pz, r: .18 }, { x, z, r: 2.4, car: 1 });
      show.cars.push({ id, x, z, y: Y + .14, yaw: -s * SV_YAW, lv: f, spin: false });
      show.lv[f].lights.push({ x: x * .9, y: Y + 4.9, z, col: lin(0xfff0dc), r: 8.5, i: 1.6 });
      k.cyl(x * .9, Y + SV_FH - .52, z, .22, .22, .02, 20, 0xfff4e4, 11);
    });
  });
  showScene.add(new T.Mesh(k.build(), MAT.uber));
  show.cars.push({ id: SV_HERO.id, x: SV_HERO.x, z: SV_HERO.z, y: .16, yaw: Math.PI, lv: 0, spin: true });
  for (const c of show.cars) {
    const m = carObject(c.id);
    if (c.spin) {
      const g = new T.Group(); g.position.set(c.x, c.y, c.z); g.rotation.y = c.yaw;
      const tk = new Kit().cyl(0, .05, 0, 3.4, 3.45, .1, 64, 0x2a1a10, 10).add(new T.TorusGeometry(3.4, .03, 6, 72), brass, 3, tf(0, .1, 0, Math.PI / 2, 0, 0));
      for (let i = 0; i < 16; i++) tk.box(Math.cos(i / 16 * Math.PI * 2) * 2.9, .102, Math.sin(i / 16 * Math.PI * 2) * 2.9, .4, .006, .04, brass, 15, 0, -i / 16 * Math.PI * 2);
      g.add(new T.Mesh(tk.build(), MAT.uber));
      m.position.y = .1; g.add(m); showScene.add(g);
      show.spin.push({ g, c, a0: c.yaw });
    } else { m.position.set(c.x, c.y, c.z); m.rotation.y = c.yaw; showScene.add(m); }
  }
}
// ─── 人：業務 Vale、休息區與展廊的客人、酒保、打撞球的人 ───
{
  const cr = crowd(8); const rc = rng(1958);
  const list = [
    [ANIM.talk, SELLER.x, 0, SELLER.z, Math.PI, { top: lin(0x1b2230), bot: lin(0x15171c), skin: SKINS[1], hair: lin(0x1a1410), longHair: 0, coat: 1, skirt: 0, hat: 0, glowI: 0 }, 0],
    [ANIM.sit, -4.75, -.12, 26.4, Math.PI / 2, null, 0], [ANIM.idle, -8.6, 0, 14.6, -Math.PI / 2, null, 0], [ANIM.talk, 8.4, 0, 30.4, Math.PI / 2, null, 0],
    [ANIM.bartend, -12.5, SV_FH, 49.6, Math.PI, { top: lin(0xe8e4dc), bot: lin(0x101012), skin: SKINS[2], hair: lin(0x2a1a10), longHair: 1, coat: 0, skirt: 0, hat: 0, glowI: 0 }, 1],
    [ANIM.sit, -13.2, SV_FH, 46.25, 0, null, 1], [ANIM.idle, 10.4, SV_FH, 48.3, Math.PI / 2, null, 1], [ANIM.talk, 8.6, 2 * SV_FH, 21.2, Math.PI / 2, null, 2],
  ];
  list.forEach(([a, x, y, z, yaw, look, f], i) => { cr.look(i, look || { r: rc, glowI: 0 }); cr.anim(i, a, rc() * 10, 1); cr.place(i, x, y, z, yaw); if (a !== ANIM.sit && i) show.lv[f].circles.push({ x, z, r: .3 }); });
  cr.flush(); showScene.add(cr.mesh); show.people = cr;
}
// ─── 燈：每層都看得到的吊燈與天窗，加上各層自己的燈（展車崁燈在上面已經加了） ───
for (const l of show.lv) l.lights.push(...SV_CHAND.map(z => ({ x: 0, y: 12.2, z, col: lin(0xffe6c0), r: 18, i: 2.4 })));
show.lv[0].lights.push(
  { x: SV_HERO.x, y: 6, z: SV_HERO.z, col: lin(0xfff4e4), r: 10, i: 2.6 }, { x: 0, y: 3, z: 3, col: lin(0xffe0b8), r: 10, i: 1.2 },
  { x: 0, y: 2.6, z: 34.6, col: lin(0xffe0b0), r: 7, i: 1.3 }, { x: -3.3, y: 2.8, z: 27, col: lin(0xffc890), r: 7, i: 1.2 }, { x: 3.3, y: 2.8, z: 27, col: lin(0xfff0dc), r: 6, i: 1.4 },
  { x: 0, y: 2.6, z: SV_LIFT.z, col: lin(0xffe0b8), r: 6, i: 1 },
);
show.lv[1].lights.push({ x: -12.5, y: SV_FH + 2.4, z: 49.5, col: lin(0xffb060), r: 8, i: 1.6 }, { x: 12.3, y: SV_FH + 2, z: 47.5, col: lin(0xfff0d0), r: 7, i: 1.6 }, { x: 0, y: SV_FH + 2.6, z: SV_LIFT.z, col: lin(0xffe0b8), r: 6, i: 1 }, { x: -12.5, y: SV_FH + 4, z: 51, col: lin(0xff9a4a), r: 5, i: 1 });
show.lv[2].lights.push({ x: -12.5, y: 2 * SV_FH + 3.4, z: 51, col: lin(0x2cf2d8), r: 6, i: 1 }, { x: -15.4, y: 2 * SV_FH + 2, z: 48, col: lin(0xff4fb0), r: 6, i: 1.1 }, { x: -10.3, y: 2 * SV_FH + 1.6, z: 48.6, col: lin(0xffd0a0), r: 5, i: 1 }, { x: 12, y: 2 * SV_FH + 2.6, z: 45.6, col: lin(0xffe0b8), r: 7, i: 1.1 }, { x: 0, y: 2 * SV_FH + 2.6, z: SV_LIFT.z, col: lin(0xffe0b8), r: 6, i: 1 });

VENUES.show = { scene: showScene, data: show.lv[0], lvs: show.lv, lv: 0, lvY: 0, spawn: { x: 0, z: 2.2, yaw: 0 }, name: 'VELOCE MOTORS', toast: 'VELOCE MOTORS 疾風車行', dist: '中城 · 9 St', ceil: SV_ROOF - .6, door: WP(DEAL_X, DEAL_Z), out: spotW({ x: DEAL_X, z: DEAL_Z + 1.3, yaw: Math.PI }),
  // 相機天花板：中庭挑空到天窗，展廊是上一層的樓板底
  ceilAt: (x, z) => Math.abs(x) < SV_ATR && z < SV_VOID ? SV_ROOF - .6 : (VENUES.show.lv + 1) * SV_FH - .9 };
// 換層：碰撞表、燈、地板高度
function showLevel(k) {
  const V = VENUES.show; V.lv = k; V.lvY = k * SV_FH; V.data = show.lv[k];
  if (player.where === 'show') { activeBoxes = V.data.boxes; activeCircles = V.data.circles; colDirty(); player.y = V.lvY; }
}
// 電梯：選樓層 → 淡出換層 → 站在那一層的電梯口
function showLift() {
  const V = VENUES.show;
  dialog('VELOCE MOTORS · 電梯', SHOW_FLOORS.map((f, i) => (i === V.lv ? '▶ ' : '　 ') + f.name).join('\n'), [
    ...SHOW_FLOORS.map((f, i) => ({ t: i === V.lv ? `${i + 1}F（在這一層）` : `到 ${i + 1}F`, fn: () => { closeDialog(); if (i !== V.lv) transition(() => { showLevel(i); player.x = SV_LIFT.x; player.z = SV_LIFT.z - .4; player.yaw = Math.PI; player.v = 0; camState.yaw = Math.PI; camState.pitch = .12; toast(f.name); }); } })),
    { t: '不搭了', fn: closeDialog },
  ]);
}
// 每幀（65-motors.js 的 updateMotors）：轉台、電梯車廂停在玩家那一層；離開展示廳就回到一樓
function updateShow(dt, t) {
  const V = VENUES.show;
  if (player.where !== 'show') { if (V.lv && !fading) showLevel(0); return; }
  for (const s of show.spin) s.g.rotation.y = s.a0 + t * .22;
  if (show.cab) show.cab.position.y = damp(show.cab.position.y, V.lv * SV_FH, 3, dt);
}
