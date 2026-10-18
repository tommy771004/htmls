// 已開設城市商家的剖面室內：拿掉屋頂，前、右兩面只留矮牆與玻璃欄杆，
// 露出棋盤地板、依業種擺的家具、櫃台店員與入座的客人。家具位置同時產生客人的「座位」，
// people.js 以同一份 plan 讓客人走進店裡坐下或站在器材前。
import { T } from './geo.js';
import { CITY_LOTS, lotRect } from './layout.js';
import { PAL, WALLS } from './world.js';

const TBOX = T.box;
// 室內地板高：F1 在街區平台上，Lv3 多一層 F2，以展開的方式懸在上方（細柱支撐、玻璃電梯井連通）
export const F1Y = 0.3, F2Y = 10.2;
let FY = F1Y;
const WALL_H = 3.1; // 牆高（自樓板起算）

export function roomOf(id) {
  const [c, r, side] = CITY_LOTS[id];
  const rr = lotRect(c, r, side);
  const seed = c * 7 + r * 3 + (side === 'E' ? 1 : 0);
  return { x0: rr.x0 + 0.2, x1: rr.x1 - 0.2, z0: rr.z0 + 4, z1: rr.z1, cx: (rr.x0 + rr.x1) / 2, wall: WALLS[(seed * 5 + 2) % WALLS.length] };
}

// 只算座位、不出幾何時用
const NUL = new Proxy({}, { get: () => function () { return this; } });

// ───────── 共用家具 ─────────
function chair(S, x, z, yaw, c) {
  const s = Math.sin(yaw), k = Math.cos(yaw);
  S.add(TBOX, x, FY + 0.42, z, 0.48, 0.07, 0.48, yaw, c);
  S.add(TBOX, x - s * 0.22, FY + 0.42, z - k * 0.22, 0.48, 0.55, 0.07, yaw, c);
  S.add(TBOX, x, FY, z, 0.08, 0.42, 0.08, yaw, PAL.lampPole);
}
function stool(S, x, z, c) {
  S.cyl(x, FY, z, 0.05, 0.7, PAL.lampPole, 6);
  S.cyl(x, FY + 0.7, z, 0.24, 0.08, c, 8);
}
function roundTable(S, x, z, r, top) {
  S.cyl(x, FY, z, 0.06, 0.74, PAL.lampPole, 6);
  S.cyl(x, FY + 0.74, z, r, 0.06, top, 12);
}
function counter(S, x0, z0, x1, z1, h, body, top) {
  S.box(x0, FY, z0, x1, FY + h - 0.06, z1, body);
  S.box(x0 - 0.06, FY + h - 0.06, z0 - 0.06, x1 + 0.06, FY + h, z1 + 0.06, top);
}
// 店員：靜態小人（和行人同比例）
function staff(S, x, z, yaw, shirt) {
  S.add(TBOX, x - 0.11, FY, z, 0.17, 0.82, 0.2, yaw, '#4a4f58');
  S.add(TBOX, x + 0.11, FY, z, 0.17, 0.82, 0.2, yaw, '#4a4f58');
  S.add(TBOX, x, FY + 0.78, z, 0.48, 0.66, 0.28, yaw, shirt);
  S.add(TBOX, x, FY + 1.2, z + 0.15 * Math.cos(yaw), 0.5, 0.42, 0.06, yaw, PAL.white);
  S.ball(x, FY + 1.43, z, 0.21, '#e0ac85', 1);
  S.ball(x, FY + 1.6, z - 0.04, 0.2, '#3d2f28', 0, 0.6);
}
function plant(S, x, z, big = false) {
  S.box(x - 0.3, FY, z - 0.3, x + 0.3, FY + 0.55, z + 0.3, '#b8875e');
  S.ball(x, FY + 0.45, z, big ? 0.62 : 0.45, PAL.leaf2, 0);
  if (big) S.ball(x + 0.15, FY + 1.05, z - 0.1, 0.42, PAL.leaf, 0);
}
function floorLamp(S, B, x, z) {
  S.cyl(x, FY, z, 0.18, 0.05, PAL.lampPole, 8);
  S.cyl(x, FY, z, 0.03, 1.5, PAL.lampPole, 6);
  B.cone(x, FY + 1.45, z, 0.28, 0.32, '#f4d58a', 8);
}
// 背牆（朝 +z）上的畫框
function frameZ(S, x, y, z, w, h, c) {
  S.box(x - w / 2 - 0.07, y - 0.07, z, x + w / 2 + 0.07, y + h + 0.07, z + 0.05, PAL.woodDark, true);
  S.box(x - w / 2, y, z + 0.05, x + w / 2, y + h, z + 0.08, c, true);
}
// 左牆（朝 +x）上的畫框
function frameX(S, x, y, z, w, h, c) {
  S.box(x, y - 0.07, z - w / 2 - 0.07, x + 0.05, y + h + 0.07, z + w / 2 + 0.07, PAL.woodDark, true);
  S.box(x + 0.05, y, z - w / 2, x + 0.08, y + h, z + w / 2, c, true);
}
function wc(S, x0, z0, wall) {
  // 角落的洗手間隔間（影片裡每家店都有）
  S.box(x0, FY, z0, x0 + 2.4, FY + 2.3, z0 + 2.2, '#eef0ea');
  S.box(x0 - 0.04, FY + 2.3, z0 - 0.04, x0 + 2.44, FY + 2.4, z0 + 2.24, wall);
  S.box(x0 + 0.7, FY, z0 + 2.2, x0 + 1.6, FY + 2.0, z0 + 2.26, '#2f5a47', true);
  S.box(x0 + 0.85, FY + 2.05, z0 + 2.2, x0 + 1.45, FY + 2.25, z0 + 2.27, PAL.white, true);
}
function shelfZ(S, x0, x1, z, h, depth, body, goods) {
  // 背靠 -z 的貨架，正面朝 +z
  S.box(x0, FY, z, x1, FY + h, z + depth, body);
  for (let y = FY + 0.45; y < FY + h - 0.2; y += 0.55) {
    S.box(x0 + 0.08, y, z + depth, x1 - 0.08, y + 0.05, z + depth + 0.04, PAL.trim, true);
    for (let x = x0 + 0.15; x < x1 - 0.3; x += 0.42) S.box(x, y + 0.05, z + depth - 0.25, x + 0.3, y + 0.38, z + depth + 0.02, goods[Math.abs(Math.floor(x * 7 + y * 3)) % goods.length], true);
  }
}
function shelfX(S, x, z0, z1, h, depth, body, goods) {
  // 背靠 -x 的貨架，正面朝 +x
  S.box(x, FY, z0, x + depth, FY + h, z1, body);
  for (let y = FY + 0.45; y < FY + h - 0.2; y += 0.55) {
    S.box(x + depth, y, z0 + 0.08, x + depth + 0.04, y + 0.05, z1 - 0.08, PAL.trim, true);
    for (let z = z0 + 0.15; z < z1 - 0.3; z += 0.42) S.box(x + depth - 0.25, y + 0.05, z, x + depth + 0.02, y + 0.38, z + 0.3, goods[Math.abs(Math.floor(z * 5 + y * 3)) % goods.length], true);
  }
}
const GOODS = ['#c8453c', '#2f7f8f', '#d9a63e', '#e8e2d0', '#5f8790', '#8ea488', '#e07a5f', '#6a5a8a'];
const BOOKS = ['#7a3b3b', '#2d5a45', '#3f5f7a', '#b5793a', '#d9b648', '#6a5a8a', '#e8e2d0', '#a8462f'];

// ───────── 業種 ─────────
// 每個函式回傳 [地板色A, 地板色B, 牆內色]，並往 spots 推座位 {x, z, yaw, pose}
const PLAN = {
  cafe(S, B, R, z, spot, n, color) {
    counter(S, R.x0 + 0.6, R.z0 + 0.6, R.cx + 3, R.z0 + 1.6, 1.05, color, '#e9dcc4');
    S.box(R.x0 + 1.2, FY + 1.05, R.z0 + 0.8, R.x0 + 1.9, FY + 1.6, R.z0 + 1.3, '#8f9a96'); // 咖啡機
    S.box(R.x0 + 3, FY + 1.05, R.z0 + 0.7, R.x0 + 4.6, FY + 1.45, R.z0 + 1.5, '#cfe3e0');  // 甜點櫃
    staff(S, R.x0 + 2.6, R.z0 + 0.35, 0, color);
    tables(S, R, z, n, spot, (x, zz) => { roundTable(S, x, zz, 0.45, '#efe6d2'); }, '#2f5a47');
    return ['#e9dcc0', '#d8c7a3', '#efe6d2'];
  },
  bakery(S, B, R, z, spot, n, color) {
    shelfZ(S, R.x0 + 0.5, R.cx + 2, R.z0 + 0.3, 2.2, 0.6, '#9a6b48', ['#c98a4a', '#b5793a', '#e0b070', '#a86a3a']);
    counter(S, R.x0 + 0.8, R.z0 + 2.4, R.cx - 1.8, R.z0 + 3.2, 1.0, '#e8e2d0', color);
    for (let x = R.x0 + 1.1; x < R.cx - 2; x += 0.6) S.ball(x, FY + 1.0, R.z0 + 2.8, 0.2, '#c98a4a', 0, 0.7);
    staff(S, R.x0 + 2.4, R.z0 + 1.6, 0, color);
    tables(S, R, z, n, spot, (x, zz) => { roundTable(S, x, zz, 0.42, '#f2e8cf'); }, '#b5793a');
    return ['#efe0c8', '#e3cfae', '#f2e8cf'];
  },
  burger(S, B, R, z, spot, n, color) {
    counter(S, R.x0 + 0.6, R.z0 + 0.6, R.x1 - 3, R.z0 + 1.5, 1.05, color, '#e8e2d0');
    S.box(R.x0 + 0.6, FY, R.z0 + 0.3, R.x1 - 3, FY + 2.2, R.z0 + 0.5, '#5a5f5c');
    staff(S, R.cx - 1, R.z0 + 0.35, 0, color);
    staff(S, R.cx + 1.5, R.z0 + 0.35, 0, '#f2e8cf');
    // 左側卡座：兩排紅色長椅夾一張桌子
    let k = 0;
    for (let zz = z.a + 0.6; zz < z.b && k < n.rows; zz += 2.7, k++) {
      const x = (R.zl0 + R.zl1) / 2;
      S.box(R.zl0, FY, zz - 1.15, R.zl1, FY + 0.45, zz - 0.65, '#b4513c');
      S.box(R.zl0, FY, zz - 1.25, R.zl1, FY + 1.1, zz - 1.1, '#9a4334');
      S.box(R.zl0, FY, zz + 0.65, R.zl1, FY + 0.45, zz + 1.15, '#b4513c');
      S.box(R.zl0, FY, zz + 1.1, R.zl1, FY + 1.1, zz + 1.25, '#9a4334');
      S.box(R.zl0 + 0.2, FY + 0.72, zz - 0.5, R.zl1 - 0.2, FY + 0.78, zz + 0.5, '#f2e8cf');
      S.box(x - 0.08, FY, zz - 0.08, x + 0.08, FY + 0.72, zz + 0.08, PAL.lampPole);
      for (const dx of [-0.9, 0.9]) { spot(x + dx, zz - 0.9, 0, 'sit'); spot(x + dx, zz + 0.9, Math.PI, 'sit'); }
    }
    tables(S, R, z, n, spot, (x, zz) => { S.box(x - 0.5, FY + 0.72, zz - 0.5, x + 0.5, FY + 0.78, zz + 0.5, '#f2e8cf'); S.box(x - 0.06, FY, zz - 0.06, x + 0.06, FY + 0.72, zz + 0.06, PAL.lampPole); }, '#b4513c', 'R');
    return ['#c8574a', '#f1e6cf', '#f2e8cf'];
  },
  pizza(S, B, R, z, spot, n, color) {
    // 磚造圓頂窯
    S.box(R.x0 + 0.6, FY, R.z0 + 0.4, R.x0 + 3.6, FY + 0.9, R.z0 + 2.6, '#a8584a');
    S.add(T.ico1, R.x0 + 2.1, FY + 0.55, R.z0 + 1.5, 2.8, 2.2, 2.2, 0, '#b5664a');
    S.box(R.x0 + 1.7, FY + 0.95, R.z0 + 2.45, R.x0 + 2.5, FY + 1.55, R.z0 + 2.6, '#2a1d17', true);
    B.box(R.x0 + 1.8, FY + 1.0, R.z0 + 2.58, R.x0 + 2.4, FY + 1.3, R.z0 + 2.62, '#ff9a50', true);
    counter(S, R.cx - 1, R.z0 + 0.6, R.x1 - 0.6, R.z0 + 1.5, 1.0, '#e8e2d0', color);
    staff(S, R.x0 + 4.4, R.z0 + 1.4, 0, PAL.white);
    tables(S, R, z, n, spot, (x, zz) => {
      S.box(x - 0.55, FY + 0.72, zz - 0.55, x + 0.55, FY + 0.78, zz + 0.55, PAL.white);
      for (let i = 0; i < 3; i++) S.box(x - 0.55 + i * 0.4, FY + 0.78, zz - 0.55, x - 0.35 + i * 0.4, FY + 0.785, zz + 0.55, '#c8453c', true);
      S.box(x - 0.06, FY, zz - 0.06, x + 0.06, FY + 0.72, zz + 0.06, PAL.lampPole);
    }, '#5a4a3a');
    return ['#ddd0b5', '#c9b994', '#efe6d2'];
  },
  bar(S, B, R, z, spot, n, color) {
    counter(S, R.x0 + 0.6, R.z0 + 1.4, R.x1 - 3, R.z0 + 2.2, 1.1, '#6c4f37', '#3a2a20');
    S.box(R.x0 + 0.6, FY, R.z0 + 0.3, R.x1 - 3, FY + 2.4, R.z0 + 0.6, '#4a3528');
    for (let y of [1.3, 1.9]) for (let x = R.x0 + 0.8; x < R.x1 - 3.2; x += 0.3) S.cyl(x, FY + y, R.z0 + 0.5, 0.07, 0.4, GOODS[Math.floor(x * 3) % GOODS.length], 6);
    staff(S, R.cx, R.z0 + 0.95, 0, '#2a2a2a');
    for (let x = R.x0 + 1.2, k = 0; x < R.x1 - 3.4; x += 1.1, k++) { stool(S, x, R.z0 + 2.75, '#a8462f'); if (k < n.bar) spot(x, R.z0 + 2.75, Math.PI, 'sit'); }
    // 撞球台
    if (n.lv >= 2) {
      const px = (R.zr0 + R.zr1) / 2, pz = z.a + 2.2;
      S.box(px - 1.0, FY, pz - 1.7, px + 1.0, FY + 0.8, pz + 1.7, '#5a3a28');
      S.box(px - 0.85, FY + 0.8, pz - 1.55, px + 0.85, FY + 0.84, pz + 1.55, '#2f6b55');
      spot(px + 1.4, pz, -Math.PI / 2, 'stand');
      spot(px - 1.4, pz + 1, Math.PI / 2, 'stand');
    }
    tables(S, R, { a: z.a + (n.lv >= 2 ? 4.5 : 0), b: z.b }, n, spot, (x, zz) => { roundTable(S, x, zz, 0.4, '#3a2a20'); }, '#a8462f', 'R');
    tables(S, R, z, n, spot, (x, zz) => { roundTable(S, x, zz, 0.4, '#3a2a20'); }, '#a8462f', 'L');
    return ['#7a5a3f', '#6c4f37', '#c9b79a'];
  },
  mart(S, B, R, z, spot, n, color) {
    // 背牆冷藏櫃
    S.box(R.x0 + 0.5, FY, R.z0 + 0.3, R.x1 - 3, FY + 2.2, R.z0 + 1.0, '#dfe6e3');
    for (let x = R.x0 + 0.6; x < R.x1 - 3.1; x += 1.0) S.box(x, FY + 0.2, R.z0 + 1.0, x + 0.9, FY + 2.0, R.z0 + 1.03, '#a9cfd0', true);
    // 貨架走道（沿 z 方向）
    let k = 0;
    for (const [a, b] of [[R.zl0, R.zl1], [R.zr0, R.zr1]]) {
      const mid = (a + b) / 2;
      const len = Math.min(z.b - z.a - 2.5, 4 + n.lv * 2.2);
      const z0 = z.a + 0.6, z1 = z0 + len;
      S.box(mid - 0.45, FY, z0, mid + 0.45, FY + 1.6, z1, '#e8e2d0');
      for (let y = FY + 0.35; y < FY + 1.5; y += 0.4) for (let zz = z0 + 0.1; zz < z1 - 0.3; zz += 0.45) {
        const c = GOODS[(k++ * 7) % GOODS.length];
        S.box(mid + 0.45, y, zz, mid + 0.55, y + 0.3, zz + 0.32, c, true);
        S.box(mid - 0.55, y, zz, mid - 0.45, y + 0.3, zz + 0.32, c, true);
      }
      for (let zz = z0 + 1; zz < z1; zz += 2.2) { spot(mid + 1.1, zz, -Math.PI / 2, 'stand'); spot(mid - 1.1, zz + 1, Math.PI / 2, 'stand'); }
    }
    // 結帳櫃台在入口旁
    counter(S, R.cx + 1.8, R.z1 - 3.4, R.x1 - 1.0, R.z1 - 2.6, 1.0, color, '#e8e2d0');
    staff(S, R.x1 - 2.2, R.z1 - 3.9, 0, color);
    return ['#e6e8e0', '#d9ddd3', '#eef0ea'];
  },
  books(S, B, R, z, spot, n, color) {
    shelfZ(S, R.x0 + 0.4, R.x1 - 3, R.z0 + 0.3, 3.0, 0.5, '#6c4f37', BOOKS);
    shelfX(S, R.x0 + 0.3, R.z0 + 1.2, R.z1 - 2, 3.0, 0.5, '#6c4f37', BOOKS);
    // 中島書台
    let k = 0;
    for (let zz = z.a + 0.8; zz < z.b - 1 && k < n.rows; zz += 3.2, k++) {
      const x = (R.zr0 + R.zr1) / 2;
      S.box(x - 1.2, FY, zz - 0.6, x + 1.2, FY + 0.9, zz + 0.6, '#9a6b48');
      for (let i = 0; i < 5; i++) S.box(x - 1.1 + i * 0.45, FY + 0.9, zz - 0.4, x - 0.75 + i * 0.45, FY + 0.98, zz + 0.4, BOOKS[(i + k) % BOOKS.length]);
      spot(x, zz + 1.1, Math.PI, 'stand');
      spot(x - 1.7, zz, Math.PI / 2, 'stand');
    }
    // 閱讀扶手椅
    for (let zz = z.a + 1.5, j = 0; zz < z.b && j < n.rows; zz += 3.4, j++) {
      const x = (R.zl0 + R.zl1) / 2 + 0.6;
      S.box(x - 0.55, FY, zz - 0.5, x + 0.55, FY + 0.45, zz + 0.5, '#8a4f6e');
      S.box(x - 0.55, FY, zz - 0.6, x + 0.55, FY + 1.0, zz - 0.4, '#7a4560');
      S.box(x - 0.6, FY, zz - 0.5, x - 0.45, FY + 0.7, zz + 0.5, '#7a4560');
      S.box(x + 0.45, FY, zz - 0.5, x + 0.6, FY + 0.7, zz + 0.5, '#7a4560');
      spot(x, zz, 0, 'sit');
    }
    counter(S, R.x1 - 2.8, R.z0 + 0.4, R.x1 - 0.6, R.z0 + 2.4, 1.0, color, '#e8e2d0');
    staff(S, R.x1 - 1.7, R.z0 + 0.15, 0, color);
    return ['#c7a57a', '#b8956b', '#efe6d2'];
  },
  boutique(S, B, R, z, spot, n, color) {
    // 更衣間（右後）、鏡子、衣架
    for (let i = 0; i < 2; i++) {
      const x0 = R.x1 - 3.2 + i * 1.5;
      S.box(x0, FY, R.z0 + 0.4, x0 + 0.08, FY + 2.2, R.z0 + 1.8, '#e8e2d0');
      S.box(x0 + 0.1, FY + 0.3, R.z0 + 1.7, x0 + 1.4, FY + 2.1, R.z0 + 1.75, color, true);
    }
    S.box(R.x0 + 0.4, FY + 0.3, R.z0 + 0.3, R.x0 + 1.6, FY + 2.4, R.z0 + 0.38, '#cfe3e0', true);
    const GAR = ['#c8453c', '#e8e2d0', '#2f7f8f', '#d9a63e', '#8a4f6e', '#3d5747', '#e07a5f'];
    let k = 0;
    for (const [a, b] of [[R.zl0, R.zl1], [R.zr0, R.zr1]]) {
      const mid = (a + b) / 2;
      for (let zz = z.a + 0.8, j = 0; zz < z.b && j < n.rows; zz += 2.8, j++) {
        S.box(mid - 1.3, FY + 1.5, zz - 0.03, mid + 1.3, FY + 1.56, zz + 0.03, PAL.metal);
        for (const sx of [-1.3, 1.3]) S.box(mid + sx - 0.03, FY, zz - 0.03, mid + sx + 0.03, FY + 1.56, zz + 0.03, PAL.metal);
        for (let x = mid - 1.15; x < mid + 1.2; x += 0.24) S.box(x, FY + 0.6, zz - 0.25, x + 0.16, FY + 1.48, zz + 0.25, GAR[k++ % GAR.length]);
        spot(mid, zz + 0.9, Math.PI, 'stand');
      }
    }
    // 人台
    for (const [x, zz] of [[R.cx - 2.6, R.z1 - 1.4], [R.cx + 2.6, R.z1 - 1.4]]) {
      S.cyl(x, FY, zz, 0.2, 0.05, PAL.lampPole, 8);
      S.cyl(x, FY, zz, 0.03, 0.9, PAL.lampPole, 6);
      S.box(x - 0.24, FY + 0.9, zz - 0.14, x + 0.24, FY + 1.55, zz + 0.14, color);
      S.ball(x, FY + 1.55, zz, 0.13, '#efe6d2');
    }
    counter(S, R.x0 + 2.2, R.z0 + 0.6, R.cx + 1, R.z0 + 1.4, 1.0, '#e8e2d0', color);
    staff(S, R.x0 + 3.5, R.z0 + 0.35, 0, color);
    return ['#e8dfd2', '#ddd2c2', '#f2ebe0'];
  },
  nail(S, B, R, z, spot, n, color) {
    counter(S, R.cx + 1.6, R.z0 + 0.5, R.x1 - 0.6, R.z0 + 1.3, 1.0, color, '#f2e8cf');
    S.box(R.x0 + 0.4, FY + 0.9, R.z0 + 0.3, R.cx, FY + 1.0, R.z0 + 0.6, PAL.trim);
    for (let x = R.x0 + 0.6; x < R.cx - 0.3; x += 0.22) S.cyl(x, FY + 1.0, R.z0 + 0.45, 0.06, 0.18, ['#c0607a', '#e07a5f', '#c8453c', '#e8b4c0'][Math.floor(x * 5) % 4], 6);
    let j = 0;
    for (const [a, b] of [[R.zl0, R.zl1], [R.zr0, R.zr1]]) {
      const mid = (a + b) / 2;
      for (let zz = z.a + 0.6, k = 0; zz < z.b && k < n.rows; zz += 2.4, k++, j++) {
        S.box(mid - 0.45, FY + 0.72, zz - 0.7, mid + 0.45, FY + 0.78, zz + 0.7, PAL.white);
        S.box(mid - 0.4, FY, zz - 0.6, mid + 0.4, FY + 0.72, zz + 0.6, '#e8d8d6');
        S.box(mid - 0.2, FY + 0.78, zz - 0.2, mid + 0.2, FY + 0.95, zz + 0.2, '#cfe3e0');
        chair(S, mid + 0.95, zz, -Math.PI / 2, '#c0607a');
        chair(S, mid - 0.95, zz, Math.PI / 2, PAL.white);
        spot(mid + 0.95, zz, -Math.PI / 2, 'sit');
        if (j % 2 === 0) staff(S, mid - 0.95, zz, Math.PI / 2, color);
      }
    }
    return ['#f0e2e0', '#e6d3d2', '#f6ece8'];
  },
  gym(S, B, R, z, spot, n, color) {
    // 置物櫃
    for (let i = 0; i < 5; i++) S.box(R.x0 + 0.5 + i * 0.62, FY, R.z0 + 0.3, R.x0 + 1.08 + i * 0.62, FY + 2.0, R.z0 + 0.8, i % 2 ? '#d9b648' : '#cfa83c');
    // 啞鈴架
    S.box(R.cx - 1.2, FY, R.z0 + 0.5, R.cx + 2.2, FY + 0.9, R.z0 + 1.0, '#2f3a36');
    for (let x = R.cx - 1; x < R.cx + 2.1; x += 0.36) S.add(T.cyl8, x, FY + 0.95, R.z0 + 0.75, 0.2, 0.3, 0.2, 0, '#3a3f3c', 0, Math.PI / 2);
    // 左：跑步機（面朝背牆）
    for (let zz = z.a + 0.8, k = 0; zz < z.b && k < n.rows; zz += 2.6, k++) {
      for (const x of [R.zl0 + 1.0, R.zl1 - 1.0]) {
        if (x < R.zl0 + 0.6 || x > R.zl1 - 0.6) continue;
        S.box(x - 0.45, FY, zz - 0.2, x + 0.45, FY + 0.22, zz + 1.4, '#2c3330');
        for (const sx of [-0.4, 0.4]) S.add(TBOX, x + sx, FY + 0.2, zz - 0.15, 0.08, 1.2, 0.08, 0, '#8fb3a6', -0.25);
        S.box(x - 0.45, FY + 1.25, zz - 0.5, x + 0.45, FY + 1.35, zz - 0.25, '#8fb3a6');
        spot(x, zz + 0.7, Math.PI, 'stand', FY + 0.22);
      }
    }
    // 右：臥推椅
    for (let zz = z.a + 0.8, k = 0; zz < z.b && k < n.rows; zz += 2.6, k++) {
      const x = (R.zr0 + R.zr1) / 2;
      S.box(x - 0.25, FY, zz, x + 0.25, FY + 0.45, zz + 1.3, '#e0763a');
      for (const sx of [-0.7, 0.7]) S.box(x + sx - 0.04, FY, zz - 0.1, x + sx + 0.04, FY + 1.1, zz - 0.02, '#3a3f3c');
      S.add(T.cyl8, x, FY + 1.05, zz - 0.06, 0.06, 1.9, 0.06, 0, '#8f9a96', 0, Math.PI / 2);
      for (const sx of [-0.85, 0.85]) S.add(T.cyl12, x + sx, FY + 1.05, zz - 0.06, 0.55, 0.1, 0.55, 0, '#2c3330', 0, Math.PI / 2);
      spot(x, zz + 0.6, Math.PI, 'sit');
    }
    return ['#8fb3a6', '#86aa9c', '#eef0ea'];
  },
};

// 兩人桌：一側一欄，從後往前排
function tables(S, R, z, n, spot, draw, chairC, only) {
  const sides = only === 'L' ? [[R.zl0, R.zl1]] : only === 'R' ? [[R.zr0, R.zr1]] : [[R.zl0, R.zl1], [R.zr0, R.zr1]];
  for (const [a, b] of sides) {
    const x = (a + b) / 2;
    for (let zz = z.a + 0.8, k = 0; zz < z.b && k < n.rows; zz += 2.5, k++) {
      draw(x, zz);
      chair(S, x - 0.95, zz, Math.PI / 2, chairC);
      chair(S, x + 0.95, zz, -Math.PI / 2, chairC);
      spot(x - 0.95, zz, Math.PI / 2, 'sit');
      spot(x + 0.95, zz, -Math.PI / 2, 'sit');
    }
  }
}

// 畫出（或只計算）某店某等級的室內；回傳座位清單
export function interior(S, B, id, lv, color) {
  const R = roomOf(id);
  R.zl0 = R.x0 + 0.7; R.zl1 = R.cx - 1.5; R.zr0 = R.cx + 1.5; R.zr1 = R.x1 - 0.7;
  const spots = [];
  const floors = lv >= 3 ? 2 : 1;
  for (let f = 1; f <= floors; f++) {
    FY = f === 1 ? F1Y : F2Y;
    const spot = (x, z, yaw, pose, y = FY) => spots.push({ x, z, yaw, pose, y, floor: f });
    // 兩層時右前角是電梯井，家具往後收
    const z = { a: R.z0 + 3.6, b: R.z1 - (floors > 1 ? 3.2 : 1.6) };
    const rowsMax = Math.floor((z.b - z.a - 0.8) / 2.5) + 1;
    const n = { lv, rows: Math.max(2, Math.round(rowsMax * [0, 0.5, 0.75, 1][lv])), bar: [0, 4, 6, 8][lv] };
    const [fa, fb, paint] = PLAN[id](S, B, R, z, spot, n, color);
    shell(S, B, R, fa, fb, paint, lv, color, f, floors > 1);
  }
  FY = F1Y;
  if (floors > 1) frame(S, B, R);
  return spots;
}

// 電梯：井在右前角，F1 從入口往右走到井的左側上車，F2 也在同一側下車
export function elevatorOf(id) {
  const R = roomOf(id);
  return { x: R.x1 - 1.5, z: R.z1 - 1.5, wait: [R.x1 - 3.1, R.z1 - 1.5], y0: F1Y, y1: F2Y, tag: [R.cx, F2Y + 3.6, R.z1] };
}

// 展開式結構：撐起 F2 的黃色與鐵紅色細柱、電梯井框架與纜繩
function frame(S, B, R) {
  const { x0, x1, z0, z1 } = R;
  const Y = '#d9b648', RUST = '#8a4a36';
  for (const [x, z, c] of [[x0 + 0.15, z0 + 0.15, RUST], [x0 + 0.15, z1 - 0.15, Y], [(x0 + x1) / 2, z1 - 0.15, RUST], [x1 - 0.15, z0 + 0.15, Y], [x1 - 0.15, (z0 + z1) / 2, RUST]]) {
    S.box(x - 0.14, F1Y, z - 0.14, x + 0.14, F2Y - 0.4, z + 0.14, c);
  }
  const ex0 = x1 - 2.6, ex1 = x1 - 0.4, ez0 = z1 - 2.6, ez1 = z1 - 0.4, top = F2Y + 2.9;
  for (const [x, z] of [[ex0, ez0], [ex1, ez0], [ex0, ez1], [ex1, ez1]]) S.box(x - 0.09, F1Y, z - 0.09, x + 0.09, top, z + 0.09, '#e0b646');
  for (const y of [F1Y, F2Y - 0.4, top]) {
    S.box(ex0, y, ez0 - 0.06, ex1, y + 0.12, ez0 + 0.06, '#e0b646');
    S.box(ex0, y, ez1 - 0.06, ex1, y + 0.12, ez1 + 0.06, '#e0b646');
    S.box(ex0 - 0.06, y, ez0, ex0 + 0.06, y + 0.12, ez1, '#e0b646');
    S.box(ex1 - 0.06, y, ez0, ex1 + 0.06, y + 0.12, ez1, '#e0b646');
  }
  // 背面玻璃（遠離鏡頭那面，不擋住車廂）
  S.box(ex0 + 0.1, F1Y, ez0 - 0.03, ex1 - 0.1, top, ez0 + 0.01, '#c9dedb', true);
  // 機房與纜繩
  S.box(ex0 - 0.1, top + 0.12, ez0 - 0.1, ex1 + 0.1, top + 0.9, ez1 + 0.1, '#2f5a47');
  S.box(ex0, top + 0.9, ez0, ex1, top + 1.0, ez1, PAL.trim);
  for (const dx of [0.8, 1.4]) S.box(ex0 + dx - 0.02, F1Y + 2.4, (ez0 + ez1) / 2 - 0.02, ex0 + dx + 0.02, top, (ez0 + ez1) / 2 + 0.02, '#2a2f30');
}
export function seatsOf(id, lv) { return interior(NUL, NUL, id, lv, '#000'); }

function shell(S, B, R, fa, fb, paint, lv, color, floor = 1, two = false) {
  const { x0, x1, z0, z1, cx, wall } = R;
  const t = 1.2;
  if (floor === 1) S.box(x0, 0.22, z0, x1, FY - 0.01, z1, '#b9b09a');
  else {
    // 懸空樓板：外緣是建築外牆色的樓板帶
    S.box(x0 - 0.1, FY - 0.5, z0 - 0.1, x1 + 0.1, FY - 0.01, z1 + 0.1, '#d3cab3');
    S.box(x0 - 0.12, FY - 0.5, z1 + 0.1, x1 + 0.12, FY - 0.1, z1 + 0.16, wall, true);
    S.box(x1 + 0.1, FY - 0.5, z0 - 0.12, x1 + 0.16, FY - 0.1, z1 + 0.16, wall, true);
  }
  for (let i = 0; x0 + i * t < x1 - 0.01; i++) {
    for (let j = 0; z0 + j * t < z1 - 0.01; j++) {
      const ax = x0 + i * t, az = z0 + j * t, bx = Math.min(ax + t, x1), bz = Math.min(az + t, z1);
      S.add(T.plane, (ax + bx) / 2, FY, (az + bz) / 2, bx - ax, 1, bz - az, 0, (i + j) % 2 ? fa : fb);
    }
  }
  // 背牆與左牆：外側是建築外牆色，內側是店內漆色，頂端簷口（高度都從樓板算起）
  const H = FY + WALL_H;
  S.box(x0, FY, z0, x1, H, z0 + 0.3, wall);
  S.box(x0 + 0.3, FY, z0 + 0.3, x1, H - 0.05, z0 + 0.34, paint, true);
  S.box(x0, FY, z0, x0 + 0.3, H, z1, wall);
  S.box(x0 + 0.3, FY, z0 + 0.3, x0 + 0.34, H - 0.05, z1, paint, true);
  S.box(x0 - 0.1, H, z0 - 0.1, x1 + 0.1, H + 0.22, z0 + 0.4, PAL.trim);
  S.box(x0 - 0.1, H, z0 - 0.1, x0 + 0.4, H + 0.22, z1 + 0.1, PAL.trim);
  // 前、右兩面矮牆＋玻璃欄杆（F1 入口在前面正中；F2 在右前角留電梯口）
  const rail = '#2f5a47', glass = '#c9dedb';
  const y1 = FY + 0.45, y2 = FY + 1.25, y3 = FY + 1.35;
  const lowZ = (a, b) => {
    S.box(a, FY, z1 - 0.25, b, y1, z1, wall);
    S.box(a, y1, z1 - 0.15, b, y2, z1 - 0.1, glass, true);
    S.box(a, y2, z1 - 0.2, b, y3, z1 - 0.05, rail);
    for (let x = a; x <= b + 0.01; x += Math.max(0.5, (b - a) / Math.ceil((b - a) / 2.4))) S.box(x - 0.05, y1, z1 - 0.2, x + 0.05, y3 - 0.05, z1 - 0.05, rail);
  };
  const upper = floor === 2;
  if (upper) lowZ(x0, x1 - 2.7);
  else { lowZ(x0, cx - 1.6); lowZ(cx + 1.6, x1); }
  const rz1 = upper ? z1 - 2.7 : z1;
  S.box(x1 - 0.25, FY, z0, x1, y1, rz1, wall);
  S.box(x1 - 0.15, y1, z0, x1 - 0.1, y2, rz1, glass, true);
  S.box(x1 - 0.2, y2, z0, x1 - 0.05, y3, rz1, rail);
  for (let z = z0 + 0.3; z < rz1; z += 2.4) S.box(x1 - 0.2, y1, z - 0.05, x1 - 0.05, y3 - 0.05, z + 0.05, rail);
  if (!upper) {
    // 入口門框與招牌、地墊
    for (const sx of [cx - 1.6, cx + 1.6]) S.box(sx - 0.08, FY, z1 - 0.2, sx + 0.08, FY + 2.6, z1 - 0.05, rail);
    S.box(cx - 1.9, FY + 2.6, z1 - 0.25, cx + 1.9, FY + 3.2, z1, color);
    S.box(cx - 1.5, FY + 2.72, z1, cx + 1.5, FY + 3.08, z1 + 0.03, PAL.cream, true);
    S.box(cx - 1.1, FY, z1 - 1.6, cx + 1.1, FY + 0.02, z1 - 0.3, '#5a4a3a', true);
  }
  // 洗手間在右後角
  wc(S, x1 - 2.75, z0 + 0.35, wall);
  // 牆上畫框
  const art = ['#d9a63e', '#2f7f8f', '#c8453c', '#8ea488', color];
  for (let k = 0; k < 2 + lv; k++) frameZ(S, x0 + 1.4 + k * 1.6, FY + 1.9, z0 + 0.34, 1.0, 0.7, art[(k + floor) % art.length]);
  for (let k = 0; k < 1 + lv; k++) frameX(S, x0 + 0.34, FY + 1.6, z0 + 4.6 + k * 3.4, 1.2, 0.9, art[(k + 2 + floor) % art.length]);
  if (lv >= 2) {
    plant(S, x0 + 0.8, z1 - 0.9, true);
    if (!two) plant(S, x1 - 0.8, z1 - 0.9, true);
    plant(S, x1 - 0.8, z0 + 3.2);
  }
  if (lv >= 3) {
    floorLamp(S, B, x0 + 0.8, z0 + 3.4);
    floorLamp(S, B, x1 - 0.8, (z0 + z1) / 2);
    // 背牆霓虹字條與欄杆燈串
    B.box(x0 + 1.2, FY + 2.65, z0 + 0.36, x0 + 6.2, FY + 2.8, z0 + 0.42, color, true);
    for (let x = x0 + 0.4; x < (upper ? x1 - 2.7 : x1); x += 0.9) if (upper || Math.abs(x - cx) > 1.7) B.ball(x, y3 + 0.1, z1 - 0.12, 0.08, '#ffe2a0');
  }
}
