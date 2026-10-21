// 夜間特技場的配置：跳台、曲牆 THE CURL、U 形牆、騎牆、大迴圈、聯結車與一排車、收集環、加速墊，
// 以及 Time Attack 的檢查點與引導線。同一份資料給畫面、物理與規則。不碰 DOM。
import { frame, sweepRamp, sweepChannel, loopTrack, arcProfile, MeshBuilder } from './geom.js';

export const PARK = { HALF: 470, WALL_H: 5 };
const D = Math.PI / 180;
const E = Math.PI / 2, W = -Math.PI / 2, S = Math.PI, N = 0;   // 朝東、西、南、北的 yaw

// 跳台剖面：圓弧上揚到 deg 度，可接平台
function kicker(R, deg, flat = 0) {
  const p = arcProfile(R, 0, deg * D, 0, 0, 14);
  if (flat) { const [s, h] = p[p.length - 1]; p.push([s + flat, h]); }
  return p;
}
// 落地坡：前緣是立面、頂部平台，然後圓弧下滑到地面
function lander(H, len, flat = 3) {
  const p = [[0, H], [flat, H]];
  const n = 14;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    // 平滑下降：頂端切線水平過渡到斜坡，再水平接地
    const e = t * t * (3 - 2 * t);
    p.push([flat + len * t, H * (1 - e)]);
  }
  return p;
}

// 所有地物。kind 決定畫面怎麼畫；solid 的會產生物理三角網格；box 是方塊碰撞
export function buildPark() {
  const pieces = [];
  const add = (kind, label, F, build, extra = {}) => {
    const top = new MeshBuilder(), side = new MeshBuilder();
    const r = build({ top, side });
    pieces.push({ kind, label, F, top: top.out(), side: side.out(), edges: r.edges, ...extra });
  };

  // THE CURL：跑道北端的巨型曲牆，半徑 30 的四分之一圓接 16 m 垂直面
  {
    const F = frame(0, 150, N);
    const prof = arcProfile(30, 0, 90 * D, 0, 0, 30);
    const [s, h] = prof[prof.length - 1];
    prof.push([s, h + 16]);
    add('curl', 'THE CURL', F, (o) => sweepRamp(F, prof, 46, o), { sign: F.p(s + 1.5, 0, h + 21) });
  }
  // 一排車：西側，起跳台 → 8 台並排停放的車 → 落地坡
  {
    const F = frame(-70, -60, W);
    add('kicker', 'LINEUP JUMP', F, (o) => sweepRamp(F, kicker(42, 24, 2), 16, o), { chevrons: true, sign: F.p(-4, 11, 9) });
    const L = frame(-196, -60, W);
    add('lander', '', L, (o) => sweepRamp(L, lander(4.5, 34), 22, o));
  }
  // 聯結車：東側，起跳台 → 橫放的聯結車 → 落地坡
  {
    const F = frame(70, 40, E);
    add('kicker', 'SEMI JUMP', F, (o) => sweepRamp(F, kicker(38, 26, 2), 16, o), { chevrons: true, sign: F.p(-4, -11, 9) });
    const L = frame(150, 40, E);
    add('lander', '', L, (o) => sweepRamp(L, lander(4, 30), 22, o));
  }
  // U 形牆：東南，平底 16 m、兩側半徑 10 的彎道接 8 m 直牆，長 180 m
  {
    const F = frame(190, -270, N);
    const R = 10, fl = 8, H = 18;
    // 左牆頂 → 左彎道 → 平底 → 右彎道 → 右牆頂
    const prof = [[-(fl + R), H]];
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * 90 * D; prof.push([-(fl + R) + R - R * Math.cos(a), R - R * Math.sin(a)]); }
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * 90 * D; prof.push([fl + R * Math.sin(a), R - R * Math.cos(a)]); }
    prof.push([fl + R, H]);
    // 去掉重複的點
    const clean = prof.filter((p, i) => !i || Math.hypot(p[0] - prof[i - 1][0], p[1] - prof[i - 1][1]) > 1e-4);
    add('halfpipe', 'HALF-PIPE', F, (o) => sweepChannel(F, clean, 180, fl + R + 2, { ...o, rows: 18 }), { sign: F.p(-6, 0, H + 6) });
  }
  // 騎牆：東側長牆，半徑 9 的彎道接 21 m 直牆，長 300 m（牆面在 x = 309，朝西）
  {
    const F = frame(300, -150, N);
    const R = 9, H = 30;
    const prof = [[0, 0]];
    for (let i = 1; i <= 16; i++) { const a = (i / 16) * 90 * D; prof.push([R * Math.sin(a), R - R * Math.cos(a)]); }
    prof.push([R, H]);
    add('wall', 'WALL RIDE', F, (o) => sweepChannel(F, prof, 300, R + 3, { ...o, rows: 30 }), { sign: F.p(150, R + 12, H + 5) });
  }
  // 大迴圈：西南，往東開進去，半徑 16、寬 13，出口往右錯開 15 m（z -228 進、-243 出）
  {
    const F = frame(-250, -228, E);
    add('loop', 'LOOP', F, (o) => loopTrack(F, 16, 13, -15, o), { sign: F.p(-34, 0, 12), loop: { R: 16, shift: -15, hw: 6.5 } });
  }
  // 天空環的大跳台
  {
    const F = frame(-142, -243, E);
    add('kicker', 'SKY KICKER', F, (o) => sweepRamp(F, kicker(34, 32, 1), 16, o), { chevrons: true, sign: F.p(-4, 11, 10) });
  }
  // 中央的小跳台群（自由練習用）：兩座高低不同的台子
  {
    const F = frame(-110, 120, S);
    add('kicker', '', F, (o) => sweepRamp(F, kicker(30, 20, 6), 14, o), { chevrons: true });
    const G = frame(-150, 160, E);
    add('kicker', '', G, (o) => sweepRamp(G, kicker(22, 30, 0), 12, o), { chevrons: true });
    const H = frame(100, 170, W);
    add('kicker', '', H, (o) => sweepRamp(H, kicker(60, 14, 0), 20, o), { chevrons: true });
  }

  // 方塊障礙：聯結車（橫放，長軸沿 Z）與一排停放的車
  const boxes = [];
  boxes.push({ kind: 'semi', x: 112, y: 2.1, z: 40, hx: 1.3, hy: 2.1, hz: 8.5, yaw: 0 });
  boxes.push({ kind: 'cab', x: 112, y: 1.75, z: 51.5, hx: 1.25, hy: 1.75, hz: 2.6, yaw: 0 });
  for (let i = 0; i < 8; i++) boxes.push({ kind: 'parked', x: -112 - i * 6.2, y: 0.7, z: -60, hx: 0.95, hy: 0.7, hz: 2.2, yaw: 0, tint: i });
  // 起終點拱門的兩根柱子
  boxes.push({ kind: 'pillar', x: -25, y: 7, z: -280, hx: 1.2, hy: 7, hz: 1.2, yaw: 0 });
  boxes.push({ kind: 'pillar', x: 25, y: 7, z: -280, hx: 1.2, hy: 7, hz: 1.2, yaw: 0 });
  boxes.push({ kind: 'pillar', x: 70, y: 7, z: -268, hx: 1.2, hy: 7, hz: 1.2, yaw: 0 });
  boxes.push({ kind: 'pillar', x: 70, y: 7, z: -212, hx: 1.2, hy: 7, hz: 1.2, yaw: 0 });

  return { pieces, boxes };
}

// 收集環（Free Ride）：6 個紅環
export const RINGS = [
  { x: 0, y: 62, z: 172, r: 6, axis: [0, 1, 0] },
  { x: 112, y: 13, z: 40, r: 5, axis: [1, 0, 0] },
  { x: 190, y: 26, z: -180, r: 5, axis: [1, 0, 0] },
  { x: 306, y: 15, z: 20, r: 5, axis: [0, 0, 1] },
  { x: -250, y: 28.4, z: -235.5, r: 3.2, axis: [1, 0, 0] },
  { x: -40, y: 42, z: 60, r: 6, axis: [0, 0, 1] },
];

// 加速墊：補冷氣並往前推。yaw 是箭頭方向
export const PADS = [
  { x: 0, z: -180, yaw: N }, { x: 0, z: 40, yaw: N },
  { x: -40, z: -60, yaw: W }, { x: 40, z: 40, yaw: E },
  { x: -185, z: -243, yaw: E }, { x: 190, z: -290, yaw: N },
  { x: 270, z: -120, yaw: N },
];

// 探照燈塔
export const TOWERS = [
  [-430, -430], [430, -430], [-430, 430], [430, 430], [0, -440], [0, 440], [-440, 0], [440, 0],
  [-60, -300], [60, 110], [-160, -20], [160, -150], [230, 90], [-300, 120],
];

// Time Attack：起點、5 個檢查點、終點。每個點是一個環（法線方向就是通過方向）
export const TA = {
  name: 'CIRCUIT 01',
  start: { x: 0, z: -300, yaw: N },
  medals: { author: 50, gold: 58, silver: 70, bronze: 90 },
  gates: [
    { x: 0, y: 19, z: 175.2, r: 7, dir: [0, 0.91, 0.41], respawn: [0, 100, S], hint: ['衝上 THE CURL 穿過環', '牆上別鬆油門'], first: ['油門到底', 'W 加速 · Shift 冷氣推進'] },
    { x: -140, y: 13, z: -60, r: 8, dir: [-1, 0, 0], respawn: [-245, -60, W], hint: ['飛越整排車', '全速衝上跳台'], before: ['落地後掉頭往南', 'A／D 轉向 · C 手煞車'] },
    { x: -300, y: 5, z: -140, r: 8, dir: [0, 0, -1], respawn: [-300, -150, S], hint: ['長左彎穿過環', '先降到 65 mph · C 手煞車甩尾'] },
    { x: -235, y: 5, z: -243, r: 7, dir: [1, 0, 0], respawn: [-228, -243, E], hint: ['跑完大迴圈', '保持 70 mph 以上'] },
    { x: -70, y: 24, z: -243, r: 8, dir: [1, 0, 0], respawn: [-30, -243, E], hint: ['起飛 · 按住空白鍵', '天空環在 24 m 高'], before: ['冷氣推進衝上跳台', '跳台上按 Shift'] },
  ],
  finish: { x: 70, y: 7, z: -240, r: 30, dir: [1, 0, 0], hint: ['終點', '穿過拱門'] },
  // 引導線（地面上的發光虛線），依序經過的地面點
  guide: [
    [0, -300], [0, -120], [0, 60], [0, 140],
    // 從曲牆回來往南，右轉往西
    [0, 100], [-8, -20], [-30, -56], [-60, -60], [-140, -60], [-220, -60],
    [-268, -72], [-296, -100], [-302, -140], [-296, -190], [-284, -222], [-264, -228],
    [-250, -228], [-230, -243], [-200, -243], [-142, -243], [-70, -243], [0, -243], [70, -240],
  ],
};
