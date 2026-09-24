// 存檔格式、驗證與讀寫。儲存媒介以介面注入：瀏覽器用 localStorage，測試用記憶體。

import { ITEMS } from '../data/items';
import { MAPS } from '../data/maps';
import { MOVES } from '../data/moves';
import { SPECIES } from '../data/species';
import { TRAINERS } from '../data/trainers';
import { ITEM_MAX, MONEY_MAX } from './inventory';
import { MAX_LEVEL, MAX_MOVES, expForLevel, maxHp } from './monster';
import { BOX_MAX, PARTY_MAX } from './party';
import { FLAG_NAMES } from './progress';
import type { Dir, MonsterInstance, Progress, Settings } from './types';
import { isWalkable, warpAt } from './world';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'wildling-trail.save';
export const CORRUPT_KEY = 'wildling-trail.save.corrupt';

export interface SaveFile {
  version: number;
  savedAt: number;
  progress: Progress;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; progress: Progress; savedAt: number }
  | { status: 'corrupt'; error: string };

export const DEFAULT_SETTINGS: Settings = { sound: true, reducedMotion: false, instantText: false };

class SaveError extends Error {}

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
const FLAG_SET = new Set<string>(FLAG_NAMES);

function fail(msg: string): never {
  throw new SaveError(msg);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function int(v: unknown, label: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) fail(`${label} 不是整數`);
  if (v < min || v > max) fail(`${label} 超出範圍 ${min}–${max}`);
  return v;
}

function bool(v: unknown, label: string): boolean {
  if (typeof v !== 'boolean') fail(`${label} 不是布林值`);
  return v;
}

function str(v: unknown, label: string, maxLen = 64): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > maxLen) fail(`${label} 格式錯誤`);
  return v;
}

function readMonster(v: unknown, label: string): MonsterInstance {
  if (!isObj(v)) fail(`${label} 格式錯誤`);
  const species = str(v.species, `${label}.species`);
  if (!SPECIES[species]) fail(`${label} 的物種 ${species} 不存在`);
  const level = int(v.level, `${label}.level`, 1, MAX_LEVEL);
  const exp = int(v.exp, `${label}.exp`, 0, expForLevel(MAX_LEVEL));
  if (exp < expForLevel(level) || (level < MAX_LEVEL && exp >= expForLevel(level + 1))) {
    fail(`${label} 的經驗值與等級不一致`);
  }
  const status = v.status;
  if (status !== 'none' && status !== 'burn' && status !== 'poison') fail(`${label} 的狀態不合法`);
  if (!Array.isArray(v.moves) || v.moves.length < 1 || v.moves.length > MAX_MOVES) fail(`${label} 的招式數量不合法`);
  const seenMoves = new Set<string>();
  const moves = v.moves.map((m, i) => {
    if (!isObj(m)) fail(`${label} 的第 ${i + 1} 個招式格式錯誤`);
    const id = str(m.id, `${label}.moves[${i}].id`);
    const def = MOVES[id];
    if (!def || id === 'struggle') fail(`${label} 的招式 ${id} 不存在`);
    if (seenMoves.has(id)) fail(`${label} 重複學會 ${id}`);
    seenMoves.add(id);
    return { id, pp: int(m.pp, `${label}.moves[${i}].pp`, 0, def.pp) };
  });
  const mon: MonsterInstance = {
    uid: str(v.uid, `${label}.uid`, 32),
    species,
    nickname: str(v.nickname, `${label}.nickname`, 16),
    level,
    exp,
    hp: 0,
    status,
    sleepTurns: 0,
    moves,
  };
  mon.hp = int(v.hp, `${label}.hp`, 0, maxHp(mon));
  if (mon.hp === 0 && mon.status !== 'none') fail(`${label} 已倒下卻帶有狀態`);
  return mon;
}

/** 驗證格式、數值範圍與資料參照；成功時回傳乾淨的新物件（不含多餘欄位）。 */
export function validateProgress(v: unknown): Progress {
  if (!isObj(v)) fail('進度格式錯誤');
  const p = v.player;
  if (!isObj(p)) fail('缺少角色位置');
  const mapId = str(p.map, 'player.map');
  const map = MAPS[mapId];
  if (!map) fail(`地圖 ${mapId} 不存在`);
  const facing = p.facing as Dir;
  if (!DIRS.includes(facing)) fail('角色朝向不合法');

  const flagsRaw = v.flags;
  if (!isObj(flagsRaw)) fail('缺少任務旗標');
  const flags: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(flagsRaw)) {
    if (!FLAG_SET.has(k)) fail(`未知的旗標 ${k}`);
    flags[k] = bool(val, `旗標 ${k}`);
  }
  const x = int(p.x, 'player.x', 0, 99);
  const y = int(p.y, 'player.y', 0, 99);
  if (!isWalkable(map, flags, x, y) || warpAt(map, x, y)) fail('角色位置不在可以站立的格子上');

  if (!Array.isArray(v.party) || v.party.length > PARTY_MAX) fail('隊伍數量不合法');
  if (!Array.isArray(v.box) || v.box.length > BOX_MAX) fail('收納箱數量不合法');
  const party = v.party.map((m, i) => readMonster(m, `隊伍第 ${i + 1} 隻`));
  const box = v.box.map((m, i) => readMonster(m, `收納箱第 ${i + 1} 隻`));
  const uids = new Set<string>();
  for (const m of [...party, ...box]) {
    if (uids.has(m.uid)) fail(`怪獸 ${m.uid} 重複出現`);
    uids.add(m.uid);
  }
  if (flags.gotStarter && party.length === 0) fail('已經選過夥伴，隊伍卻是空的');

  if (!isObj(v.bag)) fail('背包格式錯誤');
  const bag: Record<string, number> = {};
  for (const [id, n] of Object.entries(v.bag)) {
    if (!ITEMS[id]) fail(`背包裡有不存在的道具 ${id}`);
    bag[id] = int(n, `道具 ${id} 數量`, 0, ITEM_MAX);
  }

  if (!isObj(v.dex) || !Array.isArray(v.dex.seen) || !Array.isArray(v.dex.caught)) fail('圖鑑格式錯誤');
  const seen = [...new Set(v.dex.seen.map((s) => str(s, '圖鑑物種')))];
  const caught = [...new Set(v.dex.caught.map((s) => str(s, '圖鑑物種')))];
  for (const s of [...seen, ...caught]) if (!SPECIES[s]) fail(`圖鑑裡有不存在的物種 ${s}`);
  for (const s of caught) if (!seen.includes(s)) fail(`圖鑑：${s} 已捕捉卻未見過`);

  if (!Array.isArray(v.defeated)) fail('已擊敗對手格式錯誤');
  const defeated = [...new Set(v.defeated.map((d) => str(d, '已擊敗對手')))];
  for (const d of defeated) if (!TRAINERS[d]) fail(`不存在的對手 ${d}`);

  const s = v.settings;
  if (!isObj(s)) fail('設定格式錯誤');
  const settings: Settings = {
    sound: bool(s.sound, '設定.音效'),
    reducedMotion: bool(s.reducedMotion, '設定.減少動態'),
    instantText: bool(s.instantText, '設定.文字速度'),
  };

  return {
    player: { map: mapId, x, y, facing },
    party,
    box,
    bag,
    money: int(v.money, '金錢', 0, MONEY_MAX),
    dex: { seen, caught },
    flags,
    defeated,
    settings,
    nextUid: int(v.nextUid, 'nextUid', 1, 1_000_000),
    playTimeMs: int(v.playTimeMs, '遊玩時間', 0, 1e12),
  };
}

export function serializeSave(progress: Progress, savedAt: number): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt, progress };
  return JSON.stringify(file);
}

export function parseSave(raw: string): LoadResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', error: '存檔不是有效的 JSON' };
  }
  try {
    if (!isObj(data)) fail('存檔格式錯誤');
    if (data.version !== SAVE_VERSION) fail(`不支援的存檔版本 ${String(data.version)}`);
    const savedAt = int(data.savedAt, '存檔時間', 0, 1e14);
    const progress = validateProgress(data.progress);
    // nextUid 必須大於所有既有編號，避免之後產生重複的個體。
    for (const m of [...progress.party, ...progress.box]) {
      const n = Number(m.uid.replace(/^m/, ''));
      if (Number.isInteger(n) && n >= progress.nextUid) fail('個體編號與 nextUid 不一致');
    }
    return { status: 'ok', progress, savedAt };
  } catch (e) {
    if (e instanceof SaveError) return { status: 'corrupt', error: e.message };
    throw e;
  }
}

/** 包住 KeyValueStorage；任何存取錯誤都轉成結果，不讓畫面白掉。 */
export class SaveSlot {
  constructor(private readonly storage: KeyValueStorage | null) {}

  get available(): boolean {
    return this.storage !== null;
  }

  load(): LoadResult {
    let raw: string | null;
    try {
      raw = this.storage?.getItem(SAVE_KEY) ?? null;
    } catch {
      return { status: 'corrupt', error: '瀏覽器拒絕讀取存檔' };
    }
    if (raw === null) return { status: 'empty' };
    return parseSave(raw);
  }

  /**
   * 寫入前先驗證一次；驗證不過就不寫，原存檔保持不變。
   * 回傳 null 代表成功，否則是錯誤訊息。
   */
  write(progress: Progress, now: number): string | null {
    if (!this.storage) return '這個瀏覽器無法存檔';
    const raw = serializeSave(progress, now);
    const check = parseSave(raw);
    if (check.status !== 'ok') return `存檔資料不一致，已取消存檔（${check.status === 'corrupt' ? check.error : ''}）`;
    try {
      this.storage.setItem(SAVE_KEY, raw);
      return null;
    } catch {
      return '瀏覽器拒絕寫入存檔（可能是空間不足或私密模式）';
    }
  }

  /** 損壞的存檔在被覆寫前先另外備份一份，不會靜默消失。 */
  backupCorrupt(): void {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      if (raw !== null && raw !== undefined) this.storage!.setItem(CORRUPT_KEY, raw);
    } catch {
      // 備份失敗時保持原樣，不刪除原資料。
    }
  }

  hasCorruptBackup(): boolean {
    try {
      return (this.storage?.getItem(CORRUPT_KEY) ?? null) !== null;
    } catch {
      return false;
    }
  }
}

export class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}
