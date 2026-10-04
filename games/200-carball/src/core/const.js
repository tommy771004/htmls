// 物理常數：沿用 Rocket League 公開資料（RLBot wiki、RocketSim），1 uu = 1 cm，這裡一律換成公尺。
// 座標：Y 朝上；球場長軸是 Z（玩家隊守 -Z 的球門，攻 +Z），寬是 X。

export const TICK = 1 / 120;
export const GRAVITY = 6.5;

// 球場
export const ARENA = {
  A: 40.96,        // 半寬（側牆）
  B: 51.2,         // 半長（球門線）
  H: 20.44,        // 天花板高
  RC: 14,          // 俯視角的圓角半徑（取代原作 45° 斜角牆，開上去更順）
  R1: 2.56,        // 地面接牆的彎道半徑
  R2: 5.2,         // 牆接天花板的彎道半徑
  GW: 8.93,        // 球門半寬
  GH: 6.43,        // 球門高
  GD: 8.8,         // 球門深
};

// 球
export const BALL = {
  R: 0.9125,
  MASS: 30,
  DRAG: 0.03,         // 每秒速度衰減比例
  REST: 0.6,
  FRIC: 0.35,
  MAX_SPEED: 60,
  MAX_ANG: 6,
};

// 車（Octane 碰撞箱）
export const CAR = {
  MASS: 180,
  HALF: [0.4335, 0.1933, 0.6025],   // 左右、上下、前後
  HIT_OFS: [0, 0.2076, 0.1388],     // 碰撞箱中心相對於車身原點
  REST_Y: 0.17,                     // 停在地上時原點離地高度
  // 輪子接點（左右, 高, 前後）與半徑
  WHEELS: [
    { x: 0.259, y: 0.2075, z: 0.5112, r: 0.125, front: true },
    { x: -0.259, y: 0.2075, z: 0.5112, r: 0.125, front: true },
    { x: 0.295, y: 0.2075, z: -0.3375, r: 0.15, front: false },
    { x: -0.295, y: 0.2075, z: -0.3375, r: 0.15, front: false },
  ],
  WHEELBASE: 0.8487,
  SUSP_STIFF: 7400,     // 每輪彈簧 N/m
  SUSP_DAMP: 620,       // 每輪阻尼 N·s/m
  MAX_SPEED: 23,
  SUPERSONIC: 22,
  DRIVE_CAP: 14.1,      // 只靠油門能到的速度
  THROTTLE_ACC: 16,     // 0 速時的油門加速度（往 14.1 線性降到 1.6 再到 0）
  BRAKE_ACC: 35,
  COAST_ACC: 5.25,
  AIR_THROTTLE_ACC: 0.6667,
  BOOST_ACC_GROUND: 9.9167,
  BOOST_ACC_AIR: 10.5833,
  BOOST_USE: 33.3,      // 每秒
  BOOST_MIN_TIME: 0.1,
  STICKY: 0.5,          // 貼地力，以重力倍數計
  JUMP_IMPULSE: 2.9167,
  JUMP_ACC: 14.5833,
  JUMP_MIN: 0.025,
  JUMP_MAX: 0.2,
  DOUBLE_JUMP_WINDOW: 1.25,
  FLIP_VEL: 5,
  FLIP_FWD_SCALE: 1,
  FLIP_SIDE_SCALE: 1.9,
  FLIP_BACK_SCALE: 2.5,
  FLIP_TIME: 0.65,
  FLIP_RATE: 7.2,      // 翻滾角速度：比原作 5.5 快一些，短跳後的前翻能完整翻回輪子著地
  DODGE_DEADZONE: 0.5,
  // 空中轉向（RLBot wiki 量測值）：角加速度 = T·輸入 + D·(1-|輸入|)·角速度
  T_PITCH: 12.146, T_YAW: 8.92, T_ROLL: 36.08,
  D_PITCH: 2.798, D_YAW: 1.886, D_ROLL: 4.472,
  MAX_ANG: 5.5,
};

// 轉向曲率（1/m）對速度（m/s），由前輪最大轉角表換算
export const CURVATURE = [[0, 0.6900], [5, 0.3980], [10, 0.2350], [15, 0.1375], [17.5, 0.1100], [23, 0.0880]];
// 甩尾時的曲率倍數：後輪失去側向抓地，同樣方向盤轉得更急
export const SLIDE_CURV_MUL = [[0, 1.0], [8, 1.55], [23, 1.9]];

// 撞球的額外衝量（RocketSim BALL_CAR_EXTRA_IMPULSE）
export const HIT = {
  Z_SCALE: 0.35,
  FWD_SCALE: 0.65,
  MAX_DV: 46,
  CURVE: [[0, 0.65], [5, 0.65], [23, 0.55], [46, 0.30]],
};

// 能量補給點：大罐補滿、小罐 +12
export const PADS_BIG = [[-30.72, -40.96], [30.72, -40.96], [-35.84, 0], [35.84, 0], [-30.72, 40.96], [30.72, 40.96]];
export const PADS_SMALL = [
  [0, -42.4], [-17.92, -41.84], [17.92, -41.84], [-9.4, -33.08], [9.4, -33.08], [0, -28.16],
  [-35.84, -24.84], [35.84, -24.84], [-17.88, -23], [17.88, -23], [-20.48, -10.36], [0, -10.24],
  [20.48, -10.36], [-10.24, 0], [10.24, 0], [20.48, 10.36], [0, 10.24], [-20.48, 10.36],
  [17.88, 23], [-17.88, 23], [35.84, 24.84], [-35.84, 24.84], [0, 28.16], [9.4, 33.08],
  [-9.4, 33.08], [17.92, 41.84], [-17.92, 41.84], [0, 42.4],
];
export const PAD = { BIG_R: 2.08, SMALL_R: 1.44, BIG_T: 10, SMALL_T: 4, SMALL_AMT: 12, H: 1.65 };

// 開球位置（守 -Z 的一方；對方鏡像）。yaw 是車頭繞 Y 軸由 +Z 轉向 +X 的角度
export const KICKOFFS = [
  { x: -20.48, z: -25.6, yaw: Math.PI / 4 },
  { x: 20.48, z: -25.6, yaw: -Math.PI / 4 },
  { x: -2.56, z: -38.4, yaw: 0 },
  { x: 2.56, z: -38.4, yaw: 0 },
  { x: 0, z: -46.08, yaw: 0 },
];

export const MATCH = { LENGTH: 300, COUNTDOWN: 3, GOAL_PAUSE: 2.6, REPLAY_LEN: 5 };

export function curve(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}
