// 巡迴賽：季、站、獎金、商店價格、對手成長、存檔（localStorage 'sw195'，存不了也能玩）。
import { UPGRADES, MAX_LEVEL, RIVALS } from './consts.js';

export const SAVE_KEY = 'sw195';
export const ROUNDS = 4; // 一季四站
export const LAPS = 4;

// 名次獎金（第 1 季），每季 +35%；第 3、4 名也拿得到約兩場買一級的錢
const PRIZE_BASE = [100000, 60000, 36000, 20000];
// 第 L 級 → L+1 級的價格；一季（約 25–50 萬）可買 6–9 級
const LEVEL_PRICE = [30000, 45000, 65000, 90000, 120000];
// 各升級的價格倍率：避震只在跳台多、路面顛簸的賽道差得多（實測滿級約快 0–6 秒，輪胎、引擎約 4–6 秒），賣便宜一點
const PRICE_MUL = { tires: 1, engine: 1, shocks: 0.7, nitro: 1 };
export const NITRO_CAN_PRICE = 8000;
export const NITRO_CAN_MAX = 3;

export function prizeTable(season) {
  const m = 1 + 0.35 * (season - 1);
  return PRIZE_BASE.map((v) => Math.round((v * m) / 1000) * 1000);
}

export function levelPrice(level, key) {
  if (level >= MAX_LEVEL) return Infinity;
  const m = (key && PRICE_MUL[key]) || 1;
  return Math.round((LEVEL_PRICE[level] * m) / 1000) * 1000;
}

function freshCareer() {
  return {
    season: 1,
    round: 0,
    money: 0,
    earned: 0,
    races: 0,
    wins: 0,
    upgrades: { tires: 0, engine: 0, shocks: 0, nitro: 0 },
    extraNitro: 0,
    last: null, // 上一場結果摘要
  };
}

function readStore() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && o.v === 1 ? o : {};
  } catch (e) {
    return {};
  }
}

function writeStore(o) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(o));
    return true;
  } catch (e) {
    return false;
  }
}

function clampInt(v, lo, hi, d) {
  v = Math.round(Number(v));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
}

function sanitize(c) {
  const f = freshCareer();
  if (!c || typeof c !== 'object') return null;
  f.season = clampInt(c.season, 1, 99, 1);
  f.round = clampInt(c.round, 0, ROUNDS - 1, 0);
  f.money = clampInt(c.money, 0, 1e9, 0);
  f.earned = clampInt(c.earned, 0, 1e10, 0);
  f.races = clampInt(c.races, 0, 1e6, 0);
  f.wins = clampInt(c.wins, 0, 1e6, 0);
  for (const u of UPGRADES) f.upgrades[u.key] = clampInt(c.upgrades && c.upgrades[u.key], 0, MAX_LEVEL, 0);
  f.extraNitro = clampInt(c.extraNitro, 0, NITRO_CAN_MAX, 0);
  f.last = c.last && typeof c.last === 'object' ? c.last : null;
  return f;
}

export function createCareer() {
  const store = readStore();
  let career = sanitize(store.career);
  let settings = store.settings && typeof store.settings === 'object' ? store.settings : {};

  const persist = () => writeStore({ v: 1, career, settings });

  const api = {
    get data() { return career; },
    get settings() { return settings; },
    hasSave: () => !!career && (career.races > 0 || career.money > 0),
    saveSettings(patch) {
      settings = { ...settings, ...patch };
      persist();
    },
    newCareer() {
      career = freshCareer();
      persist();
      return career;
    },
    ensure() {
      if (!career) career = freshCareer();
      return career;
    },
    // 下一場的設定：賽道、對手技巧與升級
    nextRace() {
      const c = api.ensure();
      return { trackId: c.round % 4, round: c.round, season: c.season, laps: LAPS, rivals: rivalsFor(c.season, c.round, c.upgrades) };
    },
    prizes: () => prizeTable(api.ensure().season),
    price(key) {
      return levelPrice(api.ensure().upgrades[key], key);
    },
    // 臨時氮氣瓶上限：送進 core 的 nitro 參數是「等級＋臨時瓶」，仍守 0..5 契約
    nitroCanRoom() {
      const c = api.ensure();
      return Math.max(0, Math.min(NITRO_CAN_MAX, MAX_LEVEL - c.upgrades.nitro) - c.extraNitro);
    },
    buy(key) {
      const c = api.ensure();
      if (key === 'can' || key === 'nitroCan') {
        if (api.nitroCanRoom() <= 0 || c.money < NITRO_CAN_PRICE) return false;
        c.money -= NITRO_CAN_PRICE;
        c.extraNitro++;
        persist();
        return true;
      }
      if (!(key in c.upgrades)) return false;
      const p = levelPrice(c.upgrades[key], key);
      if (!(p <= c.money)) return false;
      c.money -= p;
      c.upgrades[key]++;
      // 升級後臨時瓶可能超出上限：退錢
      const over = c.extraNitro - Math.max(0, Math.min(NITRO_CAN_MAX, MAX_LEVEL - c.upgrades.nitro));
      if (over > 0) {
        c.extraNitro -= over;
        c.money += over * NITRO_CAN_PRICE;
      }
      persist();
      return true;
    },
    // 比賽結算：place 1..4，pickups 本場撿到的錢
    applyResult(place, pickupCash, bestLap, trackId) {
      const c = api.ensure();
      const table = prizeTable(c.season);
      const prize = table[place - 1] || 0;
      const total = prize + Math.max(0, pickupCash | 0);
      const summary = { season: c.season, round: c.round, trackId, place, prize, pickups: pickupCash | 0, total, bestLap };
      c.money += total;
      c.earned += total;
      c.races++;
      if (place === 1) c.wins++;
      c.extraNitro = 0; // 臨時瓶只用一場
      c.round++;
      summary.seasonEnd = c.round >= ROUNDS;
      if (summary.seasonEnd) {
        c.round = 0;
        c.season++;
      }
      c.last = summary;
      persist();
      return summary;
    },
    // 開發用：直接給錢
    grant(n) {
      api.ensure().money += n;
      persist();
    },
  };
  return api;
}

// 對手：季數與站數推高技巧與升級；三名對手各有偏重。
// 改裝每季每項約 +1 級，而且跟著玩家走：平均等級夾在玩家平均的 −1..+1 級之間
// （玩家買不起時對手不會一路甩開，玩家滿級時對手也會跟上）。playerUps 省略時（示範賽）只看季數。
export function rivalsFor(season, round, playerUps) {
  const r = (season - 1) * ROUNDS + round;
  let pAvg = null;
  if (playerUps && typeof playerUps === 'object') {
    pAvg = UPGRADES.reduce((s, u) => s + (Number(playerUps[u.key]) || 0), 0) / UPGRADES.length;
  }
  return RIVALS.map((rv, i) => {
    const skill = Math.min(0.98, Math.max(0.3, 0.42 + 0.035 * r + rv.bias));
    let base = r * 0.25 + rv.bias * 6;
    if (pAvg !== null) base = Math.min(pAvg + 1 + rv.bias * 4, Math.max(pAvg - 1, base));
    const up = {};
    UPGRADES.forEach((u, j) => {
      const bump = (i + j + r) % 4 === 0 ? 1 : 0;
      up[u.key] = Math.min(MAX_LEVEL, Math.max(0, Math.floor(base) + bump));
    });
    return { ...rv, skill, up };
  });
}
