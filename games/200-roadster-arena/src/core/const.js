// 物理常數。座標：Y 朝上、公尺、秒。車身本地座標：+Z 車頭、+Y 車頂、+X 車身左側（右轉是繞車頂軸的負角速度）。
// 尺寸照真車比例（車長 4.3 m），手感是街機：重力略重、油門與冷氣推進給得很猛、落地保速。

export const TICK = 1 / 120;
export const GRAVITY = 12;

export const CAR = {
  MASS: 1500,
  HALF: [0.95, 0.4, 2.12],          // 碰撞箱半尺寸：左右、上下、前後
  HIT_OFS: [0, 0.3, -0.02],         // 碰撞箱中心相對於車身原點（原點在輪軸高度）
  // 懸吊上端接點（左右, 高, 前後）與輪半徑
  WHEELS: [
    { x: 0.86, y: 0.15, z: 1.38, r: 0.355, front: true },
    { x: -0.86, y: 0.15, z: 1.38, r: 0.355, front: true },
    { x: 0.87, y: 0.15, z: -1.3, r: 0.37, front: false },
    { x: -0.87, y: 0.15, z: -1.3, r: 0.37, front: false },
  ],
  REST_Y: 0.36,                     // 停在平地上時原點離地高度
  RAY: 0.64,                        // 懸吊射線長：接點 → 輪胎著地點（含 0.12 m 下垂行程）
  SUSP_K: 44000,                    // 每輪彈簧 N/m（靜載壓縮 0.1 m）
  SUSP_C: 4200,                     // 每輪阻尼 N·s/m
  // 油門加速度對速度表（m/s → m/s²）；空氣阻力 DRAG·v² 另計
  THROTTLE: [[0, 21], [20, 18.5], [45, 14], [65, 10.5], [75, 0]],
  REVERSE_MAX: 16,
  BRAKE: 32,
  COAST: 2.6,
  DRAG: 0.0019,
  MAX_SPEED: 104,
  // 轉向曲率（1/m）對速度
  CURVATURE: [[0, 0.21], [8, 0.15], [20, 0.085], [40, 0.045], [70, 0.024], [100, 0.016]],
  GRIP: 13,                         // 側向抓地（每秒吃掉側滑的比率）
  DRIFT_GRIP: 1.7,
  STICKY: 0.45,                     // 一般貼地力（重力倍數）
  WALL_STICKY: 1.35,                // 吸附系統開在 WALL 時，對接觸面的吸力
  JUMP: 6.6,                        // 起跳速度
  AIR_PITCH: 12, AIR_YAW: 9, AIR_ROLL: 26,   // 空中角加速度
  AIR_DAMP: 3.2,
  MAX_ANG: 7.5,
  // 冷氣推進器（COLD-GAS）
  GAS_MAX: 100,
  BOOST_ACC: 14, BOOST_AIR_ACC: 17, BOOST_USE: 21,
  HOVER_ACC: 15.5, HOVER_USE: 15,
  GAS_REGEN: 11, GAS_DELAY: 0.9,
  // 主動空力：AUTO／LOW（低阻）／HIGH（下壓）
  AERO: {
    LOW: { drag: 0.86, grip: 0.9, down: 0.1 },
    AUTO: { drag: 1, grip: 1, down: 0.25 },
    HIGH: { drag: 1.22, grip: 1.18, down: 0.5 },
  },
};

export const MPH = 2.2369;   // m/s → mph

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

// 碰撞群組
export const G_WORLD = 0x0001, G_CAR = 0x0002, G_BALL = 0x0004, G_SHELL = 0x0008, G_REMOTE = 0x0010;
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);

// 車球聯賽：球場（圓角矩形、地面與天花板接彎道）與巨型足球。尺寸照真實比例的跑車放大
export const ARENA = {
  A: 64,          // 半寬（側牆）
  B: 92,          // 半長（球門線）
  H: 36,          // 天花板高
  RC: 26,         // 俯視角的圓角半徑
  R1: 9,          // 地面接牆的彎道半徑
  R2: 12,         // 牆接天花板的彎道半徑
  GW: 20,         // 球門半寬
  GH: 14,         // 球門高
  GD: 16,         // 球門深
};
export const BALL = {
  R: 4.2,
  MASS: 420,
  REST: 0.62,
  FRIC: 0.3,
  DRAG: 0.035,        // 每秒速度衰減比例
  MAX_SPEED: 70,
  MAX_ANG: 5,
  HIT: 0.8,           // 車撞球額外補的衝量（相對速度的比例），手感比純剛體碰撞爽快
};
export const LEAGUE = { MAX: 20, CLOCK: 180, KICKOFF: 3, GOAL_PAUSE: 3.5, END_PAUSE: 9 };
