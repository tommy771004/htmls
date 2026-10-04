// 常數、色票、英雄與技能數值。數值調整集中在這裡。
export const DT = 1 / 60;            // 固定模擬步長
export const MAP = 90;               // 地圖半寬
export const TEAM_COLOR = ['#24a38f', '#d9472b'];
export const TEAM_LIGHT = ['#8fe8d4', '#ffa184'];
export const TEAM_NAME = ['青隊', '赤隊'];
export const BASE = [[-72, 72], [72, -72]];
export const FOUNTAIN = [[-81, 81], [81, -81]];

export const KI_BAR = 100;
export const KI_MAX = 5 * KI_BAR;
export const MAX_LEVEL = 12;
export const xpToNext = (lv) => 120 + 70 * (lv - 1);
export const respawnTime = (lv) => 5 + lv * 1.4;

// 小兵與建築
export const WAVE_EVERY = 25;
export const FIRST_WAVE = 4;
export const MINION = {
  melee: { hp: 380, dmg: 16, range: 1.7, cd: 1.1, speed: 4.6, radius: 0.55, xp: 34, sight: 8 },
  ranged: { hp: 260, dmg: 24, range: 6.2, cd: 1.4, speed: 4.6, radius: 0.5, xp: 28, sight: 8.5 },
  siege: { hp: 950, dmg: 42, range: 6.8, cd: 1.8, speed: 4.3, radius: 0.85, xp: 70, sight: 9, structMul: 2.1 },
};
export const SIEGE_FROM_WAVE = 10;     // 第幾波起每波帶一台攻城兵
export const MINION_GROWTH = 0.06;   // 每分鐘血量與傷害成長
export const TOWER = { hp: [2000, 2400], core: 3600, range: 9, dmg: 150, dmgMinion: 95, cd: 1.0, ramp: 0.35, radius: 1.6 };
export const XP_SHARE_RADIUS = 15;

// 英雄
// stats: hp/hpLv 血量與每級成長、ad/adLv 攻擊、range 普攻距離、as 普攻間隔（秒）、ms 移速、armor 減傷（0..1）
export const HEROES = {
  homura: {
    name: '燎', en: 'HOMURA', role: '近戰鬥士', color: '#ff7a1a', glow: '#ffd29a', melee: true,
    blurb: '以拳腳點燃路線的鬥士。連段長、續戰力強，適合正面硬拚。',
    stats: { hp: 640, hpLv: 88, ad: 56, adLv: 4.2, range: 2.4, as: 0.78, ms: 7.2, armor: 0.12 },
    skills: {
      Q: { name: '炎氣彈', desc: '射出火球，命中後小範圍爆炸。', cd: 5, range: 14, dmg: [70, 110, 150, 190, 230], adR: 0.6, radius: 2.6, speed: 32 },
      W: { name: '燎原連打', desc: '向前衝刺，撞到敵人時打出四段連打並把對手打飛。', cd: 9, range: 8, dmg: [24, 34, 44, 54, 64], hits: 4, adR: 0.25 },
      E: { name: '殘影步', desc: '花 1 格氣瞬移；游標附近有敵人時繞到它背後，下一次普攻硬直。', cd: 10, range: 7, ki: 1 },
      R: { name: '燎天烈波', desc: '花 3 格氣，雙掌放出巨大光束，持續 1.2 秒。', cd: 45, range: 22, dmg: [60, 90, 120], ticks: 6, adR: 0.35, width: 2.4, ki: 3 },
    },
  },
  shimo: {
    name: '霜翎', en: 'SHIMO', role: '遠程術士', color: '#7fd8ff', glow: '#e4f8ff', melee: false,
    blurb: '從遠處以冰槍牽制的術士。身板脆，靠距離與冰凍保命。',
    stats: { hp: 520, hpLv: 72, ad: 50, adLv: 3.6, range: 7.4, as: 0.85, ms: 7.0, armor: 0.06 },
    skills: {
      Q: { name: '霜槍', desc: '擲出穿透冰槍，命中的敵人減速 40%。', cd: 6, range: 16, dmg: [80, 120, 160, 200, 240], adR: 0.55, width: 1.3, speed: 38, slow: 0.4 },
      W: { name: '冰刃突進', desc: '穿過路徑上所有敵人並造成傷害，終點揮出冰斬。', cd: 10, range: 9, dmg: [60, 90, 120, 150, 180], adR: 0.5 },
      E: { name: '霧隱步', desc: '花 1 格氣瞬移較長距離，留下冰霧減速追兵。', cd: 11, range: 9.5, ki: 1 },
      R: { name: '絕對零度', desc: '花 3 格氣，在游標處落下冰隕，範圍傷害並冰凍 1.2 秒。', cd: 50, range: 15, dmg: [260, 380, 500], adR: 0.8, radius: 6, ki: 3 },
    },
  },
  iwao: {
    name: '磐岳', en: 'IWAO', role: '坦克', color: '#9be03c', glow: '#e3ffb5', melee: true,
    blurb: '皮厚的山岳武人。擊飛與衝撞把敵人留在原地，讓隊友收割。',
    stats: { hp: 780, hpLv: 108, ad: 50, adLv: 3.6, range: 2.6, as: 0.9, ms: 6.8, armor: 0.24 },
    skills: {
      Q: { name: '震地拳', desc: '一拳打進地面，扇形地波擊飛敵人 0.6 秒。', cd: 7, range: 8, dmg: [70, 105, 140, 175, 210], adR: 0.5, arc: 0.9 },
      W: { name: '山崩衝撞', desc: '衝撞，頂著第一個撞到的英雄前進再連打。', cd: 11, range: 8.5, dmg: [30, 42, 54, 66, 78], hits: 3, adR: 0.3 },
      E: { name: '縮地', desc: '花 1 格氣瞬移，獲得可吸收傷害的岩盾。', cd: 12, range: 6, ki: 1, shield: [90, 130, 170, 210, 250] },
      R: { name: '天崩', desc: '花 3 格氣，躍向游標處砸地，大範圍擊飛 1 秒。', cd: 50, range: 11, dmg: [220, 320, 420], adR: 0.7, radius: 6.5, ki: 3 },
    },
  },
  raiga: {
    name: '迅雷', en: 'RAIGA', role: '刺客', color: '#ffe14a', glow: '#fff8cf', melee: true,
    blurb: '快得只剩殘影的刺客。瞬移切入、雷擊連鎖，打完就走。',
    stats: { hp: 560, hpLv: 78, ad: 62, adLv: 4.6, range: 2.3, as: 0.68, ms: 7.6, armor: 0.08 },
    skills: {
      Q: { name: '雷矢', desc: '射出雷矢，命中後連鎖到附近兩個敵人。', cd: 5, range: 13, dmg: [65, 100, 135, 170, 205], adR: 0.55, speed: 46, chain: 2 },
      W: { name: '迅雷百烈', desc: '衝刺後接六段快打。', cd: 8, range: 7, dmg: [14, 20, 26, 32, 38], hits: 6, adR: 0.18 },
      E: { name: '閃', desc: '花 1 格氣，閃到目標背後並重置普攻鏈。', cd: 8, range: 9, ki: 1 },
      R: { name: '雷神千擊', desc: '花 3 格氣，在範圍內最多五個敵人之間來回瞬移斬擊。', cd: 45, range: 10, dmg: [110, 160, 210], adR: 0.4, targets: 5, ki: 3 },
    },
  },
};
export const HERO_ORDER = ['homura', 'shimo', 'iwao', 'raiga'];

export const SPARK = { dur: 8, cd: 90, dmg: 1.2, ms: 1.25, heal: 0.18 };
export const RECALL_TIME = 4;
export const COMBO_WINDOW = 1.6;
export const HITSTOP = { L: 0.045, M: 0.06, H: 0.085, skill: 0.1, super: 0.22 };
