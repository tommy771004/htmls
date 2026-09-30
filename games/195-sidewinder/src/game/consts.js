// 遊戲層常數：狀態陣列位移、事件 id、車色、對手、賽道名、升級種類。
// 數值一律依 SPEC §5（不依賴 core.js 匯出的常數名稱，兩邊只以數字對齊）。

export const STEP = 1 / 120; // core 固定步長
export const MAX_SUB = 8; // 每幀最多幾個子步

// 表頭
export const H = {
  PHASE: 0, TIME: 1, COUNT: 2, LAPS: 3, NTRUCK: 4, NPICK: 5,
  PLAYER_POS: 6, TRACK: 7, LEADER_LAPS: 8, PLAYER_LAP_START: 9,
};
export const PHASE = { IDLE: 0, COUNTDOWN: 1, RACE: 2, DONE: 3 };

// 卡車：第 k 台從 16 + 32k 起
export const TRUCK0 = 16;
export const TSTRIDE = 32;
export const T = {
  X: 0, Y: 1, Z: 2, YAW: 3, PITCH: 4, ROLL: 5, SPEED: 6, STEER: 7, WHEEL: 8,
  LAPS: 13, LAP_PROG: 14, POS: 15, SURF: 16, AIR: 17, NITRO_CANS: 18, NITRO_T: 19,
  FINISHED: 20, FINISH_T: 21, BEST_LAP: 22, LAST_LAP: 23, CASH: 24, RPM: 25,
  SLIP: 26, VY: 27, IS_AI: 28, AI_MODE: 29, MUD: 30, DNF: 31,
};
export const PICK0 = 144;

// 事件 type
export const EV = {
  COUNTDOWN: 1, GO: 2, TAKEOFF: 3, LAND: 4, SPLASH: 5, MUD: 6, TRUCK_HIT: 7,
  WALL_HIT: 8, NITRO: 9, PICKUP: 10, LAP: 11, FINISH: 12, FINAL_LAP: 13, OVERTAKE: 14, WRONG_WAY: 15,
};

export const SURF_NAME = ['泥土', '鬆土', '泥地', '水坑', '跳台', '坡道', '牆', '草地'];
export const AI_MODE_NAME = ['跑線', '卡位', '脫困'];

// 車色（順序即預設座位色；玩家可換色，其餘三色依序給對手）
export const COLORS = [
  { id: 'rust', name: '鐵鏽紅', hex: '#b8412c' },
  { id: 'denim', name: '牛仔藍', hex: '#3c6594' },
  { id: 'mustard', name: '芥末黃', hex: '#d6a520' },
  { id: 'bone', name: '骨白', hex: '#e6dccb' },
];

// 對手（固定三名，技巧差距）
export const RIVALS = [
  { name: '郊狼', en: 'COYOTE', bias: 0.1 },
  { name: '禿鷹', en: 'BUZZARD', bias: 0.05 },
  { name: '毒蜥', en: 'GILA', bias: 0 },
];

// 賽道顯示名（英文與 Blender 匯出的檔頭名稱一致）
export const TRACKS = [
  { zh: '響尾蛇峽谷', en: 'SIDEWINDER GULCH' },
  { zh: '乾河床', en: 'DRY WASH' },
  { zh: '泥灘盆地', en: 'MUDFLAT BASIN' },
  { zh: '鐵砧台地', en: 'ANVIL MESA' },
];

// 升級：kind 與 sw_upgrade_stat 相同
export const UPGRADES = [
  { key: 'tires', kind: 0, name: '輪胎', en: 'TIRES', stat: '抓地倍率', fmt: (v) => '×' + v.toFixed(2) },
  { key: 'engine', kind: 1, name: '引擎', en: 'ENGINE', stat: '極速', fmt: (v) => Math.round(v * 3.6) + ' km/h' },
  { key: 'shocks', kind: 2, name: '避震', en: 'SHOCKS', stat: '落地／顛簸恢復', fmt: (v) => v.toFixed(2) + ' 秒' },
  { key: 'nitro', kind: 3, name: '氮氣', en: 'NITRO', stat: '起始氮氣瓶', fmt: (v) => Math.round(v) + ' 瓶' },
];
export const MAX_LEVEL = 5;
