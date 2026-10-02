// 全域參數：尺度、畫質級距、玩家數、按鍵預設。各模組自己的可調參數放在該模組檔案頂端。
export const SEED = 196;
export const PLAYERS = 30;
export const WORLD = { half: 400, bound: 440, cell: 4, level: 3.5, sea: 0 };

// 角色與移動（SPEC §1、§4）
export const MOVE = {
  height: 1.8, crouchHeight: 1.2, radius: 0.38, eye: 1.6, crouchEye: 1.15,
  headR: 0.24, headY: 1.62, crouchHeadY: 1.2,
  walk: 4.6, sprint: 6.4, crouch: 2.6,
  accel: 50, decel: 40, airControl: 0.25,
  jump: 7.2, gravity: 22, step: 0.55,
  fallSafe: 16, fallMul: 8,
  skydiveTerm: 55, skydiveDive: 70, skydiveH: 18, glideFall: 6.5, glideH: 16,
  glideOpenAlt: 45, glideAllowAlt: 90,
  // 手感（track move）：土狼時間、跳躍緩衝、翻越
  coyote: 0.1, jumpBuffer: 0.12, mantleMax: 1.3, mantleMin: 0.2, mantleDur: 0.32, stepDecay: 14,
};

// 鏡頭（camera.js 使用；fov 為 1.6:1 橫向螢幕的垂直視角基準）
export const CAMERA = {
  fov: 75, sprintFov: 5, adsFov: 50, sniperFov: 20, skyFov: 82, diveFov: 90, glideFov: 76, busFov: 74,
  dist: 3.5, shoulder: 0.92, height: 1.8, crouchHeight: 1.3,
  adsDist: 1.8, adsShoulder: 0.8, adsTime: 0.15,
  skyDist: 6.5, skyHeight: 2.0, glideDist: 7, glideHeight: 2.0, busDist: 40,
  radius: 0.28,
};

// 畫質級距（render.js 讀取）
export const QUALITY = {
  low: { pr: 1, shadow: 1024, range: 40, fog: 0.0012, trees: 0.5 },
  medium: { pr: 1.25, shadow: 2048, range: 55, fog: 0.001, trees: 0.8 },
  high: { pr: 1.75, shadow: 2048, range: 70, fog: 0.0009, trees: 1 },
  epic: { pr: 2, shadow: 4096, range: 90, fog: 0.0008, trees: 1 },
};
export const QUALITY_ORDER = ['low', 'medium', 'high', 'epic'];

// 按鍵預設（input.js 使用）
export const KEYS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], crouch: ['ControlLeft', 'KeyV'],
  reload: ['KeyR'], interact: ['KeyE'], map: ['KeyM'], pause: ['Escape'],
  buildToggle: ['KeyQ'], wall: ['KeyZ'], floor: ['KeyX'], ramp: ['KeyC'],
  // Digit1 = 十字鎬，Digit2..6 = 欄位 1..5
  slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'],
};
export const DEFAULT_SETTINGS = { sens: 1, invertY: false, volume: 0.7, quality: 'high', autoSprint: true, fov: 75 };
