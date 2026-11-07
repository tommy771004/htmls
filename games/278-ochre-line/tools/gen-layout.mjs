// 產生 src/map/layout.js（作品 278「日晷坊」定稿）。用法：node tools/gen-layout.mjs [輸出路徑]
// 地形以 2 m 格繪製，主要邊界落在 4 m 網格；沒畫到的格子自動切成建築地塊。
// 底稿是三案評審勝出的方案 A（山坡舊城：A 堡壘庭院 y7、B 下沉染坊 y-3）。
// 原創界線：廣場不留朝北的中軸出口（晷影階貼北緣橫走，中軸上是白頂小寺）；同一面牆不並排兩個進點；
// 海防庭偏離中軸 8 m；炸點內不放車。改動線時不要把這幾項改回去，見 SPEC.md「原創界線」。
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const B0 = -72; const B1 = 72; const C = 2;
const N = (B1 - B0) / C;
const grid = new Array(N * N).fill(null);
const cellAt = (x, z) => {
  const i = Math.floor((x - B0) / C); const j = Math.floor((z - B0) / C);
  return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
};
const paint = (x0, z0, x1, z1, tag) => {
  for (let x = x0; x < x1; x += C) for (let z = z0; z < z1; z += C) { const c = cellAt(x + 0.01, z + 0.01); if (c >= 0) grid[c] = tag; }
};
const ground = []; const ramps = []; const blocks = []; const walls = []; const cover = []; const deco = [];
const FLOOR = -3.6;
const G = (x0, z0, x1, z1, y, mat, o = {}) => {
  ground.push({ x0, z0, x1, z1, y, mat });
  paint(x0, z0, x1, z1, 'walk');
  if (!o.noPlinth && y - 0.3 > FLOOR + 0.01) blocks.push({ x0, z0, x1, z1, y0: FLOOR, y1: +(y - 0.3).toFixed(2), style: 'ashlar', roof: 'flat', plinth: true });
};
const R = (x0, z0, x1, z1, dir, y0, y1, kind = 'stairs') => {
  ramps.push({ x0, z0, x1, z1, dir, y0, y1, kind });
  const lo = Math.min(y0, y1) - 0.3;
  if (lo > FLOOR + 0.01) blocks.push({ x0, z0, x1, z1, y0: FLOOR, y1: +lo.toFixed(3), style: 'ashlar', roof: 'flat', plinth: true });
  paint(x0, z0, x1, z1, 'walk');
};
const SP = (x0, z0, x1, z1, y1, style, roof, y0 = FLOOR) => {
  blocks.push({ x0, z0, x1, z1, y0, y1, style, roof });
  if (y0 <= 0) paint(x0, z0, x1, z1, 'block');
};
const W = (ax, az, bx, bz, y0, y1, style, openings = [], t = 0.5) => walls.push({ ax, az, bx, bz, t, y0, y1, style, openings });
const arch = (at, w = 2.6, h = 2.8) => ({ at, w, h, sill: 0, kind: 'arch' });
const gate = (at, w = 4, h = 3.6) => ({ at, w, h, sill: 0, kind: 'gate' });
const win = (at, w, h, sill) => ({ at, w, h, sill, kind: 'window' });

// ---------- 地形 ----------
// 攻方南脊
G(-12, -56, 12, -36, 2, 'sand');
G(-18, -48, -12, -44, 2, 'cobble'); R(-24, -48, -18, -44, '+x', 0.5, 2); G(-32, -48, -24, -44, 0.5, 'cobble');
G(-32, -52, -28, -48, 0.5, 'cobble'); G(-44, -52, -32, -48, 0.5, 'cobble'); G(-44, -48, -40, -36, 0.5, 'cobble');
G(-56, -36, -36, -16, 0.5, 'sand');
G(-36, -28, -20, -24, 0.5, 'cobble'); G(-24, -32, -20, -28, 0.5, 'cobble'); R(-20, -32, -14, -28, '+x', 0.5, 1, 'ramp'); G(-14, -32, -12, -28, 1, 'cobble');
R(4, -36, 8, -32, '-z', 1, 2);
G(-12, -32, 12, -20, 1, 'cobble');
R(-12, -20, -8, -12, '-z', 0, 1);
G(12, -24, 16, -20, 1, 'cobble'); R(16, -24, 22, -20, '+x', 1, 2, 'ramp'); G(22, -24, 28, -20, 2, 'cobble'); G(24, -30, 28, -24, 2, 'cobble'); G(28, -30, 40, -26, 2, 'cobble');
G(12, -44, 24, -40, 2, 'cobble'); G(24, -44, 28, -32, 2, 'cobble'); G(28, -36, 40, -32, 2, 'cobble');
G(40, -44, 60, -20, 2, 'sand');
// 東線：東棧場 → 折巷 → 燈巷 → 塔前階 → 堡壘
R(56, -20, 60, -12, '+z', 2, 3.5);
G(46, -12, 60, -8, 3.5, 'cobble');
G(40, -12, 46, 0, 3.5, 'flag');
G(36, 0, 52, 4, 3.5, 'flag');
R(40, 4, 48, 12, '+z', 3.5, 7);
G(40, 12, 48, 14, 7, 'flag');
G(32, 14, 56, 38, 7, 'flag');
G(56, 14, 60, 16, 7, 'flag'); R(56, 16, 60, 22, '+z', 7, 9.5); G(56, 22, 60, 38, 9.5, 'flag');
G(28, -4, 36, 0, 3.5, 'cobble'); G(32, 0, 36, 4, 3.5, 'cobble');
// 東露台與屋頂
G(24, -4, 28, 16, 3.5, 'flag');
R(24, 16, 28, 24, '+z', 3.5, 7); G(24, 24, 28, 30, 7, 'flag'); G(24, 30, 32, 34, 7, 'flag');
R(12, 4, 24, 8, '+x', 0, 3.5);
G(12, -12, 16, 4, 0, 'flag');                          // 東騎樓（下層）
G(12, -12, 16, 4, 3.5, 'flag', { noPlinth: true });    // 騎樓屋頂
G(16, -16, 24, 4, 3.5, 'flag');
G(12, -16, 16, -12, 3.5, 'flag', { noPlinth: true });
blocks.push({ x0: 12, z0: -16, x1: 16, z1: -12, y0: FLOOR, y1: 3.2, style: 'ashlar', roof: 'flat', plinth: true });
// 日晷廣場
G(-12, -12, 12, 12, 0, 'flag');
R(0, -16, 12, -12, '+x', 0, 3.5);
// 西側下沉
G(-16, 0, -12, 4, 0, 'cobble'); R(-20, 0, -16, 4, '+x', -1, 0, 'ramp'); G(-24, -4, -20, 4, -1, 'cobble');
G(-32, -8, -20, -4, -1, 'cobble'); G(-32, -4, -28, 8, -1, 'cobble');
R(-32, 8, -28, 16, '-z', -3, -1); G(-32, 16, -28, 28, -3, 'cobble');
G(-52, -4, -32, 0, -1, 'cobble'); G(-52, 0, -36, 2, -1, 'cobble');
G(-56, -16, -52, -10, 0.5, 'cobble'); R(-56, -10, -52, -4, '-z', -1, 0.5); G(-56, -4, -52, 2, -1, 'cobble');
G(-56, 2, -36, 8, -1, 'flag');                         // 柱廊
G(-56, 8, -36, 32, -3, 'cobble');                      // 舊染坊
R(-40, 8, -37, 14, '-z', -3, -1);
G(-36, 20, -32, 24, -3, 'cobble');                     // 沉巷進 B 的唯一開口
// 北街
R(-28, 24, -16, 28, '+x', -3, 2.5);
G(-16, 24, -8, 28, 2.5, 'cobble');
G(-8, 24, 12, 28, 2.5, 'flag'); G(8, 28, 12, 32, 2.5, 'flag');
G(-24, 12, -4, 24, 2.5, 'flag');                       // 北露台
// 晷影階：貼著廣場北緣、由東往西爬的橫向長階。廣場沒有朝北的中軸出口，從東北角上階、在北露台折回北街。
R(-4, 12, 12, 16, '-x', 0, 2.5);
R(8, 32, 12, 40, '+z', 2.5, 4.5);
G(12, 24, 16, 28, 2.5, 'cobble'); G(16, 12, 20, 28, 2.5, 'cobble'); R(20, 12, 24, 16, '+x', 2.5, 3.5, 'ramp');
// 守方北脊
G(-20, 40, 4, 56, 4.5, 'flag');                        // 海防庭偏離中軸，攻守出生不在同一條南北線上
G(-28, 50, -20, 54, 4.5, 'cobble'); G(-32, 40, -28, 54, 4.5, 'cobble'); R(-44, 40, -32, 44, '+x', 0.5, 4.5);
G(-60, 40, -44, 44, 0.5, 'cobble'); G(-60, 36, -56, 40, 0.5, 'cobble');
R(-60, 28, -56, 36, '+z', -1.2, 0.5); G(-60, 12, -56, 28, -1.2, 'flag');
R(-50, 32, -46, 40, '+z', -3, 0.5);
G(8, 40, 12, 44, 4.5, 'cobble'); G(4, 44, 24, 48, 4.5, 'cobble'); G(24, 44, 28, 52, 4.5, 'cobble'); R(28, 48, 40, 52, '+x', 4.5, 7); G(40, 38, 44, 52, 7, 'cobble');
// 南側屋頂（攻方高點）
R(-32, -24, -28, -16, '+z', 0.5, 3.5);
G(-32, -16, -12, -12, 3.5, 'flag'); G(-16, -12, -12, 0, 3.5, 'flag');

// ---------- 地標建築 ----------
SP(48, 42, 60, 56, 30, 'ashlar', 'parapet');           // 堡壘主塔
SP(32, 4, 40, 14, 12, 'sandstone', 'parapet');         // 階前西塔
SP(48, 4, 60, 14, 11.5, 'ashlar', 'parapet');            // 階前東堡
SP(-4, 16, 8, 24, 15, 'whitewash', 'dome');            // 白頂小寺：坐在廣場中軸上，把南北向視線整個擋掉
SP(16, -10, 20, 0, 7, 'plaster', 'tile', 3.5);
blocks.push({ x0: -10, z0: -46, x1: -6, z1: -42, y0: FLOOR, y1: 6, style: 'plaster', roof: 'tile' }); // 營房，切斷東西營巷的長視線         // 東屋頂小亭
blocks.push({ x0: -37, z0: 8, x1: -36, z1: 14, y0: FLOOR, y1: 0, style: 'ashlar', roof: 'tile' });
SP(-56, 2, -36, 8, 3, 'ashlar', 'flat', 2.2);          // 柱廊頂
SP(-24, 20, -20, 24, 6, 'plaster', 'tile', 2.5);       // 北露台西北角小屋，截短全圖最長的斜向視線
SP(22, 46, 24, 48, 12, 'ashlar', 'parapet');           // 北堡巷轉角的扶壁，截斷海防庭到北堡巷的東西向長視線

// ---------- 牆 ----------
// 塔前門樓：key.jpg 的主拱。牆頂拉高才有拱冠，開口頂到 y12，主塔要從門樓右上方露出來。
W(32, 14, 40, 14, 7, 11, 'ashlar', [], 1);
W(40, 14, 48, 14, 7, 13, 'ashlar', [arch(4, 3.6, 5)], 1.6);
W(48, 14, 60, 14, 7, 11, 'ashlar', [], 1);
W(32, 14, 32, 38, 7, 11, 'ashlar', [arch(18, 4, 3.6)], 1);
W(32, 38, 56, 38, 7, 11, 'ashlar', [arch(10, 4, 3.6)], 1);
W(56, 22, 56, 38, 9.5, 10.5, 'ashlar');
W(12, -12, 12, 4, 0, 3.2, 'sandstone', [arch(2), arch(6), arch(10), arch(14)], 0.6);
W(12, -12, 12, 4, 3.5, 4.5, 'sandstone');              // 東騎樓屋頂女兒牆
W(12, 4, 24, 4, 3.5, 5.7, 'sandstone');                // 東階南側高牆，擋屋頂層斜向長視線
W(-12, -12, -12, 0, 3.5, 4.5, 'plaster');              // 南屋頂女兒牆
// 碑牆：擋在南院進廣場的出口，出口折向東，開局不會從南院一路看到晷影階。
W(-12, -8.5, -6, -8.5, 0, 3.8, 'sandstone', [], 0.6);
W(-12, 12, -4, 12, 2.5, 3.5, 'plaster');
W(-28, 24, -16, 24, -3, 3.6, 'plaster');
W(-36, 8, -36, 32, -3, 3.5, 'brick', [gate(14, 4, 3.4)], 0.6);
W(-56, 32, -36, 32, -3, 3.5, 'brick', [gate(8, 4, 3.4)], 0.6);
// 柱廊：北牆朝染坊開大窗、南牆開拱
W(-56, 8, -40, 8, -3, 2.2, 'ashlar', [win(6.5, 2.6, 2.2, 3), win(10.5, 2.6, 2.2, 3), win(14, 2.2, 2.2, 3)], 0.6);
W(-56, 2, -36, 2, -1, 2.2, 'ashlar', [gate(2, 4, 3), arch(6.5), win(11, 2.4, 1.9, 0.9), win(15, 2.4, 1.9, 0.9)], 0.6);
W(-40, 8, -40, 14, -3, -0.2, 'ashlar');
// 陽台欄杆，留缺口給木箱
W(-56, 12, -56, 16, -1.2, -0.2, 'ashlar', [], 0.3);
W(-56, 22, -56, 28, -1.2, -0.2, 'ashlar', [], 0.3);

// ---------- 自動地塊 ----------
const hash = (x, z, k = 0) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const surfTop = (x0, z0, x1, z1) => {
  let y = -3;
  for (const g of ground) if (g.x1 > x0 && g.x0 < x1 && g.z1 > z0 && g.z0 < z1) y = Math.max(y, g.y);
  for (const r of ramps) if (r.x1 > x0 && r.x0 < x1 && r.z1 > z0 && r.z0 < z1) y = Math.max(y, r.y0, r.y1);
  return y;
};
const zoneOf = (x, z) => { const m = Math.max(Math.abs(x + 1), Math.abs(z + 1)); return m > 68 ? 2 : m > 60 ? 1 : 0; };
const STY = ['sandstone', 'plaster', 'whitewash', 'sandstone', 'brick', 'plaster'];
const ROOF = ['tile', 'flat', 'parapet', 'tile', 'parapet', 'dome'];
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    if (grid[j * N + i]) continue;
    const x0 = B0 + i * C; const z0 = B0 + j * C; const zn = zoneOf(x0, z0);
    // 邊界落在 4 m 網格：起點不在網格上的地塊只補到下一條格線。
    const maxW = (x0 % 4) ? 1 : [4, 6, 8][Math.floor(hash(x0, z0, 1) * 3)];
    const maxD = (z0 % 4) ? 1 : [4, 6][Math.floor(hash(x0, z0, 2) * 2)];
    const free = (a, b) => a < N && b < N && !grid[b * N + a] && zoneOf(B0 + a * C, B0 + b * C) === zn;
    let w = 1; while (w < maxW && free(i + w, j)) w++;
    let d = 1;
    for (; d < maxD; d++) { let ok = true; for (let a = 0; a < w; a++) if (!free(i + a, j + d)) ok = false; if (!ok) break; }
    for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) grid[(j + b) * N + i + a] = 'block';
    const x1 = x0 + w * C; const z1 = z0 + d * C;
    const base = surfTop(x0 - 2.5, z0 - 2.5, x1 + 2.5, z1 + 2.5);
    const r = hash(x0, z0, 3);
    const h = zn === 2 ? 15 + r * 8 : zn === 1 ? 11 + r * 6 : 5.5 + r * 6;
    const y1 = Math.round((Math.max(base, 2) + h) * 2) / 2;
    const fort = x0 >= 28 && z0 >= 8 && x0 < 64 && z0 < 60;
    const dyeworks = x0 < -32 && z0 > -8 && z0 < 44;
    const style = fort ? 'ashlar' : dyeworks ? (hash(x0, z0, 4) < 0.5 ? 'brick' : 'plaster') : STY[Math.floor(hash(x0, z0, 5) * STY.length)];
    const roof = ROOF[Math.floor(hash(x0, z0, 6) * ROOF.length)];
    blocks.push({ x0, z0, x1, z1, y0: FLOOR, y1, style, roof });
    // 大地塊加一層退縮
    if (zn === 0 && w >= 3 && d >= 3 && hash(x0, z0, 7) < 0.45) {
      blocks.push({ x0: x0 + 2, z0: z0 + 2, x1: x1 - 2, z1: z1 - 2, y0: y1, y1: y1 + 3, style, roof: hash(x0, z0, 8) < 0.5 ? 'tile' : 'dome' });
    }
  }
}

// ---------- 掩體與裝飾 ----------
const groundY = (x, z, hint) => {
  let list = [];
  for (const g of ground) if (x >= g.x0 && x <= g.x1 && z >= g.z0 && z <= g.z1) list.push(g.y);
  for (const r of ramps) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
    const ax = r.dir[1] === 'x'; let t = ax ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
    if (r.dir[0] === '-') t = 1 - t; list.push(r.y0 + (r.y1 - r.y0) * t);
  }
  if (!list.length) return 0;
  if (hint === undefined) return +Math.max(...list).toFixed(2);
  list.sort((p, q) => Math.abs(p - hint) - Math.abs(q - hint));
  return +list[0].toFixed(2);
};

// kind, x, z, rot, stack
const CV = [
  // 赤沙營地
  ['mil', -6, -38.5, 0], ['crate1', -9.5, -40, 15], ['crate2', 9.5, -52, 0], ['barrel', -10, -53], ['barrel', -9, -54],
  // 西線
  ['barrel', -26, -44.8], ['crate1', -29, -51], ['crate1', -41, -40, 10], ['barrel', -43, -42],
  ['well', -50, -25], ['crate2', -39, -19, 0], ['crate1', -41, -19, 0], ['cart', -52, -32, 20], ['sandbag', -48, -19, 0], ['stone', -53, -22], ['mil', -38.5, -33, 90],
  ['barrel', -53, -12], ['barrel', -33, -25], ['crate2', -16, -28.7, 0, 2],
  // 南院與南橫巷
  ['crate2', 3, -25, 0], ['crate1', 1.5, -24, 0], ['mil', -5, -29, 90], ['crate1', 9.6, -30.8, 0], ['cart', -1, -21, 0], ['barrel', -11, -21], ['stone', -8.5, -30.6],
  ['barrel', 23, -21], ['crate1', 24.8, -29.2, 0], ['barrel', 33, -29.3],
  // 日晷廣場
  ['sundial', 0, 0], ['gnomon', 0, 0], ['stone', -8, -6], ['stone', 7, -7], ['stone', -7, 7], ['stone', 7, 7],
  ['planter', -11, 8, 90], ['planter', 11, -9, 90], ['crate1', 8, 10.9, 0], ['crate2', -10.9, 6, 0], ['sandbag', 5, 10.8, 0],
  // 東騎樓與平頂
  ['crate1', 14, 2, 0], ['barrel', 14.6, -11], ['sandbag', 14, -7, 90], ['crate1', 21, -2, 0], ['crate2', 17, -12, 0], ['sandbag', 14, 1, 90],
  // 東露台與上階
  ['crate1', 25, 11, 0], ['barrel', 27, 15], ['crate1', 27.4, 28.5, 0], ['crate1', 30, 30.6, 0], ['sandbag', 26, -3, 0],
  // 東橫巷、燈巷、塔前
  ['barrel', 30, -3.2], 
  // key 鏡位的兩側木箱：左邊兩層＋一只矮箱，右邊 1.25 m 箱兩層＋盆栽，都站在階腳平台上，燈巷口不變窄。
  ['crate2', 39.4, 2.7, 0, 2], ['crate125', 41, 3, 0], ['crate125', 45.8, 2.6, 0, 2], ['crate1', 47.2, 2.2, 8], ['stone', 40.7, -3.4, 0], ['crate125', 45.3, -7, 0], ['barrel', 40.8, -10.8], ['barrel', 41.6, -11.2], ['stone', 45.2, -11.2],
  ['barrel', 36.7, 3.5], ['crate1', 50.5, 2, 0], ['barrel', 49.6, 3.2],
  // 東棧場
  ['cart', 50, -28, 30], ['mil', 44, -36, 0], ['crate2', 54, -38, 0, 2], ['crate1', 42, -22, 0], ['sandbag', 52, -22, 0], ['crate2', 47, -24, 0], ['barrel', 58.8, -42.8],
  // 炸點 A
  ['crate125', 40, 22, 0, 2], ['crate2', 42.5, 22.4, 0, 2], ['mil', 48, 31, 90], ['sandbag', 36, 18.5, 0], ['sandbag', 48, 20.3, 0], ['stone', 53, 26], ['crate2', 36.2, 35.6, 0], ['crate125', 37.7, 35.5, 0], ['crate1', 34.2, 24, 0], ['barrel', 54.8, 36.8], ['crate125', 46, 24, 15],
  ['sandbag', 59.2, 28, 90], ['sandbag', 59.2, 35, 90],
  ['well', 50, 33], ['planter', 50, 30.7, 0], ['planter', 50, 35.3, 0], ['planter', 47.7, 33, 90], ['planter', 52.3, 33, 90], ['crate1', 54.2, 17.2, 0], ['sandbag', 45.2, 36.6, 0],
  // 北堡巷與守方
  ['crate1', 43, 47, 0], ['barrel', 26.8, 51], ['crate2', 13, 47.2, 0, 2],
  ['crate2', -17, 42.5, 0], ['mil', 0, 41.5, 0], ['crate1', 1.5, 54, 0], ['barrel', -18.8, 54.8],
  ['barrel', -27, 53], ['crate1', -29, 41, 0],
  // 北露台與北街
  ['sandbag', -9, 13.2, 0], ['crate1', -18, 15, 0], ['crate1', -12, 17, 0], ['crate2', -18.6, 21.6, 0, 2], ['planter', -5.5, 18, 90], ['barrel', 7, 25],
  ['crate1', 19, 26.8, 0], ['barrel', 16.8, 13], ['crate1', -7, 27.4, 0],
  // 沉巷與柱廊
  ['barrel', -29, 26.8], ['crate1', -29, 20.5, 0], ['barrel', -31.2, 6.8], ['crate1', -23, -7, 0], ['barrel', -33.6, -3.2],
  ['crate1', -44, -3.2, 0], ['barrel', -38, 0.8], ['stone', -47, 6.6], ['stone', -44, 3.4],
  // 炸點 B
  ['crate125', -46, 22, 0, 2], ['crate125', -44.6, 22, 0], ['crate1', -55, 19, 0], ['crate2', -50, 12.5, 0], ['crate125', -50, 14, 0], ['crate1', -41, 28, 0], ['mil', -52, 28, 0], ['barrel', -37.2, 30.8], ['barrel', -38, 31], ['stone', -43, 12], ['planter', -54, 31, 0],
  ['sandbag', -59.2, 21, 90], ['barrel', -58.8, 13], ['crate125', -37.5, 20.5, 0], ['crate1', -51.8, 20, 0],
  // 西嶺
  ['crate1', -52, 41, 0], ['barrel', -59, 43],
  // 南屋頂
  ['sandbag', -15.2, -8, 90], ['crate1', -24, -15.2, 0], ['barrel', -15, 0.0 - 0.8],
];
for (const [kind, x, z, rot = 0, stack = 1] of CV) cover.push({ x, z, kind, rot, stack });

const D = (kind, x, z, lift = 0, rot = 0, scale = 1, hint) => deco.push({ x, y: +(groundY(x, z, hint) + lift).toFixed(2), z, kind, rot, scale });
for (const [x, z] of [[-10.5, 10.5], [10.5, -10.5], [-38, -18], [-54.5, -34.5], [58, -22.5], [42, -42.5], [39.5, 3.75], [54.5, 15.5], [-18.5, 54.5], [2.5, 40.5], [-54.5, 9.5], [2, -54.5]]) D('palm', x, z, 0, 0, 0.9 + ((x * 7 + z * 13) % 5 + 5) % 5 * 0.08);
const LANTERN = [[-11.6, 2], [11.6, 0], [11.6, 8], [-2, 11.6], [14, 7.6], [40.4, -6], [45.6, -8], [46, 1], [42, 13.1], [36, 15], [33, 26.5], [55.5, 30], [-36.6, 18], [-40, 31.6], [-54, 2.6], [-46, 2.6], [-38, 7], [-29, 10], [-22, 1], [-14, 26], [0, 28], [18, 20], [26, 8], [-20, 50.4], [26, 45], [6, -35.6], [-40, -30], [50, -43], [-54, -4]];
for (const [x, z] of LANTERN) D('lantern', x, z, 3.1);
for (const [x, z, r] of [[-46, 9, 0], [-52, 9, 0], [-42, 31, 180], [-54, 24, 90], [11, -4, 90], [11, 4, 90], [42, -21, 0], [58, -32, 270], [40.5, 5, 90]]) D('awning', x, z, 2.5, r);
for (const [x, z, r] of [[40.3, -4, 90], [44, 14.85, 0], [-12, 6, 90], [12, 2, 270], [-36.3, 26, 90], [10, 39.6, 0], [34, 38, 0]]) D('banner', x, z, 4, r);
for (const [x, z, r] of [[43, -8, 90], [43, -2, 90], [-20, -46, 0], [30, -2, 0], [-22, 2, 0], [-30, 12, 90], [-12, 26, 0], [18, 22, 90], [-54, -13, 90], [14, -42, 0], [34, 50, 0], [-38, 42, 0], [-30, -26, 0], [-44, -2, 0]]) D('wire', x, z, 4.6, r);
for (const [x, z] of [[-11, -11], [6.9, 11.4], [-5, 23], [24.8, 3], [39, 13], [-40, 9], [-19.5, 41], [-6, -54.8]]) D('pot', x, z);
for (const [x, z, r] of [[-5, -11.3, 0], [5, 11.3, 0], [-51, -17, 0], [34, 15, 0], [-37, 24, 90]]) D('bench', x, z, 0, r);
for (const [x, z, r] of [[40, -8, 90], [36, 3.8, 0], [-28, -2, 90], [-20, 25, 0], [27.8, 8, 270], [-32, 18, 90]]) D('shutter', x, z, 1.6, r);

D('door', 46, -4, 0, 270, 1, 3.5);                     // key.jpg 右側的藍門
D('pot', 45.8, 2.6, 2.5, 0, 1.5, 3.5);                  // 右側木箱頂的盆栽
for (const [x, z, r] of [[-53.5, 24.5, 90], [-48, 30.6, 0], [-44, 30.6, 0], [-53.5, 15.5, 90]]) D('rack', x, z, 0, r, 1, -3); // 染坊曬布架，貼邊擺，避開架槍線

// ---------- 導航 ----------
const nodes = []; const edges = [];
const P = (id, x, z, tags = [], hint) => nodes.push({ id, x, y: groundY(x, z, hint), z, tags });
const E = (...ids) => { for (let i = 1; i < ids.length; i++) edges.push([ids[i - 1], ids[i]]); };
const NAV = [
  ['a0', 0, -42], ['a1', -8, -48], ['a2', 8, -42], ['a3', 6, -38],
  ['lw1', -21, -46], ['lwj', -30, -46], ['lwk', -30, -50], ['lw2', -42, -50], ['lw3', -42, -38], ['wy', -44, -26], ['wy2', -54, -18], ['wy3', -38, -26],
  ['wn1', -54, -13], ['wn2', -54, -2], ['cl1', -54, 5], ['cl2', -49.5, 5], ['cl3', -38.5, 5],
  ['bs', -38.5, 11, ['choke', 'hold-atk']], ['b1', -38.5, 16, ['site-B']], ['b5', -50, 18, ['site-B', 'hold-def']], ['b6', -38.5, 22, ['site-B']], ['b2', -44, 18, ['site-B']], ['b3', -50, 26, ['site-B', 'hold-def']], ['b4', -39, 24, ['site-B']], ['be', -34, 22, ['choke', 'hold-atk']],
  ['sl', -30, 22], ['sl2', -30, 6], ['sl3', -30, 2], ['sl4', -30, -2], ['ll', -49.5, -2], ['ll2', -49.5, 1],
  ['sl5', -18, 2], ['sl6', -14, 2], ['sl7', -22, 2], ['sl8', -22, -6], ['sl9', -30, -6], ['p0', -10, 2], ['ps', -10, -11], ['ps4', -4, -9.5, ['choke']], ['pn', 0, 9], ['pe', 9, 0], ['pne', 9, 6], ['ps2', 1, -10],
  ['se', -10, -16, ['choke']], ['s0', 0, -26], ['s1', 6, -30], ['s2', -10, -22], ['s3', -10, -29], ['s4', 10, -22], ['g1', 6, -34, ['choke']],
  ['sw1', -22, -26], ['sw1b', -22, -30], ['sw1c', -16, -31], ['sw2', -30, -26], ['se1', 14, -22], ['se2', 26, -22], ['se3', 26, -28], ['se4', 36, -28],
  ['te', 22, -42], ['te2', 26, -42], ['te3', 26, -34], ['te4', 36, -34], ['ey0', 42, -34], ['ey', 48, -33], ['ey2', 58, -22], ['ey4', 54, -34], ['ey3', 42, -28],
  ['r1', 58, -16], ['an', 58, -10], ['an2', 44, -10], ['al', 43, -4], ['pad', 44, 2], ['st', 44, 8, ['choke']], ['ap', 44, 13], ['sa', 44, 18, ['site-A']],
  ['sa2', 44, 28, ['site-A']], ['sa3', 38, 32, ['site-A', 'hold-def']], ['sa4', 42, 36, ['hold-def']], ['sa5', 50, 29, ['site-A']], ['sa6', 52, 16, ['site-A', 'hold-atk']],
  ['nl1', 42, 44], ['nl2', 42, 50], ['nl3', 34, 50], ['nl4', 26, 50], ['nl5', 26, 45], ['nl6', 18, 45],
  ['d0', -8, 44], ['d1', -16, 51], ['d2', 8, 46], ['d3', 9.5, 42.6], ['ds', 10, 36], ['j', 0, 26], ['j2', 10, 30], ['j3', 10, 26], ['ns0', 10.5, 10.5], ['ns', 10.5, 14], ['ns2', -2, 14], ['ns3', -7, 14],
  ['je', 12, 26], ['ne', 18, 26], ['ne2', 18, 14], ['ne3', 22, 14], ['l1', 26, 14], ['l2', 26, 6], ['l3', 26, -2], ['lk', 34, -2], ['lk2', 34, 2], ['pad2', 38, 1.1],
  ['fl', 18, 6], ['ul', 26, 20], ['ul2', 26, 32], ['ul3', 34, 32],
  ['rf1', 22, 0], ['rf2', 22, -14], ['rs', 8, -14], ['rs0', 1, -14],
  ['jw', -12, 26], ['nw', -22, 26], ['nw2', -30, 26], ['rn', -10, 18, ['hold-def']],
  ['dw', -24, 52], ['dw2', -30, 52], ['dw3', -30, 42], ['dw4', -38, 42], ['dw5', -48, 42], ['ng', -48, 36, ['choke']], ['ng2', -48, 29],
  ['nl', -58, 42], ['nb', -58, 38], ['nb2', -58, 32], ['bl', -58, 26], ['bl2', -58, 15, ['hold-def']],
  ['r3a', -30, -20], ['r3b', -30, -14], ['r3c', -14, -14], ['r3d', -14, -4, ['hold-atk']], ['rmp', 58, 24, ['hold-def']], ['rmp2', 58, 32, ['hold-def']], ['rmp0', 58, 15], ['hc', 43.2, -6, ['hold-atk']], ['hs', 8, -30, ['hold-atk']],
];
const HINT = { pe: 0, pne: 0 };
for (const [id, x, z, tags] of NAV) P(id, x, z, tags || [], HINT[id]);
E('a1', 'a0', 'a2', 'a3', 'g1', 's1', 's0', 's2', 'se', 'ps');
E('a0', 'a3');
E('a1', 'lw1', 'lwj', 'lwk', 'lw2', 'lw3', 'wy', 'wy2', 'wn1', 'wn2', 'cl1', 'cl2', 'cl3', 'bs', 'b1', 'b2', 'b5', 'b3', 'ng2', 'ng', 'dw5', 'dw4', 'dw3', 'dw2', 'dw', 'd1', 'd0', 'd2', 'nl6', 'nl5', 'nl4', 'nl3', 'nl2', 'nl1', 'sa4', 'sa2', 'sa', 'ap', 'st', 'pad', 'al', 'an2', 'an', 'r1', 'ey2', 'ey4', 'ey', 'ey0', 'te4', 'te3', 'te2', 'te', 'a2');
E('wy', 'wy3', 'sw2', 'sw1', 'sw1b', 'sw1c', 's3', 's2'); E('s1', 's4', 'se1', 'se2', 'se3', 'se4', 'ey3', 'ey');
E('wn2', 'll', 'sl4', 'sl3', 'sl2', 'sl', 'be', 'b6', 'b1'); E('ll', 'll2', 'cl2'); E('b6', 'b4'); E('sl4', 'sl9', 'sl8', 'sl7', 'sl5', 'sl6', 'p0');
E('sl', 'nw2', 'nw', 'jw', 'j'); E('jw', 'rn');
E('ps', 'ps4', 'ps2', 'pe'); E('ps4', 'p0', 'pn', 'pe'); E('pe', 'pne', 'fl', 'l2', 'l3', 'lk', 'lk2', 'pad2', 'pad');
E('pne', 'ns0', 'ns', 'ns2', 'ns3', 'rn'); E('j', 'j3', 'j2', 'ds', 'd3', 'd2'); E('j', 'je', 'ne', 'ne2', 'ne3', 'l1', 'l2'); E('l1', 'ul', 'ul2', 'ul3', 'sa3', 'sa2');
E('l3', 'rf1', 'rf2', 'rs', 'rs0', 'ps2');
E('dw5', 'nl', 'nb', 'nb2', 'bl', 'bl2');
E('wy3', 'sw2', 'r3a', 'r3b', 'r3c', 'r3d');
E('sa2', 'sa5', 'sa6', 'sa'); E('sa6', 'rmp0', 'rmp', 'rmp2'); E('al', 'hc', 'an2'); E('s1', 'hs');

const spawn = (cx, cz, yaw) => [[0, 0], [-3, 0], [3, 0], [-1.5, 3 * Math.sign(cz)], [1.5, 3 * Math.sign(cz)]].map(([dx, dz]) => ({ x: cx + dx, y: groundY(cx + dx, cz + dz), z: cz + dz, yaw }));

export const LAYOUT = {
  name: '日晷坊',
  bounds: { x0: B0, z0: B0, x1: B1, z1: B1 },
  ground, ramps, blocks, walls, cover, deco,
  sites: { A: { x0: 32, z0: 14, x1: 56, z1: 38, y: 7 }, B: { x0: -56, z0: 8, x1: -36, z1: 32, y: -3 } },
  spawns: { atk: spawn(0, -44, 0), def: spawn(-8, 44, 180) },
  nav: { nodes, edges },
  callouts: [
        { name: '門樓', x0: 40, z0: 12, x1: 48, z1: 15 },
    { name: '炸點 A', x0: 32, z0: 14, x1: 56, z1: 38 }, { name: '炸點 B', x0: -56, z0: 8, x1: -36, z1: 32 },
    { name: '堡壘壁道', x0: 56, z0: 14, x1: 60, z1: 38 },
    { name: '碑牆', x0: -12, z0: -12, x1: -4, z1: -8 },
    { name: '日晷廣場', x0: -12, z0: -12, x1: 12, z1: 12 },
    { name: '南外階', x0: 0, z0: -16, x1: 12, z1: -12 },
    { name: '東騎樓', x0: 12, z0: -12, x1: 16, z1: 4, y1: 2 },
    { name: '東平頂', x0: 12, z0: -16, x1: 24, z1: 4 },
    { name: '騎樓階', x0: 12, z0: 4, x1: 24, z1: 8 },
    { name: '東露台', x0: 24, z0: -4, x1: 28, z1: 16 },
    { name: '上堡階', x0: 24, z0: 16, x1: 32, z1: 34 },
    { name: '東橫巷', x0: 28, z0: -4, x1: 36, z1: 4 },
    { name: '燈巷', x0: 40, z0: -12, x1: 46, z1: 0 },
    { name: '塔前階', x0: 36, z0: 0, x1: 52, z1: 14 },
    { name: '折巷', x0: 46, z0: -12, x1: 60, z1: -8 },
    { name: '折巷坡', x0: 56, z0: -20, x1: 60, z1: -12 },
    { name: '東棧場', x0: 40, z0: -44, x1: 60, z1: -20 },
    { name: '東營巷', x0: 12, z0: -44, x1: 40, z1: -32 },
    { name: '東橫街', x0: 12, z0: -30, x1: 40, z1: -20 },
    { name: '南院', x0: -12, z0: -32, x1: 12, z1: -12 },
    { name: '赤沙營地', x0: -12, z0: -56, x1: 12, z1: -32 },
    { name: '西營巷', x0: -44, z0: -52, x1: -12, z1: -36 },
    { name: '西橫街', x0: -36, z0: -32, x1: -12, z1: -24 },
    { name: '望台坡', x0: -32, z0: -24, x1: -28, z1: -16 },
    { name: '南望台', x0: -32, z0: -16, x1: -12, z1: -12 },
    { name: '南望台', x0: -16, z0: -12, x1: -12, z1: 0 },
    { name: '西井院', x0: -56, z0: -36, x1: -36, z1: -16 },
    { name: '西斜街', x0: -56, z0: -16, x1: -52, z1: 2 },
    { name: '石柱廊', x0: -56, z0: 2, x1: -36, z1: 8 },
    { name: '染缸巷', x0: -52, z0: -4, x1: -32, z1: 2 },
    { name: '折角巷', x0: -32, z0: -8, x1: -12, z1: 4 },
    { name: '沉巷', x0: -36, z0: 4, x1: -28, z1: 28 },
    { name: '曬布台', x0: -60, z0: 12, x1: -56, z1: 36 },
    { name: '北門階', x0: -60, z0: 32, x1: -44, z1: 44 },
    { name: '西嶺街', x0: -44, z0: 40, x1: -20, z1: 54 },
    { name: '海防庭', x0: -20, z0: 40, x1: 4, z1: 56 },
    { name: '北堡巷', x0: 4, z0: 38, x1: 44, z1: 52 },
    { name: '晷影階', x0: -4, z0: 12, x1: 12, z1: 16 },
    { name: '北露台', x0: -24, z0: 12, x1: -4, z1: 24 },
    { name: '北街坡', x0: -28, z0: 24, x1: -16, z1: 28 },
    { name: '海防階', x0: 8, z0: 28, x1: 12, z1: 40 },
    { name: '北街口', x0: -16, z0: 24, x1: 8, z1: 40 },
    { name: '北街東段', x0: 8, z0: 12, x1: 24, z1: 28 },
  ],
  sundial: { x: 0, z: 0, y: 0, r: 3, h: 0.9, gnomon: { w: 0.6, d: 3.2, h: 4.4 } },
  // y 是眼睛的絕對高度（地面 + 1.7），yaw 0 朝 +z、90 朝 +x，pitch 正值抬頭，單位度。
  spots: {
    key: { x: 42.9, y: 5.2, z: -7.5, yaw: 1.5, pitch: 4.5 },
    siteA: { x: 35, y: 8.7, z: 16, yaw: 40, pitch: -2 },
    siteB: { x: -38.6, y: -1.3, z: 15, yaw: -35, pitch: -1 },
    mid: { x: -14, y: 5.2, z: -3, yaw: 75, pitch: -8 },
    alley: { x: -30, y: 0.7, z: 3, yaw: 0, pitch: 0 },
  },
};
const out = process.argv[2] || join(HERE, '../src/map/layout.js');
const J = (v) => JSON.stringify(v);
const list = (k, arr) => `  ${k}: [\n${arr.map((e) => `    ${J(e)},`).join('\n')}\n  ],\n`;
const head = `// 作品 278 赭線：地圖「日晷坊」。由 tools/gen-layout.mjs 產生，純資料，要改請改產生器。
// 座標公尺，x 東 z 北 y 上。格式見 tools/check-layout.mjs 檔頭，另有擴充：
// - blocks[].plinth = true：墊在地面板或樓梯下的擋土實體，只有邊緣側面會露出來。
// - spots：鏡位，y 是眼睛絕對高度，yaw 0 朝 +z、90 朝 +x，pitch 正值抬頭，單位度。
// - callouts[].y1：有這欄時只算這個高度以下（同一塊地上下兩層不同地名）；同一地名可有多個矩形。
// - sundial.gnomon：晷針尺寸，碰撞在 cover 的 sundial／gnomon 兩件。
`;
let body = `export const LAYOUT = {\n  name: ${J(LAYOUT.name)},\n  bounds: ${J(LAYOUT.bounds)},\n`;
for (const k of ['ground', 'ramps', 'blocks', 'walls', 'cover', 'deco']) body += list(k, LAYOUT[k]);
body += `  sites: ${J(LAYOUT.sites)},\n  spawns: ${J(LAYOUT.spawns)},\n  nav: {\n    nodes: ${J(LAYOUT.nav.nodes)},\n    edges: ${J(LAYOUT.nav.edges)},\n  },\n`;
body += list('callouts', LAYOUT.callouts);
body += `  sundial: ${J(LAYOUT.sundial)},\n  spots: ${J(LAYOUT.spots)},\n};\n`;
writeFileSync(out, head + body);
