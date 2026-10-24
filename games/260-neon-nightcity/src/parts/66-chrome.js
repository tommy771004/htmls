// ═══ CHROME WORKS 改裝廠室內：自己的車停在門口按 E 開進來，車擺在中間的升降機上，走過去按 E 打開改裝選單 ═══
// 套件照 GTA V 洛聖都改車王（Los Santos Customs）的性能分類與分級：引擎 EMS 1–4 級、街頭／運動／賽車變速箱與煞車、
// 降低／街頭／運動／競技懸吊、渦輪調校、20–100% 裝甲、防彈胎，再加尾翼（GTA V 的尾翼會加一點循跡）。
// 價格照 GTA Online 洛聖都改車王的基本價（尾翼是自訂的）；效果是自己挑的具名常數（MOD_FX），列在 README。
// 裝過的套件存在 motors.mods[車]（nc260.motors 第 10 版），跟著車走：換車、試駕結束、從車庫開出來都由 applyCar 的 carHooks 重新疊上去。
ENV.chrome = { lampOn: 0, wet: 0, fogDen: .016, fog: 0x17120e, fogHi: 0x241a14, top: 0x8a7a68, bot: 0x3a2c24 };   // 暖色的美式改裝店

// 每個套件：名稱、各級 [名稱, 價格]；第 0 級是原廠（免費換回去）。bike：機車能不能裝
const MODS = {
  eng: { name: '引擎', bike: 1, lv: [['原廠', 0], ['EMS 改裝 1 級', 9000], ['EMS 改裝 2 級', 12500], ['EMS 改裝 3 級', 18000], ['EMS 改裝 4 級', 33500]] },
  trn: { name: '變速箱', bike: 1, lv: [['原廠', 0], ['街頭變速箱', 29500], ['運動變速箱', 32500], ['賽車變速箱', 40000]] },
  tur: { name: '渦輪增壓', bike: 1, lv: [['無', 0], ['渦輪調校', 50000]] },
  brk: { name: '煞車', bike: 1, lv: [['原廠', 0], ['街頭煞車', 20000], ['運動煞車', 27000], ['賽車煞車', 35000]] },
  sus: { name: '懸吊', bike: 1, lv: [['原廠', 0], ['降低懸吊', 1000], ['街頭懸吊', 2000], ['運動懸吊', 3400], ['競技懸吊', 4400]] },
  spl: { name: '尾翼', bike: 0, lv: [['原廠', 0], ['碳纖維鴨尾', 1500], ['GT 賽車尾翼', 3500]] },
  arm: { name: '裝甲', bike: 1, lv: [['無', 0], ['裝甲升級 20%', 2500], ['裝甲升級 40%', 5000], ['裝甲升級 60%', 7500], ['裝甲升級 80%', 10000], ['裝甲升級 100%', 12500]] },
  tir: { name: '輪胎', bike: 1, lv: [['原廠', 0], ['防彈胎', 25000]] },
};
const MOD_IDS = Object.keys(MODS);
// 各級的效果（乘在這台車原廠換算出來的數值上）：
//   eng 加速、top 極速（由 vmaxFor 重新反推）、brk 煞車減速度、grip 側向抓地、turn 轉向、armorK 受到的傷害、rideY 車身下降（m）
const MOD_FX = {
  eng: { eng: [1, 1.05, 1.1, 1.15, 1.22], top: [1, 1.01, 1.02, 1.03, 1.04] },
  trn: { eng: [1, 1.04, 1.07, 1.1], top: [1, 1, 1.01, 1.02] },
  tur: { eng: [1, 1.12], top: [1, 1.02] },
  brk: { brk: [1, 1.12, 1.24, 1.36] },
  sus: { grip: [1, 1.01, 1.02, 1.04, 1.06], turn: [1, 1.01, 1.02, 1.04, 1.06], rideY: [0, -.03, -.045, -.06, -.08] },
  spl: { grip: [1, 1.02, 1.04] },
  arm: { armorK: [1, .85, .7, .58, .47, .38] },
  tir: {},
};
const modsOf = id => motors.mods[id] || {};
const modCan = (id, k) => MODS[k].bike || !CARS[id].bike;
// 讀檔時檢查：只留認得的套件與範圍內的整數等級，等級 0 不存
function modSanitize() {
  for (const id in motors.mods) {
    const m = motors.mods[id], out = {};
    if (CARS[id] && CARS[id].glb) for (const k of MOD_IDS) if (Number.isInteger(m[k]) && m[k] > 0 && m[k] < MODS[k].lv.length && modCan(id, k)) out[k] = m[k];
    if (Object.keys(out).length) motors.mods[id] = out; else delete motors.mods[id];
  }
}
modSanitize();
// 這台車裝了套件之後的數值（不碰載具；改裝選單拿來預覽）
function modStats(id, m = modsOf(id)) {
  const c = CARS[id], f = k => (key, d = 1) => (MOD_FX[k][key] || [])[m[k] || 0] ?? d;
  let eng = c.eng, top = 1, brk = c.brk || 16, grip = c.grip, turn = c.turn || 1.05, armorK = 1, rideY = 0;
  for (const k of MOD_IDS) { const g = f(k); eng *= g('eng'); top *= g('top'); brk *= g('brk'); grip *= g('grip'); turn *= g('turn'); armorK *= g('armorK'); rideY += g('rideY', 0); }
  const kmh = (c.kmh || c.vmax * 3.6 * .78) * top;
  return { eng, kmh, vmax: c.kmh ? vmaxFor(kmh, eng) : c.vmax * top, brk, grip, turn, armorK, rideY, bp: !!m.tir };
}
// applyCar 換好車之後（30-vehicles.js 的 carHooks）：玩家座駕疊上改裝；試駕的車是車行的原廠車
function modApply(v, id = v.carId) {
  if (v !== kestrel) return;
  const S = modStats(id, motors.test ? {} : modsOf(id));
  v.eng = S.eng; v.vmax = S.vmax; v.brk = S.brk; v.grip = S.grip; v.turn = S.turn; v.armorK = S.armorK; v.rideY = S.rideY; v.bpTires = S.bp ? 1 : 0;
}
carHooks.push(modApply);
modApply(kestrel);   // 65-motors.js 開場已經照存檔 applyCar 過一次（那時這個 hook 還沒掛上）

// ─── 改裝廠室內（高質感美式改裝店）：門在 z = 0，x −12..12、z 0..CD，挑高 6.4 m ───
// 紅磚牆＋白色浪板、黑色鋼桁架與琺瑯吊燈、拋光水泥地；中間升降機下是黑白棋盤格，後牆是 SPEED SHOP 琺瑯招牌、紅色工具櫃與賽車格子旗，
// 右後方的展示台停一台美式肌肉車（Challenger），左前是皮沙發、輪胎茶几、點唱機與老加油機，牆上掛機油牌、公路盾牌與霓虹字；
// 左後是烤漆房，右邊是輪胎牆、輪框展示牆與技師 Rook 的木櫃台。招牌名稱都是原創（20-props.js 的 CW_* 格子）
const CD = 26, CW_H = 6.4, CHROME_CAR = { x: 0, z: 11.5, yaw: Math.PI }, ROOK = { x: 8.6, z: 6.4 }, CW_DISP = { x: 3.8, z: 18.9, yaw: -2.5 };
const chromeScene = new T.Scene();
const chrome = { boxes: [], circles: [], lights: [], people: null, show: null, parked: false };
// 美式招牌（琺瑯鐵牌、圓形機油牌、公路盾牌、霓虹草寫字；名稱都是原創）畫在自己的 1024 貼圖上：20-props.js 的招牌圖集已經滿了
const cwAtlas = document.createElement('canvas'); cwAtlas.width = cwAtlas.height = 1024;
const cwCells = {};
let cwX = 0, cwY = 0, cwRow = 0;
function cwCell(name, w, h, draw) {
  if (cwX + w > 1024) { cwX = 0; cwY += cwRow + 2; cwRow = 0; }
  const c = cwAtlas.getContext('2d'), x = cwX, y = cwY; cwX += w + 2; cwRow = Math.max(cwRow, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); draw(c, w, h); c.restore();
  cwCells[name] = { u0: x / 1024, v0: 1 - (y + h) / 1024, u1: (x + w) / 1024, v1: 1 - y / 1024 };
  if (y + h > 1024) console.warn('chrome sign atlas overflow', name);
}
cwCell('CW_SPEED', 512, 192, (c, w, h) => {
  plate(c, w, h, '#efe4c8'); c.strokeStyle = '#b3201c'; c.lineWidth = 12; c.strokeRect(10, 10, w - 20, h - 20); c.lineWidth = 3; c.strokeRect(24, 24, w - 48, h - 48);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1b2a4a'; c.font = `800 26px ${FONT_C}`; c.fillText('CHROME WORKS', w / 2, 50);
  c.fillStyle = '#b3201c'; c.font = `900 70px ${FONT_B}`; c.fillText('SPEED SHOP', w / 2, h * .54);
  c.fillStyle = '#1b2a4a'; c.font = `700 20px ${FONT_C}`; c.fillText('EST. 1987  ·  CUSTOM  ·  PAINT  ·  PERFORMANCE', w / 2, h - 40);
});
cwCell('CW_OIL', 256, 256, (c, w, h) => {
  plate(c, w, h, '#0d0d10'); c.fillStyle = '#f2ead6'; c.beginPath(); c.arc(128, 128, 122, 0, 6.2832); c.fill();
  c.fillStyle = '#167a3c'; c.beginPath(); c.arc(128, 128, 108, 0, 6.2832); c.fill();
  c.fillStyle = '#f2ead6'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832 - 1.5708, r = i % 2 ? 26 : 62; c.lineTo(128 + Math.cos(a) * r, 120 + Math.sin(a) * r); } c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f2ead6'; c.font = `800 26px ${FONT_C}`; c.fillText('NIGHTHAWK', 128, 46); c.font = `700 22px ${FONT_C}`; c.fillText('MOTOR OIL', 128, 204);
});
cwCell('CW_ROUTE', 256, 256, (c, w, h) => {
  plate(c, w, h, '#0d0d10'); const sh = () => { c.beginPath(); c.moveTo(28, 40); c.quadraticCurveTo(128, 0, 228, 40); c.lineTo(222, 150); c.quadraticCurveTo(190, 222, 128, 248); c.quadraticCurveTo(66, 222, 34, 150); c.closePath(); };
  c.fillStyle = '#f4f1ea'; sh(); c.fill(); c.lineWidth = 9; c.strokeStyle = '#141414'; sh(); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#141414'; c.font = `800 30px ${FONT_C}`; c.fillText('NEON CITY', 128, 64); c.font = `900 120px ${FONT_C}`; c.fillText('9', 128, 150);
});
cwCell('CW_GAS', 256, 160, (c, w, h) => {
  plate(c, w, h, '#f2c21b'); c.fillStyle = '#121212'; for (let i = -3; i < 12; i++) { c.beginPath(); c.moveTo(i * 28, 0); c.lineTo(i * 28 + 14, 0); c.lineTo(i * 28 - 2, 22); c.lineTo(i * 28 - 16, 22); c.fill(); c.beginPath(); c.moveTo(i * 28, h - 22); c.lineTo(i * 28 + 14, h - 22); c.lineTo(i * 28 - 2, h); c.lineTo(i * 28 - 16, h); c.fill(); }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 46px ${FONT_B}`; c.fillText('HIGH', w / 2, 60); c.font = `800 34px ${FONT_C}`; c.fillText('OCTANE  ·  100', w / 2, 106);
});
cwCell('CW_HOT', 512, 128, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, 'Hot Rods & Customs', w / 2, h * .5, 64, '#ff4f9a', FONT_S, 700); });
cwCell('CW_OPEN', 256, 96, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, 'OPEN', 92, h * .5, 54, '#ff3a2a', FONT_C, 800); neon(c, '24H', 196, h * .5, 40, '#3aa0ff', FONT_C, 800); });
const cwTex = new T.CanvasTexture(cwAtlas);
cwTex.colorSpace = T.SRGBColorSpace; cwTex.anisotropy = 8; cwTex.minFilter = T.LinearMipmapLinearFilter;
const MAT_CW = MAT_SIGN.clone(); MAT_CW.uniforms = { ...shared(ALLU), tAtlas: { value: cwTex } };
const CW_SIGN = (S, name, x, y, z, ry, w, h, glow = 1.4, kind = 0) => {
  const own = name in cwCells, g = new T.PlaneGeometry(w, h), uv = g.attributes.uv, c = own ? cwCells[name] : cells[name];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(c.u0, c.u1, uv.getX(i)), lerp(c.v0, c.v1, uv.getY(i)));
  g.setAttribute('aS', new T.Float32BufferAttribute(new Array(uv.count).fill(0).flatMap(() => [Math.random(), kind, glow, 0]), 4));
  const m = new T.Mesh(g, own ? MAT_CW : MAT_SIGN); m.position.set(x, y, z); m.rotation.y = ry; S.add(m); return m;
};
{
  const k = new Kit(), B = chrome.boxes, S = chromeScene, rc = rng(1987);
  const red = 0xb3121a, cream = 0xefe6d2, steel = 0x16171a, brass = 0xc9a24a;
  const wall = (x0, x1, z0, z1, h, col, mat = 2) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  // 紅磚：沿牆面一塊塊排（錯縫、深淺不一），3.6 m 以上是白色浪板
  const BRICK = [0x7a2e22, 0x8a3626, 0x6e2a1e, 0x93402c, 0x5e2419, 0x823224];
  const bricks = (len, put) => { for (let r = 0; r < 21; r++) for (let u = -(r % 2) * .26; u < len; u += .52) { const a = Math.max(0, u), b = Math.min(len, u + .5); if (b - a > .05) put((a + b) / 2, .14 + r * .17, b - a, BRICK[(rc() * BRICK.length) | 0]); } };
  const ribs = (len, put) => { for (let u = .12; u < len; u += .24) put(u); };
  // 側牆（x = ±12，面向室內）
  for (const s of [-1, 1]) {
    wall(s > 0 ? 12 : -12.4, s > 0 ? 12.4 : -12, 0, CD, CW_H, 0x8a7d70);
    bricks(CD, (u, y, l, c) => k.box(s * 11.98, y, u, .04, .15, l, c, 2));
    k.box(s * 11.97, 4.9, CD / 2, .02, 2.6, CD, 0xd8d4cc, 2); ribs(CD, u => k.box(s * 11.95, 4.9, u, .03, 2.6, .06, 0xc8c4bc, 10));
    k.box(s * 11.96, 3.66, CD / 2, .06, .1, CD, 0x2a2420, 10).box(s * 11.95, .1, CD / 2, .06, .2, CD, 0x1a1816, 10);
  }
  // 後牆
  wall(-12.4, 12.4, CD, CD + .4, CW_H, 0x8a7d70);
  bricks(24, (u, y, l, c) => k.box(u - 12, y, CD - .02, l, .15, .04, c, 2));
  k.box(0, 4.9, CD - .03, 24, 2.6, .02, 0xd8d4cc, 2); ribs(24, u => k.box(u - 12, 4.9, CD - .05, .06, 2.6, .03, 0xc8c4bc, 10));
  k.box(0, 3.66, CD - .04, 24, .1, .06, 0x2a2420, 10);
  // 前牆：捲門開口（x −5.1..5.1）兩側也是紅磚，門楣上是浪板；捲起來的米白色分節門收在天花板下
  wall(-12.4, -5.2, -.4, 0, CW_H, 0x8a7d70); wall(5.2, 12.4, -.4, 0, CW_H, 0x8a7d70);
  for (const s of [-1, 1]) bricks(6.8, (u, y, l, c) => k.box(s * (5.2 + u), y, .02, l, .15, .04, c, 2));
  k.box(0, 5.05, -.2, 10.4, 2.7, .4, 0xd8d4cc, 2).box(0, 3.66, .02, 10.4, .12, .06, 0x2a2420, 10);
  for (const s of [-1, 1]) k.box(s * 5.2, 1.85, .02, .14, 3.7, .08, 0x2a2c30, 15).box(s * 5.0, 4.4, 2.6, .06, .06, 5.4, 0x8a8e94, 15);
  for (let i = 0; i < 5; i++) k.box(0, 4.42 - (i % 2) * .02, .9 + i * .9, 10, .04, .86, cream, 10);
  B.push({ x0: -5.2, x1: 5.2, z0: -1.2, z1: -.4 });
  // 拋光水泥地（伸縮縫）、升降機下的黑白棋盤格與紅色收邊、黃色安全線
  k.box(0, -.05, CD / 2, 24.4, .1, CD + .4, 0x55524e, 10);
  for (let z = 4; z < CD; z += 4) k.box(0, .002, z, 24, .004, .03, 0x2e2c2a, 2);
  for (let x = -8; x <= 8; x += 8) k.box(x, .002, CD / 2, .03, .004, CD, 0x2e2c2a, 2);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 14; j++) k.box(-3.3 + i * .6, .006, CHROME_CAR.z - 3.9 + j * .6, .6, .01, .6, (i + j) % 2 ? 0x0e0e10 : 0xe8e4da, 0);
  for (const s of [-1, 1]) { k.box(s * 3.68, .007, CHROME_CAR.z, .14, .012, 8.56, red, 0); k.box(0, .007, CHROME_CAR.z + s * 4.28, 7.5, .012, .14, red, 0); }
  for (let i = 0; i < 9; i++) k.box(-2.8 + i * .7, .004, CHROME_CAR.z - 4.75, .32, .006, .5, i % 2 ? 0x111214 : 0xe8c020, 2, 0, .6);
  // 天花板、黑色工字鋼桁架、縱向檁條
  k.box(0, CW_H + .05, CD / 2, 24.4, .1, CD + .4, 0x1a1918, 2);
  for (let z = 3; z < CD; z += 4) { k.box(0, CW_H - .32, z, 24, .06, .22, steel, 15).box(0, CW_H - .06, z, 24, .06, .22, steel, 15).box(0, CW_H - .19, z, 24, .26, .03, steel, 15); for (let x = -11; x <= 11; x += 1.1) k.box(x, CW_H - .19, z, .03, .26, .03, 0x2a2c30, 15, 0, 0, .6 * (Math.round(x * 10) % 2 ? 1 : -1)); }
  for (const x of [-8, -4, 0, 4, 8]) k.box(x, CW_H - .12, CD / 2, .14, .16, CD, steel, 15);
  // 琺瑯吊燈（墨綠燈罩、暖色燈泡）
  const LAMPS = [[-2, 9.5], [2, 9.5], [-2, 13.5], [2, 13.5], [-2.5, 23], [-9.4, 5], [9.4, 4.8], [CW_DISP.x, CW_DISP.z], [-8.6, 9.5], [8, 12.5], [9.5, 18]];
  for (const [x, z] of LAMPS) {
    k.cyl(x, CW_H - .8, z, .008, .008, 1.5, 4, 0x111111, 15);
    k.add(new T.ConeGeometry(.42, .32, 22, 1), 0x1f4a34, 10, tf(x, CW_H - 1.62, z)).cyl(x, CW_H - 1.47, z, .07, .1, .1, 10, brass, 3);
    k.add(new T.SphereGeometry(.11, 12, 8), 0xffe2b0, 11, tf(x, CW_H - 1.82, z));
  }
  // 烤漆房（左後）：白色鋼構與玻璃、頂上的濾網燈條、地上的排風格柵
  const pb = { x0: -11.9, x1: -5.4, z0: 13.2, z1: 23.6 };
  k.box((pb.x0 + pb.x1) / 2, 4.1, (pb.z0 + pb.z1) / 2, pb.x1 - pb.x0, .12, pb.z1 - pb.z0, 0xe8e6e0, 2);
  for (let z = pb.z0 + .8; z < pb.z1; z += 1.6) k.box((pb.x0 + pb.x1) / 2, 4.02, z, pb.x1 - pb.x0 - .4, .04, .9, 0xf4f8ff, 11);
  for (let z = pb.z0 + .5; z < pb.z1; z += .5) k.box((pb.x0 + pb.x1) / 2, .006, z, pb.x1 - pb.x0 - 1, .01, .2, 0x0c0d0f, 15);
  k.box(pb.x1, 2.05, pb.z0 + .25, .1, 4.1, .5, 0xe8e6e0, 10).box(pb.x1, 2.05, pb.z1 - .25, .1, 4.1, .5, 0xe8e6e0, 10);
  // 烤漆房的牆是煙燻玻璃（不用玻璃材質：室內沒有能反射的環境，會映出城市的色塊）＋白色窗框
  k.box(pb.x1, 2.05, (pb.z0 + pb.z1) / 2 - 3, .04, 4, 3.4, 0x2a3236, 10).box(pb.x1, 2.05, (pb.z0 + pb.z1) / 2 + 3, .04, 4, 3.4, 0x2a3236, 10);
  for (const dz of [-3, 3]) for (const y of [1.0, 2.05, 3.1]) k.box(pb.x1 + .03, y, (pb.z0 + pb.z1) / 2 + dz, .03, .05, 3.4, 0xe8e6e0, 10);
  for (let x = pb.x0 + 1.3; x < pb.x1; x += 1.3) k.box(x, 2.05, pb.z0 - .03, .05, 4.1, .03, 0xe8e6e0, 10);
  k.box((pb.x0 + pb.x1) / 2, 2.05, pb.z0, pb.x1 - pb.x0, 4.1, .06, 0x2a3236, 10).box((pb.x0 + pb.x1) / 2, 4.3, pb.z0 - .02, 3.2, .34, .04, red, 10);
  B.push({ x0: pb.x1 - .1, x1: pb.x1 + .1, z0: pb.z0, z1: pb.z0 + .6 }, { x0: pb.x1 - .1, x1: pb.x1 + .1, z0: pb.z1 - .6, z1: pb.z1 }, { x0: pb.x0, x1: pb.x1, z0: pb.z0 - .05, z1: pb.z0 + .05 });
  B.push({ x0: pb.x1 - .1, x1: pb.x1 + .1, z0: pb.z0, z1: (pb.z0 + pb.z1) / 2 - 1.3 }, { x0: pb.x1 - .1, x1: pb.x1 + .1, z0: (pb.z0 + pb.z1) / 2 + 1.3, z1: pb.z1 });
  k.box(-11.6, 1.1, 18.4, .3, 2.2, 2.4, 0x2a2c30, 15);
  for (let i = 0; i < 8; i++) k.cyl(-11.55, .98 + (i % 2) * .5, 17.5 + (i >> 1) * .55, .1, .1, .26, 12, [0xc81030, 0x1f5fa8, 0xe8e4dc, 0x2f6a3a, 0xc9a227, 0x7a2cff, 0x111111, 0xe8782a][i], 0);
  B.push({ x0: -11.9, x1: -11.3, z0: 17.1, z1: 19.7 });
  // 輪胎牆（右後）：黑色鋼架上一排排的胎，中間那層是白邊胎
  for (let r = 0; r < 3; r++) {
    k.box(11.4, .3 + r * 1.1, 17.5, .9, .05, 7, steel, 15);
    for (let i = 0; i < 9; i++) {
      k.add(new T.TorusGeometry(.3, .12, 8, 18), 0x121212, 6, tf(11.4, .72 + r * 1.1, 14.4 + i * .76, 0, Math.PI / 2, 0));
      if (r === 1) k.add(new T.TorusGeometry(.27, .025, 6, 18), 0xeeeae0, 10, tf(11.27, .72 + r * 1.1, 14.4 + i * .76, 0, Math.PI / 2, 0));
    }
  }
  for (const z of [14, 21]) k.box(11.4, 1.7, z, .9, 3.4, .06, steel, 15);
  B.push({ x0: 10.9, x1: 12, z0: 13.9, z1: 21.1 });
  // 輪框展示牆（右前）：黃銅框裡的四組輪框
  for (let i = 0; i < 4; i++) {
    const z = 10 + i * 1.15;
    k.box(11.93, 2.4, z, .04, 1.05, 1.05, 0x111316, 2).box(11.9, 2.4, z, .02, 1.0, 1.0, brass, 3).box(11.89, 2.4, z, .02, .92, .92, 0x16130f, 2);
    k.cyl(11.84, 2.4, z, .4, .4, .12, 24, [0xd8dce2, 0x1a1b1e, 0xc9a227, 0x9aa0a6][i], 3, 0, 0, Math.PI / 2);
    for (let j = 0; j < 5 + i; j++) { const a = j / (5 + i) * Math.PI * 2; k.box(11.77, 2.4 + Math.sin(a) * .2, z + Math.cos(a) * .2, .03, .26, .05, 0x2a2c30, 15, a); }
  }
  // 技師 Rook 的木櫃台（胡桃木、鍍鉻收邊、老收銀機、一台診斷電腦）
  k.box(9.4, .5, 4.6, 3.2, 1, .9, 0x4a2c18, 10).box(9.4, 1.03, 4.6, 3.4, .06, 1.1, 0x2a1810, 0).box(9.4, .98, 4.04, 3.4, .04, .03, 0xd8dce2, 3);
  for (let i = 0; i < 6; i++) k.box(7.95 + i * .58, .5, 4.13, .5, .82, .02, 0x5a3820, 10);
  k.box(8.5, 1.24, 4.7, .5, .36, .45, 0x2a2c30, 3).box(8.5, 1.36, 4.5, .44, .12, .2, 0x8a8e94, 3, -.5).box(8.5, 1.5, 4.85, .3, .14, .06, 0x111111, 2);
  k.box(10.2, 1.45, 4.95, .9, .56, .05, 0x0a0c10, 1, -.12).box(10.2, 1.45, 4.92, .82, .48, .02, 0x3a5a6a, 11, -.12);
  B.push({ x0: 7.7, x1: 11.1, z0: 4.05, z1: 5.15 });
  // 後牆：紅色烤漆工具櫃一整排（不鏽鋼檯面、鍍鉻把手）、洞洞板、交叉的格子旗
  k.box(-2.5, .96, CD - .6, 6.6, .06, 1, 0xd8dce2, 3);
  for (let i = 0; i < 5; i++) {
    const x = -5.2 + i * 1.3;
    k.box(x, .46, CD - .6, 1.24, .9, .92, red, 0);
    for (let d = 0; d < 4; d++) k.box(x, .18 + d * .2, CD - 1.07, 1.0, .02, .02, 0xd8dce2, 3);
  }
  B.push({ x0: -5.8, x1: .8, z0: CD - 1.1, z1: CD });
  k.box(-2.5, 2.25, CD - .1, 6.6, 1.3, .05, 0x3a3430, 2);
  for (let i = 0; i < 16; i++) k.box(-5.6 + i * .42, 2.1 + (i % 3) * .35, CD - .14, .05, .4 - (i % 2) * .12, .03, 0xb8bcc2, 3, 0, 0, (i % 3 - 1) * .3);
  for (const [fx, a] of [[-6.6, .45], [1.6, -.45]]) {   // 旗桿往外斜，旗面從桿頂往外垂
    const sg = Math.sign(a), tx = fx - Math.sin(a) * 1.1, ty = 4.2 + Math.cos(a) * 1.1, ux = -sg * Math.cos(a), uy = -sg * Math.sin(a), vx = Math.sin(a), vy = -Math.cos(a);
    k.box(fx, 4.2, CD - .15, .04, 2.2, .04, brass, 3, 0, 0, a).add(new T.SphereGeometry(.05, 8, 6), brass, 3, tf(tx, ty, CD - .15));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) k.box(tx + ux * (.12 + i * .2) + vx * (.1 + j * .2), ty + uy * (.12 + i * .2) + vy * (.1 + j * .2), CD - .17, .2, .2, .01, (i + j) % 2 ? 0x111111 : 0xf2f0ea, 2, 0, 0, a);
  }
  // 引擎吊架與吊著的 V8（右後）
  const ex = 6.6, ez = CD - 2.4;
  k.box(ex, .08, ez, .12, .16, 2.2, 0xd8a020, 15).box(ex, 1.3, ez + 1, .14, 2.5, .14, 0xd8a020, 15).box(ex, 2.5, ez + .1, .12, .12, 1.9, 0xd8a020, 15, -.25);
  k.box(ex, 1.15, ez - .7, .7, .5, 1.0, 0x3a3e44, 3);
  for (const s of [-1, 1]) { k.box(ex + s * .26, 1.5, ez - .7, .24, .26, .95, red, 0, 0, 0, s * .5); for (let i = 0; i < 4; i++) k.cyl(ex + s * .5, 1.4, ez - 1.05 + i * .24, .05, .05, .16, 8, 0xd8dce2, 3, 0, 0, Math.PI / 2); }
  k.box(ex, 1.75, ez - .7, .34, .14, .7, 0xd8dce2, 3).cyl(ex, 1.95, ez - .7, .16, .16, .16, 16, 0x1a1a1a, 2);
  k.cyl(ex, 2.25, ez - .7, .01, .01, .5, 4, 0x111111, 15);
  chrome.circles.push({ x: ex, z: ez - .4, r: 1 });
  for (const [x, z, c] of [[9.4, CD - .6, 0x1b3a7a], [10.1, CD - .6, red], [9.75, CD - 1.2, 0xe8e4da]]) { k.cyl(x, .45, z, .3, .3, .9, 16, c, 0); for (const y of [.2, .7]) k.cyl(x, y, z, .31, .31, .04, 16, 0x2a2a2a, 15); }
  B.push({ x0: 9, x1: 10.5, z0: CD - 1.6, z1: CD });
  // 展示台：低的圓台、黃銅邊、暖白燈環，上面停美式肌肉車
  k.cyl(CW_DISP.x, .09, CW_DISP.z, 2.9, 3.0, .18, 48, 0x0e0e10, 0);
  k.add(new T.TorusGeometry(2.95, .03, 4, 64), brass, 3, tf(CW_DISP.x, .18, CW_DISP.z, Math.PI / 2, 0, 0)).add(new T.TorusGeometry(3.02, .015, 4, 64), 0xffe2b0, 11, tf(CW_DISP.x, .06, CW_DISP.z, Math.PI / 2, 0, 0));
  // 休息區（左前）：皮沙發（捲邊扶手）、輪胎茶几（玻璃桌面）、老加油機
  k.box(-10.65, .27, 4.5, .95, .34, 3.2, 0x5a2e1a, 10).box(-11.05, .72, 4.5, .26, .62, 3.2, 0x5a2e1a, 10);
  for (const z of [2.85, 6.15]) k.cyl(-10.7, .52, z, .2, .2, .9, 14, 0x4e2816, 10, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) k.cyl(-11.0, .55 + j * .3, 3.1 + i * .55, .02, .02, .02, 6, 0x2a140a, 2, 0, 0, Math.PI / 2);
  k.add(new T.TorusGeometry(.42, .17, 10, 22), 0x121212, 6, tf(-9.2, .18, 4.5, Math.PI / 2, 0, 0)).cyl(-9.2, .37, 4.5, .62, .62, .03, 28, 0x9fc4c8, 1);
  B.push({ x0: -11.2, x1: -10.1, z0: 2.6, z1: 6.4 }); chrome.circles.push({ x: -9.2, z: 4.5, r: .62 });
  const gp = { x: -11.3, z: 10.8 };
  k.box(gp.x, .95, gp.z, .5, 1.7, .7, red, 0).box(gp.x + .26, 1.25, gp.z, .02, .5, .5, cream, 2).box(gp.x + .26, .7, gp.z, .02, .3, .42, 0x0a0c10, 1);
  k.box(gp.x, 1.83, gp.z, .54, .06, .74, 0xd8dce2, 3).add(new T.SphereGeometry(.24, 16, 12), 0xfff4e0, 11, tf(gp.x, 2.1, gp.z)).cyl(gp.x, 1.88, gp.z, .12, .14, .06, 12, red, 0);
  k.add(new T.TorusGeometry(.28, .025, 6, 16, Math.PI), 0x111111, 2, tf(gp.x + .27, .9, gp.z, 0, Math.PI / 2, Math.PI / 2));
  B.push({ x0: gp.x - .3, x1: gp.x + .3, z0: gp.z - .4, z1: gp.z + .4 });
  S.add(new T.Mesh(k.build(), MAT.uber));
  // 捲門外的雨夜街景（和車行的落地窗同一個 shader）
  { const m = new T.Mesh(new T.PlaneGeometry(10.2, 3.7), new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: WINDOW_FS }));
    m.position.set(0, 1.85, -.5); S.add(m); }
  // 程式建模的雙柱升降機（替身；http(s) 下換成 GARAGE 07 那台 carlift 模型）：紅色柱子
  const lk = new Kit();
  for (const s of [-1, 1]) { lk.box(s * 1.78, 1.9, 0, .32, 3.8, .45, red, 0).box(s * 1.78, 3.85, 0, .4, .12, .5, steel, 15); lk.box(s * 1.2, .09, -.6, 1.3, .06, .14, 0x9aa0a6, 15).box(s * 1.2, .09, .6, 1.3, .06, .14, 0x9aa0a6, 15); }
  lk.box(0, 3.9, 0, 3.9, .12, .2, steel, 15);
  const lift = new T.Mesh(lk.build(), MAT.uber); lift.position.set(CHROME_CAR.x, 0, CHROME_CAR.z); S.add(lift);
  B.push({ x0: CHROME_CAR.x - 2.1, x1: CHROME_CAR.x - 1.45, z0: CHROME_CAR.z - .5, z1: CHROME_CAR.z + .5 }, { x0: CHROME_CAR.x + 1.45, x1: CHROME_CAR.x + 2.1, z0: CHROME_CAR.z - .5, z1: CHROME_CAR.z + .5 });
  propSwap('chrome', lift, 'carlift', [{ x: CHROME_CAR.x, z: CHROME_CAR.z, ry: Math.PI / 2 }], S);
  // 點唱機（替身是 interior_props 的 jukebox，http(s) 下換成實體模型）
  const JUKE = [{ x: -11.45, z: 8.2, ry: Math.PI / 2 }];
  propSwap('chrome', instancedIn(S, prop('jukebox'), MAT.uber, JUKE), 'jukebox', JUKE);
  B.push({ x0: -12, x1: -10.9, z0: 7.6, z1: 8.8 });
  // 三角旗串（紅白藍）：兩條橫過桁架
  const fk = new Kit(), FL = [0xb3201c, 0xeeeeee, 0x1b3a7a];
  for (const z of [5, 17]) for (let i = 0, x = -11.5; x < 11.5; x += .5, i++) { const sag = .45 * (1 - ((x / 11.5) ** 2)); fk.add(new T.ConeGeometry(.17, .36, 3), FL[i % 3], 2, tf(x, CW_H - .6 - sag - .18, z, Math.PI, 0, 0, 1, 1, .2)); }
  S.add(new T.Mesh(fk.build(), MAT.uber));
  // 招牌：後牆的 SPEED SHOP 琺瑯牌、門楣上的 CHROME WORKS 霓虹、牆上的機油牌／公路盾牌／HIGH OCTANE／霓虹草寫字／OPEN 24H
  CW_SIGN(S, 'CW_SPEED', -2.5, 4.4, CD - .1, Math.PI, 4.8, 1.8, .75);
  CW_SIGN(S, 'CHROME', 0, 5.2, .25, 0, 4.8, 1.2, 1.6);
  CW_SIGN(S, 'CW_OIL', 11.92, 4.6, 8.2, -Math.PI / 2, 1.5, 1.5, .7);
  CW_SIGN(S, 'CW_GAS', 11.92, 4.6, 24.2, -Math.PI / 2, 1.6, 1.0, .7);
  CW_SIGN(S, 'CW_ROUTE', -11.92, 4.6, 11.2, Math.PI / 2, 1.4, 1.4, .7);
  CW_SIGN(S, 'CW_HOT', -11.92, 3.0, 4.5, Math.PI / 2, 3.6, .9, 1.7);
  CW_SIGN(S, 'CW_OPEN', -8.6, 2.6, .08, 0, 1.6, .6, 1.8, 1);
}
// 展示台上的美式肌肉車（Challenger；以檔案開啟或還沒下載時是程式建模的替身）
{
  const m = carObject('chall'); m.position.set(CW_DISP.x, .18, CW_DISP.z); m.rotation.y = CW_DISP.yaw; chromeScene.add(m);
  chrome.circles.push({ x: CW_DISP.x, z: CW_DISP.z, r: 2.95 });
}
// 工具推車（http(s) 下走進來才換成模型；沒有替身）
propSwap('chrome', null, 'toolcart', [{ x: 3.2, z: 8.2, ry: -Math.PI / 2 }], chromeScene, () => chrome.boxes.push({ x0: 2.85, x1: 3.55, z0: 7.7, z1: 8.7 }));
{
  const cr = crowd(3); const rc = rng(1717);
  const list = [
    [ANIM.talk, ROOK.x, 0, ROOK.z, Math.PI, { top: lin(0x1b2a4a), bot: lin(0x1b2a4a), skin: SKINS[3], hair: lin(0x1a1410), longHair: 0, coat: 0, skirt: 0, hat: 1, glowI: 0 }],
    [ANIM.cross, -7.2, 0, 15.6, -Math.PI / 2], [ANIM.sit, -10.5, -.12, 4.0, Math.PI / 2],
  ];
  list.forEach(([a, x, y, z, yaw, look], i) => { cr.look(i, look || { r: rc, glowI: 0 }); cr.anim(i, a, rc() * 10, 1); cr.place(i, x, y, z, yaw); if (i === 1) chrome.circles.push({ x, z, r: .3 }); });
  cr.flush(); chromeScene.add(cr.mesh); chrome.people = cr;
}
// 燈：吊燈是暖白，霓虹字與展示台另外打光；比 NL 多的由 pickLights 挑離相機最近的
const CW_WARM = lin(0xffd6a0);
chrome.lights.push(
  { x: -2, y: 4.5, z: 9.5, col: CW_WARM, r: 9, i: 1.9 }, { x: 2, y: 4.5, z: 9.5, col: CW_WARM, r: 9, i: 1.9 }, { x: -2, y: 4.5, z: 13.5, col: CW_WARM, r: 9, i: 1.9 }, { x: 2, y: 4.5, z: 13.5, col: CW_WARM, r: 9, i: 1.9 },
  { x: CW_DISP.x, y: 4.4, z: CW_DISP.z, col: lin(0xfff0dc), r: 9, i: 2.2 }, { x: CW_DISP.x, y: .4, z: CW_DISP.z, col: CW_WARM, r: 5, i: .7 },
  { x: -2.5, y: 4.4, z: 23, col: CW_WARM, r: 9, i: 1.6 }, { x: -9.4, y: 4.4, z: 5, col: CW_WARM, r: 8, i: 1.3 }, { x: 9.4, y: 4.4, z: 4.8, col: CW_WARM, r: 8, i: 1.4 },
  { x: -8.6, y: 3.8, z: 18, col: lin(0xf4f8ff), r: 9, i: 1.4 }, { x: 9.5, y: 4.4, z: 18, col: CW_WARM, r: 9, i: 1.2 }, { x: 8, y: 4.4, z: 12.5, col: CW_WARM, r: 8, i: 1.1 },
  { x: -11, y: 3, z: 4.5, col: lin(0xff4f9a), r: 6, i: 1 }, { x: -8.6, y: 2.6, z: .6, col: lin(0xff3a2a), r: 4, i: .8 }, { x: 0, y: 4.6, z: 1, col: lin(0x2cf2d8), r: 7, i: .8 },
  { x: -8.6, y: 4.4, z: 9.5, col: CW_WARM, r: 7, i: 1.1 },
);
VENUES.chrome = { scene: chromeScene, data: chrome, spawn: { x: -2.6, z: 7.4, yaw: .35 }, name: 'CHROME WORKS', toast: 'CHROME WORKS 電馭改裝', dist: district(GAR_X, GAR_Z).split(' ')[0] + ' · 8 St', ceil: 5.9, door: WP(GAR_X, GAR_Z), out: spotW({ x: GAR_X + 6.2, z: GAR_Z + 1.4, yaw: 0 }) };

// ─── 進出：車子開進來時把座駕收起來（像停進車庫一樣移到 9999），擺一台同款同色的展示車在升降機上；出去時停回門口、直接坐進去 ───
const chromePad = () => spotW({ x: GAR_X, z: GAR_Z + SW + 4, yaw: Math.PI });
function chromeCtx(v) {
  if (v !== kestrel || motors.test || v.dead || v.boat || v.fly) return null;
  const p = chromePad();
  if (Math.hypot(v.x - p.x, v.z - p.z) > 6 || Math.hypot(v.vx, v.vz) > 2) return null;
  if (W.stars > 0) return null;   // 通緝中：69-crew.js 的噴漆消星先問過了，這裡不搶
  return { key: 'E', text: '開進 CHROME WORKS <i>· 改裝與調校</i>', fn: chromeEnter };
}
function chromeShow() {
  if (chrome.show) { chromeScene.remove(chrome.show); disposeKit(chrome.show); }
  const id = kestrel.carId, m = chrome.show = carObject(id, kestrel.paint);
  m.position.set(CHROME_CAR.x, CARS[id].bike ? 0 : modStats(id).rideY, CHROME_CAR.z); m.rotation.y = CHROME_CAR.yaw; chromeScene.add(m);
  chrome.circles.length = chrome.baseN ??= chrome.circles.length;
  const L = CARS[id].len * .28;
  for (const s of [-1, 1]) chrome.circles.push({ x: CHROME_CAR.x, z: CHROME_CAR.z + L * s, r: CARS[id].w / 2 + .1, car: 1 });
}
function chromeEnter() {
  const v = kestrel;
  exitVehicle();
  chrome.parked = true; v.vx = v.vz = 0; v.g.visible = false; v.x = v.z = 9999; poseVehicle(v);
  chromeShow();
  enterVenue('chrome', () => { if (!motors.mods[v.carId]) toast('走到車旁按 E 打開改裝面板'); });
}
function chromeOut() {
  chrome.parked = false;
  const p = chromePad();
  kestrel.g.visible = true; placeCarAt({ x: p.x, z: p.z, yaw: p.yaw + Math.PI });   // 車頭朝街上
}
function chromeLeave() {
  closeDialog(); cwClose();
  exitVenue(() => { chromeOut(); enterVehicle(kestrel); camState.yaw = kestrel.yaw; });
}
// 每幀：展示車的模型下載；用別的方式離開改裝廠（讀檔、傳送、測試 API）時把車停回門口
function updateChrome(dt) {
  if (player.where === 'chrome') { if (glbWait.length) glbWake(chromeScene); if (CW.open) cwCam(dt); return; }
  if (CW.open) cwClose();
  if (chrome.parked && !fading) chromeOut();
}

// ─── 改裝面板（仿 GTA V 洛聖都改車王的版面）：左上角的招牌、類別列與 n/N、清單（選到的那列反白）、說明、四條分段的性能條 ───
// 面板開著時鏡頭繞著升降機上的車轉（camState.over，A／D 手動轉），角色藏起來；方向鍵／W S 移動、Enter／E 選、Esc／Backspace 返回，滑鼠與觸控點清單
const WHO_CW = 'Rook · CHROME WORKS';
const CAT_DESC = {
  fix: '把凹痕、碎掉的車窗與爆掉的輪胎都修好。',
  eng: '升級引擎管理系統（EMS），提高加速度與極速。',
  trn: '縮短換檔時間，提高加速度；運動與賽車變速箱也提高一點極速。',
  tur: '加裝渦輪增壓，大幅提高加速度。',
  brk: '升級卡鉗與碟盤，縮短煞車距離。',
  sus: '降低車身、調硬避震，提高過彎時的抓地力與轉向反應。',
  spl: '加裝尾翼增加下壓力，提高抓地力。',
  arm: '使用軍用規格的複合材料強化車身，減少撞擊、子彈與爆炸對車子的傷害。',
  tir: '防彈胎：被子彈打到也不會爆胎。',
  paint: '換一套車漆：原廠色或七種顏色。',
  leave: '開著這台車回到街上。',
};
const CW = { open: false, cat: null, sel: 0, rows: [], a: 0, top: 0 };
// 性能條的範圍（整間車行從最慢到改滿的最快）
const CW_BARS = [['最高速度', 'kmh', 120, 300], ['加速', 'eng', 8, 30], ['煞車', 'brk', 12, 27], ['抓地力', 'grip', 6.5, 13]];
{
  const el = document.createElement('div'); el.id = 'cw'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'CHROME WORKS 改裝');
  el.innerHTML = '<div id="cwHead"><b>CHROME WORKS</b><small>電馭改裝 · 24H</small></div><div id="cwBar"><span id="cwTitle">類別</span><span id="cwN">1/1</span></div>'
    + '<div id="cwList" role="listbox"></div><div id="cwMore" aria-hidden="true"></div><p id="cwDesc"></p><div id="cwStats">'
    + CW_BARS.map(([n], i) => `<div class="cwS"><span>${n}</span><span class="cwB" id="cwB${i}"><em></em><u></u><i></i></span></div>`).join('') + '<small id="cwNote"></small></div>';
  const keys = document.createElement('div'); keys.id = 'cwKeys';
  keys.innerHTML = '<span><kbd>A</kbd><kbd>D</kbd> 轉動鏡頭</span><span><kbd>↑</kbd><kbd>↓</kbd> 移動</span><button id="cwOk"><kbd>Enter</kbd> 選擇</button><button id="cwBack"><kbd>Esc</kbd> 返回</button>';
  $('hud').append(el, keys);
  $('cwBack').addEventListener('click', () => { sfx.click(); cwBack(); });
  $('cwOk').addEventListener('click', () => { sfx.click(); cwPick(); });
}
const PAINTS = id => [[CARS[id].paint, '原廠色'], ...LIVERIES.filter(l => l[0] !== CARS[id].paint)];
const paintOk = id => !(CARS[id].glb && !CARS[id].paintable);
function repairCost(v) {
  const k = v.hpMax ? 1 - clamp(v.hp / v.hpMax, 0, 1) : 0, flats = v.tires ? v.tires.filter(t => t.flat).length : 0;
  return k < .005 && !flats && !v.glass ? 0 : Math.max(100, Math.round((k * 2400 + flats * 150 + (v.glass ? 300 : 0)) / 50) * 50);
}
// 每一級的效果說明（和 MOD_FX 對應）
function modFxText(k, n) {
  if (!n) return '原廠規格。';
  const F = MOD_FX[k], pct = (a, w) => a && a[n] !== 1 ? `${w} ${a[n] > 1 ? '+' : ''}${Math.round((a[n] - 1) * 100)}%` : '';
  if (k === 'arm') return `受到的傷害 −${Math.round((1 - F.armorK[n]) * 100)}%`;
  if (k === 'tir') return '子彈打不破。';
  return [pct(F.eng, '加速'), pct(F.top, '極速'), pct(F.brk, '煞車'), pct(F.grip, '抓地'), pct(F.turn, '轉向')].filter(Boolean).join(' · ');
}
// 目前這一層的清單：{ key, name, val, own, poor, off }
function cwRows() {
  const id = kestrel.carId, m = modsOf(id), cash = motors.cash;
  if (!CW.cat) {
    const rc = repairCost(kestrel), rows = [];
    if (rc) rows.push({ key: 'fix', name: '修車', val: money(rc), poor: cash < rc });
    for (const k of MOD_IDS) if (modCan(id, k)) rows.push({ key: k, name: MODS[k].name, val: MODS[k].lv[m[k] || 0][0] });
    if (!CARS[id].bike) { const P = PAINTS(id).find(o => o[0] === kestrel.paint); rows.push({ key: 'paint', name: '噴漆', val: paintOk(id) ? P ? P[1] : '自訂' : '原廠彩繪' }); }
    rows.push({ key: 'leave', name: '開車離開', val: '' });
    return rows;
  }
  if (CW.cat === 'paint') return PAINTS(id).map(([c, name]) => ({ key: c, name, val: c === kestrel.paint ? '✓' : '免費', own: c === kestrel.paint, off: !paintOk(id) }));
  const cur = m[CW.cat] || 0;
  return MODS[CW.cat].lv.map(([name, price], n) => ({ key: n, name, val: n === cur ? '✓' : n ? money(price) : '免費', own: n === cur, poor: n !== cur && n > 0 && cash < price }));
}
function cwRender() {
  const id = kestrel.carId, rows = CW.rows = cwRows();
  CW.sel = clamp(CW.sel, 0, rows.length - 1);
  const r = rows[CW.sel];
  $('cwTitle').textContent = CW.cat ? CW.cat === 'paint' ? '噴漆' : MODS[CW.cat].name : '類別';
  $('cwN').textContent = `${CW.sel + 1} / ${rows.length}`;
  const list = $('cwList'); list.innerHTML = '';
  rows.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = (i === CW.sel ? 'sel' : '') + (o.poor ? ' poor' : '') + (o.off ? ' off' : '');
    b.setAttribute('role', 'option'); b.setAttribute('aria-selected', i === CW.sel);
    b.innerHTML = '<span></span><span class="v"></span>'; b.firstChild.textContent = o.name; b.lastChild.textContent = o.val;
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && CW.sel !== i) { CW.sel = i; cwRender(); } });
    b.addEventListener('click', () => { sfx.click(); CW.sel = i; cwPick(); });
    list.append(b);
  });
  const sb = list.children[CW.sel]; if (sb) sb.scrollIntoView({ block: 'nearest' });
  $('cwMore').classList.toggle('on', list.scrollHeight > list.clientHeight + 2);
  // 說明與預覽：在套件那一層，停在哪一級就預覽那一級的性能（多出來的是青色，少掉的是紅色）
  let desc = CW.cat ? '' : CAT_DESC[r.key] || '', m1 = null;
  if (CW.cat === 'paint') desc = paintOk(id) ? CAT_DESC.paint : `${CARS[id].name} 是原廠彩繪，CHROME WORKS 不敢動。`;
  else if (CW.cat) { desc = modFxText(CW.cat, r.key) + (r.poor ? `\n現金不夠（還差 ${money(MODS[CW.cat].lv[r.key][1] - motors.cash)}）` : ''); m1 = { ...modsOf(id), [CW.cat]: r.key }; }
  if (!CW.cat && r.key === 'fix') desc += `\n車況 ${Math.round(kestrel.hp / kestrel.hpMax * 100)}%`;
  $('cwDesc').textContent = desc;
  const S0 = modStats(id), S1 = m1 ? modStats(id, m1) : S0;
  CW_BARS.forEach(([, k, lo, hi], i) => {
    const a = clamp((S0[k] - lo) / (hi - lo), .02, 1) * 100, b = clamp((S1[k] - lo) / (hi - lo), .02, 1) * 100, el = $('cwB' + i);
    el.children[0].style.width = Math.max(a, b) + '%'; el.children[1].style.left = b + '%'; el.children[1].style.width = Math.max(0, a - b) + '%'; el.children[2].style.width = Math.min(a, b) + '%';
  });
  const hp = kestrel.hpMax ? Math.round(kestrel.hp / kestrel.hpMax * 100) : 100;
  $('cwNote').textContent = `${CARS[id].name} · 極速 ${Math.round(S1.kmh)} km/h · 裝甲減傷 ${Math.round((1 - S1.armorK) * 100)}%${S1.bp ? ' · 防彈胎' : ''} · 車況 ${hp}%`;
}
function cwOpen() {
  if (CW.open) return;
  CW.open = true; CW.cat = null; CW.sel = 0; CW.a = 2.3;   // 從車頭斜前方看（車頭朝門口 −z）
  dlg.open = true; document.body.classList.add('talking', 'cwOn');   // dlg.open：走路與互動提示照對話框的規則停下來
  if (document.pointerLockElement) document.exitPointerLock();
  me.mesh.visible = false;
  $('cw').classList.add('on'); $('cwKeys').classList.add('on');
  cwRender();
}
function cwClose() {
  if (!CW.open) return;
  CW.open = false; dlg.open = false; document.body.classList.remove('talking', 'cwOn');
  $('cw').classList.remove('on'); $('cwKeys').classList.remove('on');
  camState.over = null; camState.snap = true; me.mesh.visible = true;
}
function cwBack() { if (CW.cat) { const c = CW.cat; CW.cat = null; CW.rows = cwRows(); CW.sel = Math.max(0, CW.rows.findIndex(r => r.key === c)); cwRender(); } else cwClose(); }
function cwPick() {
  const r = CW.rows[CW.sel]; if (!r) return;
  if (!CW.cat) {
    if (r.key === 'fix') return chromeRepair(repairCost(kestrel));
    if (r.key === 'leave') { cwClose(); return chromeLeave(); }
    CW.cat = r.key; CW.rows = cwRows(); CW.sel = Math.max(0, CW.rows.findIndex(o => o.own)); return cwRender();
  }
  if (CW.cat === 'paint') return cwPaint(r);
  modBuy(CW.cat, r.key);
}
function cwPaint(r) {
  const id = kestrel.carId;
  if (r.off) return toast(`${CARS[id].name} 是原廠彩繪，CHROME WORKS 不敢動`);
  if (r.own) return;
  applyCar(kestrel, id, r.key); poseVehicle(kestrel);
  motors.paint[id] = r.key; saveMotors(); chromeShow();
  sfx.spray(); toast(`塗裝：${r.name}`); cwRender();
}
function modBuy(k, n) {
  const id = kestrel.carId, cur = modsOf(id)[k] || 0, price = MODS[k].lv[n][1];
  if (n === cur) return cwRender();
  if (n && motors.cash < price) { toast(`錢不夠：${MODS[k].lv[n][0]} 要 ${money(price)}`); return cwRender(); }
  if (n) motors.cash -= price;
  const m = { ...modsOf(id) }; if (n) m[k] = n; else delete m[k];
  if (Object.keys(m).length) motors.mods[id] = m; else delete motors.mods[id];
  modApply(kestrel); saveMotors(); chromeShow();
  if (k === 'arm' || k === 'tir') sfx.reload(); else sfx.pickup();
  toast(n ? `裝好了：${MODS[k].lv[n][0]}（${money(price)}）` : `${MODS[k].name}換回原廠`);
  cwRender();
}
function chromeRepair(cost) {
  if (!cost) return CW.open && cwRender();
  if (motors.cash < cost) { toast('錢不夠修車'); return CW.open && cwRender(); }
  motors.cash -= cost; saveMotors();
  wreckFix(kestrel); modApply(kestrel);   // wreckFix 把破胎前的極速與抓地還原；再疊一次改裝
  sfx.reload(); toast(`修好了 · ${money(cost)}`);
  if (CW.open) { CW.sel = 0; cwRender(); }
}
// 按鍵（99-main.js 的 onKey 最先問）：面板開著就吃掉所有按鍵
function cwKey(code) {
  if (!CW.open) return false;
  const n = CW.rows.length;
  if (code === 'ArrowUp' || code === 'KeyW') { CW.sel = (CW.sel - 1 + n) % n; sfx.click(); cwRender(); }
  else if (code === 'ArrowDown' || code === 'KeyS') { CW.sel = (CW.sel + 1) % n; sfx.click(); cwRender(); }
  else if (code === 'Enter' || code === 'NumpadEnter' || code === 'KeyE' || code === 'Space') { sfx.click(); cwPick(); }
  else if (code === 'Escape' || code === 'Backspace') { sfx.click(); cwBack(); }
  return true;
}
// 每幀（updateChrome）：鏡頭繞著車慢慢轉，看的點往畫面左邊偏，車子落在面板右邊
function cwCam(dt) {
  CW.a += ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) * 1.4 * dt + .08 * dt;
  const R = 6.4, cx = CHROME_CAR.x, cz = CHROME_CAR.z, px = cx + Math.sin(CW.a) * R, pz = cz + Math.cos(CW.a) * R;
  const fx = (cx - px) / R, fz = (cz - pz) / R, k = innerWidth > 760 ? 1.7 : 0;   // 窄螢幕的面板蓋住上半，車放中間
  camState.over = [px, 2.3, pz, cx + fz * k, .45, cz - fx * k];
}
function talkRook() {
  dialog(WHO_CW, '套件照洛聖都那邊的規矩分級：引擎、變速箱、渦輪管加速，煞車管停得住，懸吊和尾翼管過彎，裝甲管你撞牆之後還有沒有車可開。每台車的底子都不一樣，先看原廠數字再決定錢花在哪。', [
    { t: '這台車的原廠數字？', fn: () => { const r = CARS[kestrel.carId].real; dialog(WHO_CW, r ? `${CARS[kestrel.carId].name}：${r.ps} 匹、車重 ${r.kg.toLocaleString('en-US')} kg、0–100 ${r.t100} 秒、極速 ${r.top} km/h、${{ R: '前置後驅', M: '中後置後驅', A: '四輪驅動', B: '機車' }[r.dt]}。` : '這台沒有原廠資料。', [{ t: '好', fn: talkRook }]); } },
    ...(repairCost(kestrel) ? [{ t: `修車（${money(repairCost(kestrel))}）`, fn: () => { closeDialog(); chromeRepair(repairCost(kestrel)); } }] : []),
    { t: '打開改裝面板', fn: () => { closeDialog(); cwOpen(); } },
    { t: '先這樣', fn: closeDialog },
  ]);
}
ctxHooks.push((p, near) => {
  if (p.where !== 'chrome' || p.mode !== 'walk') return null;
  if (near(0, .8, 1.8)) return { key: 'E', text: `開車離開 <i>· ${kestrel.name}</i>`, fn: chromeLeave };
  if (near(ROOK.x, ROOK.z - 3, 1.6)) return { key: 'E', text: '跟技師 Rook 說話', fn: talkRook };
  if (near(CHROME_CAR.x, CHROME_CAR.z, 3.6)) return { key: 'E', text: `改裝 <i>· ${kestrel.name}</i>`, fn: cwOpen };
  return null;
});
