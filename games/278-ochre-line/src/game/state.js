// 全遊戲共用狀態。UI 每幀讀 G，不寫 G；要動作走 actions（見 src/main.js）。tick 內不配置物件。
export const TEAM = { atk: 0, def: 1 };
export const TEAM_NAME = ['赤沙', '海防'];
export const TEAM_COLOR = ['#C4552D', '#5FA89A'];
/** 開賽名單：0 是玩家，1–4 是隊友，5–9 是對手（hud、選單名單共用）。 */
export const NAMES = ['你', '石原', '阿瑞', '柯恩', '杜拉', '萊拉', '維克', '塔瑪', '賽爾', '諾亞'];

import { NEW_GUNS } from './guns/index.js';

// slot：1 主武器 2 手槍 3 刀 4 投擲物 5 裝藥。dmg 身體、head 爆頭、pen 護甲穿透率、rec 彈道表 id。新槍在 guns/<id>.js
export const WEAPONS = {
  knife: { id: 'knife', name: 'K2 戰鬥刀', slot: 3, price: 0, mag: 0, rsv: 0, rpm: 150, dmg: 35, head: 55, pen: 1, range: 1.8, spread: 0, speedK: 1, reload: 0 },
  p9: { id: 'p9', name: 'P9 手槍', slot: 2, price: 0, mag: 12, rsv: 36, rpm: 400, dmg: 30, head: 110, pen: 0.5, range: 90, spread: 0.008, speedK: 0.96, reload: 2.2, semi: true },
  r50: { id: 'r50', name: 'R50 重型手槍', slot: 2, price: 700, mag: 7, rsv: 35, rpm: 240, dmg: 55, head: 190, pen: 0.88, range: 110, spread: 0.012, speedK: 0.92, reload: 2.2, semi: true },
  v11: { id: 'v11', name: 'V11 衝鋒槍', slot: 1, price: 1200, mag: 30, rsv: 120, rpm: 900, dmg: 24, head: 72, pen: 0.6, range: 70, spread: 0.02, speedK: 0.96, reload: 2.6, auto: true, rec: 'smg' },
  s8: { id: 's8', name: 'S8 霰彈槍', slot: 1, price: 1800, mag: 7, rsv: 28, rpm: 68, dmg: 21, head: 42, pen: 0.72, range: 40, spread: 0.043, pellets: 9, speedK: 0.88, reload: 3.4 },
  ks: { id: 'ks', name: 'KS 短突擊步槍', slot: 1, price: 2700, mag: 30, rsv: 90, rpm: 650, dmg: 34, head: 120, pen: 0.77, range: 130, spread: 0.009, speedK: 0.86, reload: 2.5, auto: true, rec: 'ks' },
  ar5: { id: 'ar5', name: 'AR5 突擊步槍', slot: 1, price: 3100, mag: 30, rsv: 90, rpm: 700, dmg: 31, head: 105, pen: 0.7, range: 130, spread: 0.008, speedK: 0.9, reload: 3.1, auto: true, rec: 'ar5' },
  l40: { id: 'l40', name: 'L40 狙擊槍', slot: 1, price: 4750, mag: 5, rsv: 20, rpm: 40, dmg: 110, head: 250, pen: 0.97, range: 300, spread: 0.0004, hipSpread: 0.07, speedK: 0.8, reload: 3.6, scope: true },
  frag: { id: 'frag', name: '破片手雷', slot: 4, price: 300, nade: true },
  smoke: { id: 'smoke', name: '煙霧彈', slot: 4, price: 300, nade: true },
  flash: { id: 'flash', name: '閃光彈', slot: 4, price: 200, nade: true },
  charge: { id: 'charge', name: '破門裝藥', slot: 5, price: 0 },
  ...Object.fromEntries(NEW_GUNS.map(g => [g.id, g])),
};
export const GEAR = { armor: { name: '防彈衣', price: 650 }, helmet: { name: '防彈衣＋頭盔', price: 1000 }, kit: { name: '拆彈鉗', price: 400 } };
export const RULES = { winTarget: 7, half: 6, buyTime: 12, roundTime: 105, chargeTime: 40, plantTime: 3.2, defuseTime: 10, defuseKit: 5, postTime: 5, startMoney: 800, maxMoney: 16000, winMoney: 3250, loseBase: 1400, loseStep: 500, loseMax: 3400 };

export const G = {
  history: [],
  phase: 'menu',     // menu | buy | live | planted | post | over
  paused: false, time: 0, round: 1, score: [0, 0], lossStreak: [0, 0],
  charge: null,      // { x, y, z, site, t } 裝藥狀態，未安裝為 null；t 剩餘秒數
  plantP: 0, defuseP: 0,  // 玩家進度 0..1
  agents: [], me: null,
  feed: [],          // 最近擊殺：{ killer, kteam, victim, vteam, weapon, wid, head, mine, t }
  log: [],           // 左下事件紀錄：{ text, gold, t }，只記玩家自己的金錢與購買
  mvp: null,         // 回合最佳：{ name, kills, dmg, team, obj }
  banner: '', bannerT: 0, // 置中訊息
  flash: 0, hitMark: 0, dmgDir: 0, dmgT: 0, zone: '', scoped: false,
  canBuy: false, buyOpen: false, scoreOpen: false,
  winner: -1,
};

export function makeAgent(i, team, name, isBot) {
  return {
    i, team, name, isBot, alive: true, hp: 100, armor: 0, helmet: false, kit: false, money: RULES.startMoney,
    kills: 0, deaths: 0, score: 0, shots: 0, hits: 0, rk: 0, rd: 0, obj: 0, // rk／rd／obj：本回合擊殺、傷害、目標（裝藥或拆除）
    slots: [null, 'knife', null, null, null], // 依序 主、手槍、刀… 見 weapons.js
    primary: null, secondary: 'p9', nades: [], hasCharge: false, cur: 'p9',
    ammo: {}, rsv: {},
    x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, h: 1.8, eye: 1.7, ground: true, crouch: false, fell: false,
    speedK: 1, slowT: 0, hitT: 0, fireT: 0, reloadT: 0, burst: 0, burstT: 0, inaccuracy: 0, soldier: null, bot: null,
  };
}
