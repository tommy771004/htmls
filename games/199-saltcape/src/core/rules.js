// 武器、護甲、毒圈與對局節奏的數值表。

export const TICK = 30;            // 伺服器每秒推進次數
export const DT = 1 / TICK;
export const SNAP_EVERY = 2;       // 每 2 個 tick 送一次快照（15 Hz）

export const AMMO = {
  l: { name: '輕型彈藥', cap: 240, pack: 40 },
  h: { name: '重型彈藥', cap: 240, pack: 40 },
  s: { name: '霰彈', cap: 40, pack: 10 },
  n: { name: '狙擊彈', cap: 30, pack: 8 },
};
export const AMMO_KEYS = ['l', 'h', 's', 'n'];
export const BULLET_G = 9.8;   // 有 vel 的武器（射手步槍、狙擊槍）子彈受重力下墜

// dmg 單發；rpm 射速；auto 是否全自動；mag 彈匣；reload 秒；hip/ads 散布（弧度）；
// r1/r2 衰減起訖距離、fall 最遠倍率；hs 爆頭倍率；pellets 霰彈數；zoom 開鏡倍率
export const WEAPONS = {
  p9: { name: '短號 P9', cls: '手槍', ammo: 'l', dmg: 24, rpm: 420, auto: false, mag: 15, reload: 1.3, hip: 0.022, ads: 0.006, r1: 18, r2: 50, fall: 0.6, hs: 1.6, move: 3.0, zoom: 1.15 },
  smg: { name: '黃蜂 SMG', cls: '衝鋒槍', ammo: 'l', dmg: 19, rpm: 880, auto: true, mag: 32, reload: 1.9, hip: 0.03, ads: 0.011, r1: 15, r2: 45, fall: 0.55, hs: 1.4, move: 3.0, zoom: 1.2 },
  ar: { name: '鐵砧-74', cls: '突擊步槍', ammo: 'h', dmg: 27, rpm: 620, auto: true, mag: 30, reload: 2.2, hip: 0.04, ads: 0.0055, r1: 35, r2: 110, fall: 0.7, hs: 1.5, move: 2.6, zoom: 1.4 },
  sg: { name: '碎浪 12', cls: '霰彈槍', ammo: 's', dmg: 13, rpm: 75, auto: false, mag: 6, reload: 2.6, hip: 0.075, ads: 0.06, r1: 6, r2: 22, fall: 0.25, hs: 1.3, move: 2.8, zoom: 1.1, pellets: 9 },
  dmr: { name: '長弓 DMR', cls: '射手步槍', ammo: 'h', dmg: 52, rpm: 260, auto: false, mag: 10, reload: 2.4, hip: 0.05, ads: 0.002, r1: 60, r2: 200, fall: 0.8, hs: 1.75, move: 2.4, zoom: 2.6, vel: 540 },
  sr: { name: '信天翁 .338', cls: '狙擊步槍', ammo: 'n', dmg: 105, rpm: 46, auto: false, mag: 5, reload: 3.0, hip: 0.09, ads: 0.0008, r1: 100, r2: 400, fall: 0.85, hs: 2.0, move: 2.0, zoom: 5.5, vel: 640 },
};
export const WEAPON_KEYS = Object.keys(WEAPONS);

export const RARITY = [
  { name: '普通', color: '#b9b2a4', dmg: 1, mag: 1 },
  { name: '精良', color: '#7fbf5a', dmg: 1.05, mag: 1 },
  { name: '稀有', color: '#5aa6d9', dmg: 1.1, mag: 1.2 },
  { name: '傳說', color: '#e2b33c', dmg: 1.16, mag: 1.34 },
];
export const magOf = (w, r) => Math.round(WEAPONS[w].mag * RARITY[r].mag);

export const PLATE = 50;           // 每片護甲
export const PLATE_INV_MAX = 8;
export const PLATE_TIME = 1.0;
export const HP_MAX = 100;
export const REGEN_DELAY = 5;
export const REGEN_RATE = 22;

// 戰利品代碼：1..4 彈藥、5 護甲片、6 二級背心、7 三級背心、10+ 武器（10 + 武器序 × 4 + 稀有度）
export const LOOT = { AMMO0: 1, PLATE: 5, VEST2: 6, VEST3: 7, WEAPON0: 10 };
export const weaponCode = (w, r) => LOOT.WEAPON0 + WEAPON_KEYS.indexOf(w) * 4 + r;
export function decodeLoot(code) {
  if (code >= LOOT.WEAPON0) { const k = code - LOOT.WEAPON0; return { kind: 'w', w: WEAPON_KEYS[k >> 2], r: k & 3 }; }
  if (code >= 1 && code <= 4) return { kind: 'a', a: AMMO_KEYS[code - 1] };
  if (code === 5) return { kind: 'p' };
  if (code === 6 || code === 7) return { kind: 'v', lv: code - 4 };
  return { kind: '?' };
}
export function lootLabel(code, amount) {
  const d = decodeLoot(code);
  if (d.kind === 'w') return `${WEAPONS[d.w].name}`;
  if (d.kind === 'a') return `${AMMO[d.a].name} ×${amount}`;
  if (d.kind === 'p') return `護甲片 ×${amount}`;
  if (d.kind === 'v') return `${d.lv} 級護甲背心`;
  return '';
}

// 毒圈 8 階段：wait 顯示下一圈後等待、shrink 縮圈時間、r 縮到的半徑、dps 圈外每秒傷害
export const STORM = [
  { wait: 75, shrink: 45, r: 700, dps: 1 },
  { wait: 45, shrink: 40, r: 470, dps: 2 },
  { wait: 40, shrink: 35, r: 310, dps: 4 },
  { wait: 35, shrink: 30, r: 195, dps: 6 },
  { wait: 30, shrink: 25, r: 115, dps: 8 },
  { wait: 25, shrink: 20, r: 62, dps: 11 },
  { wait: 20, shrink: 18, r: 28, dps: 14 },
  { wait: 15, shrink: 25, r: 0, dps: 18 },
];
export const STORM_R0 = 1350;

export const PLANE_ALT = 560;
export const PLANE_SPEED = 52;
export const MATCH = {
  lobbyQuick: 25,      // 快速配對倒數
  lobbyPrivate: 600,   // 好友房房主未按開始時的上限
  target: 100,         // 人數不足時以 AI 補滿
  maxHumans: 24,
  endLinger: 14,       // 結算後回到大廳的秒數
};

export const BITS = {
  FWD: 1, BACK: 2, LEFT: 4, RIGHT: 8, JUMP: 16, SPRINT: 32, CROUCH: 64, FIRE: 128,
  ADS: 256, RELOAD: 512, USE: 1024, PLATE: 2048, SWAP: 4096, SLOT1: 8192, SLOT2: 16384,
};
