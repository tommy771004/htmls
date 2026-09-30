// core 事件 type（SPEC §5）→ 掛點名稱。UI 事件由 app 以字串送入。
export const EVENT_NAMES = {
  1: 'countdown',   // a = 3,2,1
  2: 'go',
  3: 'takeoff',
  4: 'land',        // a = 衝擊 0..1
  5: 'splash',      // a = 速度
  6: 'mud',
  7: 'truck_hit',   // a = 衝量 0..1, b = 另一台
  8: 'wall_hit',    // a = 衝量 0..1
  9: 'nitro',
  10: 'pickup',     // a = type（1 氮氣、2 獎金）, b = 金額
  11: 'lap',        // a = 圈數
  12: 'finish',     // a = 名次
  13: 'final_lap',
  14: 'overtake',   // a = 新名次
  15: 'wrong_way',  // a = 1 開始逆向、0 回正
};

export const UI_NAMES = ['ui_move', 'ui_confirm', 'ui_back', 'purchase'];

export const ALL_NAMES = [...Object.values(EVENT_NAMES), ...UI_NAMES];

export function eventName(type) {
  if (typeof type === 'string') return type;
  return EVENT_NAMES[type | 0] || null;
}

// 狀態陣列位移（SPEC §5）
export const ST = {
  PHASE: 0, TRUCKS: 4, PLAYER_PLACE: 6,
  TRUCK0: 16, STRIDE: 32,
  X: 0, Z: 2, SPEED: 6, SURFACE: 16, AIR: 17, NITRO_T: 19, FINISHED: 20, RPM: 25, SLIP: 26, VY: 27, IS_AI: 28, WET: 30,
};

export const SURF = { DIRT: 0, LOOSE: 1, MUD: 2, WATER: 3, JUMP: 4, RAMP: 5, WALL: 6, INFIELD: 7 };
