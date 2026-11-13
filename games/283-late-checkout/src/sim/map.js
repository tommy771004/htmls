// 飯店平面：區域、牆與開口、家具、燈、出生點。純資料與產生器，不依賴 THREE / DOM。
// 幾何（gfx/hotel.js）、碰撞與射線（world.js）、尋路與掩體（world.js）、光照烘焙都讀這一份。
// 座標：x 向東、z 向南、y 向上，單位公尺。整張圖左右（x）鏡射，Vanguard 在西、Ember 在東。

export const T = 0.24;   // 牆厚
export const H = 3.0;    // 一般天花板高
export const HL = 7.0;   // 大廳挑高
export const BOUNDS = { x0: -27, z0: -21, x1: 27, z1: 21 };
export const TALL = { x0: -8, z0: -5, x1: 8, z1: 13 }; // 挑高範圍（大廳）

// 家具原型：w（局部 x）× d（局部 z）× h；cover = 可當掩體；hp = 耐久（沒有 hp 的打不壞）
export const PREFAB = {
  bed:       { w: 1.7,  d: 2.15, h: 0.62, cover: 1, hp: 380 },
  nightstand:{ w: 0.5,  d: 0.45, h: 0.56, hp: 70 },
  wardrobe:  { w: 1.3,  d: 0.62, h: 2.1,  cover: 1, hp: 260 },
  cabinet:   { w: 1.3,  d: 0.62, h: 1.9,  cover: 1, hp: 280 },
  desk:      { w: 1.3,  d: 0.62, h: 0.78, cover: 1, hp: 150 },
  chair:     { w: 0.48, d: 0.48, h: 0.9, hp: 55 },
  armchair:  { w: 0.9,  d: 0.9,  h: 0.88, cover: 1, hp: 190 },
  sofa:      { w: 2.2,  d: 0.95, h: 0.86, cover: 1, hp: 300 },
  ctable:    { w: 1.1,  d: 0.6,  h: 0.44, hp: 80 },
  bath:      { w: 2.3,  d: 2.5,  h: 3.0,  cover: 1 },
  column:    { w: 0.8,  d: 0.8,  h: 7.0,  cover: 1 },
  frontdesk: { w: 8.4,  d: 0.9,  h: 1.15, cover: 1 },
  barcounter:{ w: 7.0,  d: 0.8,  h: 1.12, cover: 1 },
  backbar:   { w: 7.0,  d: 0.5,  h: 2.3 },
  stool:     { w: 0.4,  d: 0.4,  h: 0.78, hp: 50 },
  rtable:    { w: 1.1,  d: 1.1,  h: 0.76, cover: 1, hp: 130 },
  piano:     { w: 1.55, d: 1.9,  h: 1.02, cover: 1, hp: 420 },
  cart:      { w: 1.25, d: 0.65, h: 1.75, cover: 1, hp: 200 },
  hcart:     { w: 1.1,  d: 0.6,  h: 1.15, cover: 1, hp: 190 },
  sideboard: { w: 1.5,  d: 0.48, h: 0.92, cover: 1, hp: 170 },
  crate:     { w: 1.0,  d: 0.75, h: 0.9,  cover: 1, hp: 150 },
  crate2:    { w: 1.0,  d: 0.75, h: 1.7,  cover: 1, hp: 240 },
  sheet:     { w: 1.7,  d: 0.95, h: 1.15, cover: 1, hp: 200 },
  plant:     { w: 0.55, d: 0.55, h: 1.5, hp: 60 },
  pool:      { w: 2.5,  d: 1.35, h: 0.84, cover: 1, hp: 420 },
  booth:     { w: 1.7,  d: 0.65, h: 1.15, cover: 1, hp: 260 },
  barricade: { w: 3.0,  d: 0.8,  h: 1.6,  cover: 1, hp: 320 },
  buffet:    { w: 2.4,  d: 0.6,  h: 0.95, cover: 1, hp: 280 },
};

const WARM = [1.0, 0.72, 0.42], AMBER = [1.0, 0.6, 0.28], GREEN = [0.75, 1.0, 0.6], COOL = [0.42, 0.58, 1.0], NEON = [1.0, 0.32, 0.14], WHITE = [0.95, 0.92, 0.82];

export function buildMap() {
  const zones = [], pieces = [], openings = [], items = [], lamps = [], decor = [], boxes = [];

  // ---------- 區域 ----------
  const Z = (id, name, x0, z0, x1, z1, o = {}) => {
    const z = { id, name, x0: Math.min(x0, x1), z0, x1: Math.max(x0, x1), z1, h: o.h || H, floor: o.floor || 'carpet', style: o.style || 'room', idx: zones.length };
    zones.push(z); return z;
  };
  Z('lobby', '大廳', -8, -5, 8, 13, { h: HL, floor: 'marble', style: 'lobby' });
  Z('office', '櫃檯辦公室', -8, -9, 8, -5, { floor: 'wood', style: 'office' });
  Z('ncor', '北走廊', -24, -11.6, 24, -9, { floor: 'runner', style: 'corridor' });
  Z('elev', '電梯廳', -6, -16, 6, -11.6, { floor: 'marble', style: 'lobby' });
  for (const s of [-1, 1]) {
    const W = s < 0 ? 'W' : 'E', n = s < 0 ? [1, 2, 3] : [6, 5, 4];
    Z('n' + n[0], '客房 10' + n[0], s * 24, -19, s * 18, -11.6);
    Z('n' + n[1], '客房 10' + n[1], s * 18, -19, s * 12, -11.6);
    Z('n' + n[2], '客房 10' + n[2], s * 12, -19, s * 6, -11.6);
    Z(W + 'cor', s < 0 ? '西側走廊' : '東側走廊', s * 24, -9, s * 21.4, 3, { floor: 'runner', style: 'corridor' });
    Z(W + 'mid', s < 0 ? '西中廊' : '東中廊', s * 21.4, 0.4, s * 8, 3, { floor: 'runner', style: 'corridor' });
    Z(W + '1n', '客房 ' + (s < 0 ? '11' : '12') + '1', s * 21.4, -9, s * 14.7, -4.3);
    Z(W + '2n', '客房 ' + (s < 0 ? '11' : '12') + '2', s * 14.7, -9, s * 8, -4.3);
    Z(W + '1s', '客房 ' + (s < 0 ? '11' : '12') + '3', s * 21.4, -4.3, s * 14.7, 0.4);
    Z(W + '2s', '客房 ' + (s < 0 ? '11' : '12') + '4', s * 14.7, -4.3, s * 8, 0.4);
    if (s < 0) Z('bar', '酒吧', -24, 3, -8, 17, { floor: 'wood', style: 'bar' });
    else Z('dining', '餐廳', 8, 3, 24, 17, { floor: 'parquet', style: 'dining' });
  }
  const zoneAt = (x, z) => { for (const q of zones) if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) return q; return null; };

  // ---------- 牆 ----------
  // axis 'x'：沿 x 延伸、z 固定；axis 'z'：沿 z 延伸、x 固定。ops：{at, w, y0, y1, k}
  const wall = (axis, c, a, b, h, ops = []) => {
    if (a > b) [a, b] = [b, a];
    const ext = axis === 'x' ? T / 2 : 0; // x 向牆在兩端多伸半個牆厚補轉角
    const cuts = [];
    for (const o of ops) {
      let col = cuts.find(q => Math.abs(q.at - o.at) < 1e-6 && Math.abs(q.w - o.w) < 1e-6);
      if (!col) { col = { at: o.at, w: o.w, spans: [] }; cuts.push(col); }
      col.spans.push([o.y0 || 0, o.y1]);
      openings.push({ axis, c, at: o.at, w: o.w, y0: o.y0 || 0, y1: o.y1, k: o.k || 'door', h });
    }
    cuts.sort((p, q) => p.at - q.at);
    let cur = a - ext;
    const solid = (p, q, y0, y1) => { if (q - p > 1e-4 && y1 - y0 > 1e-4) pieces.push({ axis, c, a: p, b: q, y0, y1 }); };
    for (const col of cuts) {
      const p = col.at - col.w / 2, q = col.at + col.w / 2;
      solid(cur, p, 0, h);
      col.spans.sort((m, n) => m[0] - n[0]);
      let y = 0;
      for (const [y0, y1] of col.spans) { solid(p, q, y, y0); y = y1; }
      solid(p, q, y, h);
      cur = q;
    }
    solid(cur, b + ext, 0, h);
  };
  const door = (at, w = 1.3) => ({ at, w, y0: 0, y1: 2.15, k: 'door' });
  const arch = (at, w, top) => ({ at, w, y0: 0, y1: top, k: 'arch' });
  const win = (at, w, y0, y1) => ({ at, w, y0, y1, k: 'window' });

  // 中央
  wall('x', -19, -24, 24, H, [-21, -15, -9, 9, 15, 21].map(x => win(x, 1.5, 0.95, 2.35)));
  wall('x', 13, -8, 8, HL, [win(-5.6, 1.7, 0.7, 6), win(-2.95, 1.7, 0.7, 6), win(0, 2.6, 0, 2.7), win(0, 2.6, 3.1, 6), win(2.95, 1.7, 0.7, 6), win(5.6, 1.7, 0.7, 6)]);
  wall('x', -5, -8, 8, HL, [door(-6.2), door(6.2)]);
  wall('x', -9, -8, 8, H, [door(-3.5), door(3.5)]);
  wall('x', -16, -6, 6, H);
  wall('x', -11.6, -24, 24, H, [door(-21), door(-15), door(-9), arch(0, 5, 2.6), door(9), door(15), door(21)]);
  for (const s of [-1, 1]) {
    wall('z', s * 6, -19, -11.6, H);
    wall('z', s * 24, -19, 17, H);
    wall('x', 17, s * 24, s * 8, H, [12, 16, 20].map(x => win(s * x, 1.6, 0.9, 2.5)));
    wall('z', s * 8, 13, 17, H);
    wall('z', s * 8, -5, 13, HL, [arch(1.7, 1.8, 2.4), arch(8.5, 3.0, 2.6)]);
    wall('z', s * 8, -9, -5, H);
    wall('z', s * 18, -19, -11.6, H, [door(-15.5)]);
    wall('z', s * 12, -19, -11.6, H);
    wall('x', -9, s * 21.4, s * 8, H, [door(s * 18), door(s * 11.3)]);
    wall('z', s * 21.4, -9, 0.4, H, [door(-3.2)]);
    wall('z', s * 14.7, -9, 0.4, H);
    wall('x', -4.3, s * 21.4, s * 8, H, [door(s * 18), door(s * 11.3)]);
    wall('x', 0.4, s * 21.4, s * 8, H, [door(s * 18), door(s * 11.3)]);
    wall('x', 3, s * 21.4, s * 8, H, [door(s * 18.5, 1.4), arch(s * 11.5, 2.0, 2.3)]);
  }
  for (const p of pieces) {
    const b = p.axis === 'x'
      ? { x0: p.a, x1: p.b, z0: p.c - T / 2, z1: p.c + T / 2 }
      : { x0: p.c - T / 2, x1: p.c + T / 2, z0: p.a, z1: p.b };
    boxes.push({ ...b, y0: p.y0, y1: p.y1, kind: 'wall' });
  }
  for (const o of openings) if (o.k === 'window') { // 玻璃：擋人擋子彈，不擋光
    const g = 0.02;
    const b = o.axis === 'x'
      ? { x0: o.at - o.w / 2, x1: o.at + o.w / 2, z0: o.c - g, z1: o.c + g }
      : { x0: o.c - g, x1: o.c + g, z0: o.at - o.w / 2, z1: o.at + o.w / 2 };
    boxes.push({ ...b, y0: o.y0, y1: o.y1, kind: 'glass', noOcc: 1 });
  }
  // 大廳北側夾層陽台（只擋子彈與光）
  boxes.push({ x0: -8, x1: 8, z0: -5, z1: -3.3, y0: 3.3, y1: 3.55, kind: 'balcony' });
  decor.push({ type: 'balcony', x0: -8, x1: 8, z0: -5, z1: -3.3, y: 3.3 });

  // ---------- 家具 ----------
  // rot：四分之一圈數（繞 y，逆時針俯視）。rot=0 時正面朝 +z。
  const P = (type, x, z, rot = 0, o = {}) => {
    const f = PREFAB[type]; rot = ((rot % 4) + 4) % 4;
    const w = rot % 2 ? f.d : f.w, d = rot % 2 ? f.w : f.d;
    const it = { type, x, z, rot, w: f.w, d: f.d, h: f.h, ...o, id: items.length, hp0: f.hp || 0, hp: f.hp || 0, dead: false, box: -1 };
    items.push(it);
    if (!o.ghost) it.box = boxes.length;
    if (!o.ghost) boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: 0, y1: f.h, kind: type, cover: f.cover ? 1 : 0, item: it.id });
    return it;
  };
  const D = (type, o) => decor.push({ type, ...o });
  // 燈：ch 0 = 常亮暖光、1 = 閃爍、2 = 月光／窗光（閃電時一起變亮）
  const L = (kind, x, y, z, o = {}) => lamps.push({ kind, x, y, z, col: o.col || WARM, I: o.I || 2.5, r: o.r || 7, ch: o.ch || 0, glow: o.glow === undefined ? 1 : o.glow, id: lamps.length });

  // 客房：local (u, v) → world。door 牆是 v=0。flipU 把 u 反向；dirV = ±1 表示 v 增加時 z 增或減
  const room = (zid, doorWall, flipU, tpl, lamp) => {
    const q = zones.find(k => k.id === zid), W = q.x1 - q.x0, Dp = q.z1 - q.z0;
    const dirV = doorWall === 'S' ? -1 : 1;                     // 門在南牆 → v 往北
    const X = u => flipU ? q.x1 - u : q.x0 + u;
    const Zc = v => dirV > 0 ? q.z0 + v : q.z1 - v;
    // 物件朝向：模板裡 rot 是「局部正面方向」0=+v 1=+u 2=-v 3=-u
    const R = r => { let dx = [0, 1, 0, -1][r], dz = [1, 0, -1, 0][r]; if (flipU) dx = -dx; dz *= dirV; return dz === 1 ? 0 : dx === 1 ? 1 : dz === -1 ? 2 : 3; };
    const put = (type, u, v, r = 0, o) => P(type, X(u), Zc(v), R(r), o);
    if (tpl === 'A') { // 深房 6 × 7.4，門在 u=3
      put('bath', W - 1.27, 1.37, 3);
      put('wardrobe', 0.95, 0.45, 0);
      put('bed', 3, Dp - 1.2, 2);
      put('nightstand', 1.78, Dp - 0.36, 2); put('nightstand', 4.22, Dp - 0.36, 2);
      put('desk', 0.45, 3.65, 1); put('chair', 1.15, 3.65, 3);
      put('armchair', W - 0.75, Dp - 1.0, 3);
      D('rug', { x: X(3), z: Zc(Dp - 2.6), w: 2.6, d: 1.6, rot: 0 });
      if (lamp === 'table') L('table', X(1.78), 0.98, Zc(Dp - 0.36), { I: 1.5, r: 5.5 });
      if (lamp === 'ceil') L('ceil', X(3), 2.8, Zc(3.9), { I: 3.2, r: 7, ch: 1 });
      if (lamp === 'floor') L('floor', X(W - 0.55), 1.55, Zc(Dp - 2.1), { I: 2.0, r: 6 });
      L('window', X(3), 1.7, Zc(Dp - 0.5), { I: 1.1, r: 6.5, col: COOL, ch: 2, glow: 0 });
    } else { // 淺房 6.7 × 4.7，走廊門與連通門都在 u≈3.4
      put('bed', 1.22, 2.35, 1);
      put('nightstand', 0.4, 3.75, 1); put('nightstand', 0.4, 0.95, 1);
      put('bath', W - 1.27, 1.37, 3);
      put('desk', W - 1.45, Dp - 0.45, 2); put('chair', W - 1.45, Dp - 1.15, 0);
      put('armchair', W - 0.75, 3.2, 3);
      if (lamp === 'table') L('table', X(0.4), 0.98, Zc(3.75), { I: 1.5, r: 5.5 });
      if (lamp === 'ceil') L('ceil', X(3.4), 2.8, Zc(2.35), { I: 2.6, r: 6.5, ch: 1 });
      if (lamp === 'floor') L('floor', X(W - 0.6), 1.55, Zc(Dp - 1.2), { I: 2.0, r: 6 });
    }
  };
  room('n1', 'S', false, 'A', 'table'); room('n2', 'S', true, 'A', null); room('n3', 'S', false, 'A', 'ceil');
  room('n6', 'S', true, 'A', 'floor'); room('n5', 'S', false, 'A', null); room('n4', 'S', true, 'A', 'table');
  room('W1n', 'N', false, 'B', 'table'); room('W2n', 'N', false, 'B', null);
  room('W1s', 'S', true, 'B', null); room('W2s', 'S', false, 'B', 'floor');
  room('E1n', 'N', true, 'B', null); room('E2n', 'N', true, 'B', 'table');
  room('E1s', 'S', false, 'B', 'floor'); room('E2s', 'S', true, 'B', null);

  // 大廳
  for (const [x, z] of [[-4.6, 1], [4.6, 1], [-4.6, 7.2], [4.6, 7.2]]) {
    P('column', x, z);
    L('sconce', x + (x < 0 ? 0.55 : -0.55), 2.4, z, { I: 2.4, r: 6.5 });
  }
  P('frontdesk', 0, -2.6, 0);
  L('desk', -2.9, 1.5, -2.6, { I: 1.3, r: 4.5, col: GREEN }); L('desk', 2.9, 1.5, -2.6, { I: 1.3, r: 4.5, col: GREEN });
  P('sofa', -2.3, 4.7, 0); P('sofa', 2.3, 8.6, 2); P('ctable', 0, 6.6, 0);
  P('armchair', 2.4, 4.7, 0); P('armchair', -2.4, 8.6, 2);
  P('sheet', 0, 10.6, 0); P('cart', 6.3, -0.9, 1); P('cart', -6.6, 11.6, 0);
  P('plant', -7.3, 12.3); P('plant', 7.3, 12.3); P('plant', -7.35, -4.35); P('plant', 7.35, -4.35);
  P('barricade', 0, 12.3, 0); P('crate', -6.9, 4.6, 1); P('crate2', 6.9, 5.2, 1);
  L('chandelier', 0, 5.2, 5, { I: 12, r: 16 });
  L('chandelier', 0, 5.6, -1.4, { I: 4, r: 10, glow: 0.5 });
  D('chandelier', { x: 0, y: 5.2, z: 5, r: 1.5 }); D('rug', { x: 0, z: 6.6, w: 6.4, d: 5.2, rot: 0, big: 1 });
  D('keyrack', { x: 0, z: -5 + T / 2, w: 3.2 }); D('sign', { x: 0, y: 4.6, z: -5 + T / 2, text: 'HOTEL SOLACE' });
  // 月光（方向光，從南面高處照進來）。dir 是光行進方向
  const moon = { dir: norm([0.22, -0.6, -0.77]), col: [0.5, 0.64, 1.0], I: 1.5 };

  // 辦公室
  P('desk', -1.2, -6.6, 0); P('chair', -1.2, -7.3, 0); P('desk', 1.6, -7.2, 2); P('cabinet', 0, -8.55, 0); P('cabinet', -7.55, -7, 1); P('crate', 7.3, -8.2, 1);
  L('ceil', 0, 2.8, -7, { I: 3.4, r: 7, ch: 1, col: WHITE });

  // 電梯廳
  P('plant', -5.4, -12.25); P('plant', 5.4, -12.25); P('sofa', -5.35, -14.2, 1); P('crate2', 4.9, -15.3, 0); P('sideboard', 5.6, -13.6, 3);
  L('ceil', 0, 2.82, -13.8, { I: 2.6, r: 7 });
  D('elevator', { x: -1.7, z: -16 + T / 2 }); D('elevator', { x: 1.7, z: -16 + T / 2 });

  // 走廊掩體與壁燈
  const zN = -11.6 + T / 2, zS = -9 - T / 2;
  P('sideboard', -12, zN + 0.26, 0); P('hcart', -13.2, zS - 0.32, 0); P('sideboard', -6, zS - 0.26, 2); P('crate', -17.2, zN + 0.4, 0);
  P('crate2', 12.1, zN + 0.4, 0); P('sideboard', 13.2, zS - 0.26, 2); P('hcart', 6, zS - 0.32, 0); P('sideboard', 17.2, zN + 0.26, 0);
  L('sconce', -18, 1.95, zN + 0.14, { I: 2.2, r: 7 }); L('sconce', -6.4, 1.95, zN + 0.14, { I: 2.2, r: 7 });
  L('sconce', 6.4, 1.95, zN + 0.14, { I: 2.2, r: 7, ch: 1 }); L('sconce', 18, 1.95, zN + 0.14, { I: 2.2, r: 7 });
  L('sconce', -14.7, 1.95, zS - 0.14, { I: 2.2, r: 7, ch: 1 }); L('sconce', 0, 1.95, zS - 0.14, { I: 2.2, r: 7 }); L('sconce', 14.7, 1.95, zS - 0.14, { I: 2.2, r: 7 });
  for (const s of [-1, 1]) {
    const xo = s * (24 - T / 2);
    P('sideboard', xo - s * 0.26, -0.8, s < 0 ? 1 : 3); P(s < 0 ? 'crate2' : 'hcart', xo - s * 0.42, -7.0, 1);
    L('sconce', xo - s * 0.14, 1.95, -4.6, { I: 2.2, r: 7, ch: s < 0 ? 0 : 1 });
    L('sconce', xo - s * 0.14, 1.95, 1.4, { I: 2.0, r: 6.5 });
    // 中廊
    P('hcart', s * 13.8, 0.4 + T / 2 + 0.32, 0); P('sideboard', s * 15, 3 - T / 2 - 0.26, 2); P(s < 0 ? 'crate' : 'plant', s * 20.6, 0.4 + T / 2 + 0.42, 0);
    L('sconce', s * 15, 1.95, 3 - T / 2 - 0.14, { I: 2.2, r: 7 }); L('sconce', s * 9.3, 1.95, 0.4 + T / 2 + 0.14, { I: 2.0, r: 6.5 });
  }

  // 酒吧（西）
  P('barcounter', -16, 14.6, 0); P('backbar', -16, 17 - T / 2 - 0.27, 2);
  for (const x of [-19, -17.4, -14.6, -13]) P('stool', x, 13.85);
  P('pool', -14.3, 7.6, 0); P('booth', -24 + T / 2 + 0.36, 7.3, 1); P('booth', -24 + T / 2 + 0.36, 10.3, 1); P('rtable', -23.15, 8.8);
  P('piano', -10.1, 14.2, 3); P('sheet', -17.4, 10.8, 0); P('crate2', -9.2, 5.6, 0); P('sheet', -10.2, 11.2, 1); P('armchair', -20.8, 15.6, 2); P('plant', -8.6, 16.3);
  for (const x of [-18.6, -16, -13.4]) L('pendant', x, 2.15, 14.5, { I: 1.9, r: 6, col: AMBER });
  L('pendant', -14.3, 1.95, 7.6, { I: 3.4, r: 7 }); L('neon', -16, 2.45, 16.4, { I: 1.5, r: 6.5, col: NEON });
  L('sconce', -24 + T / 2 + 0.14, 1.95, 12.8, { I: 2.0, r: 6.5 }); L('sconce', -8 - T / 2 - 0.14, 1.95, 4.6, { I: 2.0, r: 6.5 });
  D('neon', { x: -16, y: 2.45, z: 17 - T / 2 - 0.56, text: 'BAR' }); D('rug', { x: -20.4, z: 9, w: 3.2, d: 4.4, rot: 0 });

  // 餐廳（東）
  for (const [x, z, n] of [[11.8, 6.4, 3], [15.4, 8.0, 2], [12.8, 12.2, 3], [16.6, 12.0, 2], [15.2, 15.2, 1]]) {
    P('rtable', x, z);
    const off = [[0, -0.9, 0], [0.9, 0, 3], [0, 0.9, 2], [-0.9, 0, 1]];
    for (let i = 0; i < n; i++) P('chair', x + off[i][0], z + off[i][1], off[i][2]);
  }
  P('buffet', 19.4, 17 - T / 2 - 0.32, 2); P('buffet', 24 - T / 2 - 0.32, 12.6, 3); P('barricade', 10.1, 11.4, 1); P('crate2', 9.2, 5.6, 0);
  P('sheet', 19.2, 8.6, 1); P('plant', 8.6, 16.3); P('armchair', 20.8, 15.6, 2); P('crate', 22.9, 4.2, 0);
  L('chandelier', 15.6, 2.5, 10, { I: 8.5, r: 10.5 }); D('chandelier', { x: 15.6, y: 2.5, z: 10, r: 0.7, small: 1 });
  L('sconce', 24 - T / 2 - 0.14, 1.95, 8.6, { I: 2.0, r: 6.5 }); L('sconce', 14.4, 1.95, 3 + T / 2 + 0.14, { I: 2.0, r: 6.5, ch: 1 }); L('sconce', 8 + T / 2 + 0.14, 1.95, 4.6, { I: 2.0, r: 6.5 });
  D('rug', { x: 20.6, z: 10.6, w: 3.0, d: 4.2, rot: 0 });

  const lampsOn = lamps.filter(l => l.I > 0.05);
  lampsOn.forEach((l, i) => l.id = i);
  // 可以被打滅的燈：命中用的橢球（中心 x, hy, z；水平半徑 hr、垂直半徑 hv）與耐久 hp0。s = 目前亮度 0..1。
  const HIT = { sconce: [0, 0.15, 1], table: [0, 0.19, 1], floor: [0, 0.24, 1], pendant: [0.06, 0.2, 1], desk: [-0.03, 0.17, 1], neon: [0, 0.5, 2] };
  for (const l of lampsOn) {
    const q = zoneAt(l.x, l.z); l.zone = q ? q.idx : -1; l.hp0 = 0; l.hr = 0; l.hv = 0; l.hy = l.y; l.follow = -1; l.item = -1;
    if (l.kind === 'ceil') { l.hy = (q ? q.h : H) - 0.1; l.hr = l.hv = 0.2; l.hp0 = 1; }
    else if (l.kind === 'chandelier') {
      const d = decor.find(k => k.type === 'chandelier' && k.x === l.x && k.z === l.z && k.y === l.y);
      if (d) { d.lamp = l.id; l.hy = l.y + (d.small ? 0.1 : 0.35); l.hr = d.r + 0.1; l.hv = d.small ? 0.4 : 0.75; l.hp0 = d.small ? 4 : 8; }
    } else if (HIT[l.kind]) { const h = HIT[l.kind]; l.hy = l.y + h[0]; l.hr = l.hv = h[1]; l.hp0 = h[2]; }
    if (l.kind === 'table') { const it = items.find(k => k.type === 'nightstand' && Math.abs(k.x - l.x) < 0.05 && Math.abs(k.z - l.z) < 0.05); if (it) l.item = it.id; }
    if (l.kind === 'neon') { const d = decor.find(k => k.type === 'neon'); if (d) d.lamp = l.id; }
    l.hp = l.hp0; l.s = 1;
  }
  // 沒有燈具的補光（大廳第二盞）跟著同區域的吊燈一起亮滅
  for (const l of lampsOn) if (l.kind === 'chandelier' && !l.hp0) { const m = lampsOn.find(k => k.kind === 'chandelier' && k.hp0 && k.zone === l.zone); if (m) l.follow = m.id; }

  // ---------- 出生點、巡邏點、路線 ----------
  const spawns = [
    [[-21.2, 6.1], [-19.4, 5.4], [-20.6, 12.4], [-18.6, 12.0], [-22.2, 13.4], [-21.6, 4.6]],
    [[21.2, 6.1], [19.4, 5.4], [20.6, 12.4], [18.6, 13.6], [22.2, 13.4], [21.6, 4.9]],
  ];
  const spawnYaw = [-Math.PI / 2, Math.PI / 2]; // 0 隊面向東（-sin(yaw)=+1）
  // 路線（以 Vanguard 視角，Ember 用 x 鏡射）：依序前進的點
  const lanes = {
    mid:    [[-10.5, 8.5], [-5.5, 8.6], [0.9, 3.0], [6.2, 8.6], [10.5, 8.5], [17, 9.6]],
    hall:   [[-12.5, 1.7], [-6.6, 1.7], [0, 0.4], [6.6, 1.7], [12.5, 1.7], [18.4, 4.6], [19.6, 11]],
    north:  [[-22.7, 0], [-22.7, -8], [-19.6, -10.3], [-7, -10.3], [0, -10.3], [7, -10.3], [19.6, -10.3], [22.7, -8], [22.7, 0], [20, 8]],
    office: [[-12.5, 1.7], [-11.3, -1.8], [-11.3, -6.6], [-10, -10.3], [-3.5, -7.4], [-6.2, -3.6], [0, 2], [10, 8.5], [19.6, 11]],
  };
  const holds = [[-9.6, 6.6], [-11.2, 9.4], [-6.8, 0.2], [-13.2, 1.6], [-22.7, -5]]; // Vanguard 側的守點
  const patrol = [[0, 5.2], [0, -10.3], [-15, 1.7], [15, 1.7], [-22.7, -3], [22.7, -3], [-16, 9], [16, 9], [0, -7], [-21.6, -14.6], [21.6, -14.6], [0, -13.5], [-11.6, -2.6], [11.6, -2.6], [-18, -6.5], [18, -6.5]];

  return { zones, zoneAt, pieces, openings, items, lamps: lampsOn, decor, boxes, moon, spawns, spawnYaw, lanes, holds, patrol };
}

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
