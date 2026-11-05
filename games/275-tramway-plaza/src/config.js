// 作品 275：白城環線 · BELVEDERE LOOP — 經幾何碰撞驗證的空間座標、軌道曲線與視角預設
import * as THREE from 'three';

export const PLINTH = {
  halfX: 32.0,
  halfZ: 22.0,
  thickness: 0.60,
  roadY: 0.025,
  sidewalkY: 0.095,
};

// 道路網格（車道寬 4.4m，形成三個完整無重疊的街廓）
// - 南側外環道：Z ∈ [16.0, 20.4]（中心 Z = 18.2）
// - 東側外環道：X ∈ [25.8, 30.2]（中心 X = 28.0）
// - 西中縱向道：X ∈ [-17.0, -12.6]（中心 X = -14.8）
// - 高架下橫道：Z ∈ [-4.6, -0.2]（中心 Z = -2.4）
// - 北側後環道：Z ∈ [-20.8, -16.4]（中心 Z = -18.6）
export const ROADS = {
  width: 4.4,
  southZ: 18.2,
  eastX: 28.0,
  westMidX: -14.8,
  midViaductZ: -2.4,
  northBackZ: -18.6,
};

// 環形高架軌道（標準跑道形 Stadium Curve：C¹ 連續、精確弧長等速參數化）
export const LOOP = {
  cx: 8.2,
  cz: -9.9,
  halfStraight: 13.3, // 直線段 X ∈ [-5.1, +21.5]
  radius: 8.4,        // 前直線 Z = -1.5（高架下橫道上方）、後直線 Z = -18.3（北側後環道上方）
  deckY: 6.15,
  railY: 6.40,
  deckWidth: 3.10,
  gauge: 1.10,
  stationX: 20.4,     // 前直線東側拱頂高架車站中心
  stairX: 22.8,       // 車站雙段大階梯（位於鐘塔大樓東側與東外環道之間，完全對齊參考圖）
};

/**
 * 精確弧長參數化的跑道形封閉曲線（u ∈ [0, 1)）
 * offset > 0 為向外側法線偏移（直線段平移、半圓段半徑 R + offset）
 */
export function sampleLoop(u, offset = 0, outPos = new THREE.Vector3(), outTan = new THREE.Vector3()) {
  const L = 2 * LOOP.halfStraight;
  const R = LOOP.radius;
  const arc = Math.PI * R;
  const total = 2 * L + 2 * arc;
  const t = (((u % 1) + 1) % 1) * total;
  const x0 = LOOP.cx - LOOP.halfStraight;
  const x1 = LOOP.cx + LOOP.halfStraight;
  const Roff = R + offset;

  if (t < L) {
    // 前側直線（Z = cz + R = -1.5，由西往東 +X）
    const s = t;
    outPos.set(x0 + s, LOOP.deckY, LOOP.cz + R + offset);
    outTan.set(1, 0, 0);
  } else if (t < L + arc) {
    // 東側半圓彎道（圓心 (x1, cz)，θ 由 +π/2 順時針至 -π/2）
    const a = (t - L) / R;
    const theta = Math.PI * 0.5 - a;
    outPos.set(x1 + Math.cos(theta) * Roff, LOOP.deckY, LOOP.cz + Math.sin(theta) * Roff);
    outTan.set(Math.sin(theta), 0, -Math.cos(theta));
  } else if (t < 2 * L + arc) {
    // 後側直線（Z = cz - R = -18.3，由東往西 -X）
    const s = t - (L + arc);
    outPos.set(x1 - s, LOOP.deckY, LOOP.cz - R - offset);
    outTan.set(-1, 0, 0);
  } else {
    // 西側半圓彎道（圓心 (x0, cz)，θ 由 -π/2 至 -3π/2）
    const a = (t - (2 * L + arc)) / R;
    const theta = -Math.PI * 0.5 - a;
    outPos.set(x0 + Math.cos(theta) * Roff, LOOP.deckY, LOOP.cz + Math.sin(theta) * Roff);
    outTan.set(Math.sin(theta), 0, -Math.cos(theta));
  }
  return { pos: outPos, tan: outTan, totalLength: total };
}

export const LOOP_TOTAL_LENGTH = 4 * LOOP.halfStraight + 2 * Math.PI * LOOP.radius;

// 廣場與鐘塔核心座標
export const PLAZA = {
  fountainX: 1.0,
  fountainZ: 8.3,
  clockHallX: 14.8,
  clockHallZ: 11.6,
  clockHallW: 10.2,
  clockHallD: 6.4,
};

// 奶油色歐風建築群配置表（全部通過高架軌道與車道無碰撞驗證）
export const BUILDINGS = [
  {
    id: 'cafe',
    name: '廣場街角咖啡館',
    x: -7.4,
    z: 4.0,
    w: 6.8,
    d: 5.6,
    floors: 2,
    floorH: 2.9,
    matKey: 'creamWarm',
    penthouse: null,
    waterTank: true,
    rooftopCafe: true,
    awnings: ['south', 'west'],
    baysX: 3,
    baysZ: 2,
  },
  {
    id: 'westShop',
    name: '西街轉角烘焙坊',
    x: -24.3,
    z: 11.2,
    w: 6.4,
    d: 5.0,
    floors: 1,
    floorH: 3.8,
    matKey: 'creamMain',
    penthouse: { w: 3.8, d: 2.9, h: 2.1, ox: 0.15, oz: -0.15, garden: true },
    awnings: ['south'],
    baysX: 3,
    baysZ: 2,
  },
  {
    id: 'loopWest',
    name: '西彎露台寓所',
    x: -8.6,
    z: -9.8,
    w: 4.8,
    d: 4.6,
    floors: 2,
    floorH: 2.75,
    matKey: 'creamLight',
    penthouse: { w: 3.0, d: 2.7, h: 1.85, ox: 0, oz: 0, garden: true },
    awnings: [],
    baysX: 2,
    baysZ: 2,
  },
  {
    id: 'loopNW',
    name: '北西花園公寓',
    x: -2.3,
    z: -12.5,
    w: 6.4,
    d: 5.2,
    floors: 3,
    floorH: 2.85,
    matKey: 'creamMain',
    penthouse: { w: 3.9, d: 3.2, h: 2.05, ox: 0, oz: 0, garden: true },
    awnings: [],
    baysX: 3,
    baysZ: 2,
  },
  {
    id: 'loopCenter',
    name: '中庭雙層公寓',
    x: 4.5,
    z: -9.2,
    w: 6.2,
    d: 5.0,
    floors: 2,
    floorH: 2.85,
    matKey: 'creamWarm',
    penthouse: { w: 3.7, d: 3.0, h: 1.95, ox: 0, oz: 0, garden: true },
    awnings: [],
    baysX: 3,
    baysZ: 2,
  },
  {
    id: 'loopNE',
    name: '北東高層公寓',
    x: 12.3,
    z: -10.5,
    w: 6.8,
    d: 5.5,
    floors: 3,
    floorH: 2.9,
    matKey: 'creamLight',
    penthouse: { w: 4.1, d: 3.4, h: 2.1, ox: 0, oz: 0, garden: true },
    awnings: [],
    baysX: 3,
    baysZ: 3,
  },
  {
    id: 'loopEast',
    name: '東彎車站街屋',
    x: 20.3,
    z: -10.1,
    w: 5.6,
    d: 4.9,
    floors: 2,
    floorH: 2.75,
    matKey: 'creamWarm',
    penthouse: { w: 3.3, d: 2.8, h: 1.85, ox: 0, oz: 0, garden: true },
    awnings: [],
    baysX: 2,
    baysZ: 2,
  },
];

// 鏡頭視角預設（overview 對齊參考圖的等角方位角與俯視構圖）
export const CAMERA_PRESETS = {
  overview: {
    label: '全景配置',
    pos: [59.5, 54.0, 101.0],
    target: [2.4, 1.8, -0.6],
    fov: 20.5,
  },
  plaza: {
    label: '鐘塔與噴泉廣場',
    pos: [27.5, 23.5, 47.0],
    target: [6.8, 2.5, 9.6],
    fov: 22,
  },
  cafe: {
    label: '街角咖啡館',
    pos: [-24.5, 19.5, 33.0],
    target: [-6.0, 2.4, 4.8],
    fov: 22,
  },
  station: {
    label: '高架拱頂車站',
    pos: [45.0, 22.5, 28.0],
    target: [20.4, 4.6, 1.5],
    fov: 22,
  },
  apartments: {
    label: '北側歐風公寓群',
    pos: [24.0, 27.5, 25.0],
    target: [5.5, 5.0, -10.5],
    fov: 22,
  },
  park: {
    label: '西側水池與涼亭',
    pos: [-45.0, 22.5, 25.0],
    target: [-23.5, 1.6, -3.2],
    fov: 22,
  },
  train: {
    label: '列車跟拍',
    pos: [38.0, 21.0, 30.0],
    target: [8.2, 6.5, -9.9],
    fov: 24,
    followTrain: true,
  },
};
