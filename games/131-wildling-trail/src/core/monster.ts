import { getMove } from '../data/moves';
import { getSpecies } from '../data/species';
import type { MonsterInstance, MoveSlot, SpeciesDef, Stats } from './types';

export const MAX_LEVEL = 30;
export const MAX_MOVES = 4;

/** 能力值：HP = ⌊2·基礎·Lv/100⌋ + Lv + 10；其他 = ⌊2·基礎·Lv/100⌋ + 5。 */
export function calcStats(species: SpeciesDef, level: number): Stats {
  const scale = (base: number) => Math.floor((2 * base * level) / 100);
  return {
    hp: scale(species.base.hp) + level + 10,
    atk: scale(species.base.atk) + 5,
    def: scale(species.base.def) + 5,
    spd: scale(species.base.spd) + 5,
  };
}

export function statsOf(mon: MonsterInstance): Stats {
  return calcStats(getSpecies(mon.species), mon.level);
}

export function maxHp(mon: MonsterInstance): number {
  return statsOf(mon).hp;
}

/** 達到該等級所需的累積經驗值：⌊0.8·Lv³⌋。 */
export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(0.8 * level ** 3);
}

export function levelForExp(exp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && exp >= expForLevel(level + 1)) level++;
  return level;
}

/** 物種在「剛好」某等級會學的招式。 */
export function movesLearnedAt(speciesId: string, level: number): string[] {
  return getSpecies(speciesId).learnset.filter((e) => e.level === level).map((e) => e.move);
}

/** 野生／訓練家怪獸：取等級以下最後學到的四個招式。 */
export function defaultMoves(speciesId: string, level: number): MoveSlot[] {
  const learned: string[] = [];
  for (const entry of getSpecies(speciesId).learnset) {
    if (entry.level <= level && !learned.includes(entry.move)) learned.push(entry.move);
  }
  return learned.slice(-MAX_MOVES).map((id) => ({ id, pp: getMove(id).pp }));
}

export function createMonster(speciesId: string, level: number, uid: string): MonsterInstance {
  const species = getSpecies(speciesId);
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return {
    uid,
    species: species.id,
    nickname: species.name,
    level: lv,
    exp: expForLevel(lv),
    hp: calcStats(species, lv).hp,
    status: 'none',
    sleepTurns: 0,
    moves: defaultMoves(species.id, lv),
  };
}

export function cloneMonster(mon: MonsterInstance): MonsterInstance {
  return { ...mon, moves: mon.moves.map((m) => ({ ...m })) };
}

export function isFainted(mon: MonsterInstance): boolean {
  return mon.hp <= 0;
}

export function clampHp(mon: MonsterInstance, hp: number): number {
  return Math.max(0, Math.min(maxHp(mon), Math.floor(hp)));
}

/** 治療所：HP、狀態、招式次數全部回滿。 */
export function fullHeal(mon: MonsterInstance): void {
  mon.hp = maxHp(mon);
  mon.status = 'none';
  mon.sleepTurns = 0;
  for (const slot of mon.moves) slot.pp = getMove(slot.id).pp;
}

export interface LevelUpResult {
  from: number;
  to: number;
}

/**
 * 加經驗值並處理升級。HP 隨上限增加等量回升，已倒下的不會因升級復活。
 * 回傳升級前後的等級，學招與進化由呼叫端依序處理。
 */
export function gainExp(mon: MonsterInstance, amount: number): LevelUpResult {
  const from = mon.level;
  const oldMax = maxHp(mon);
  mon.exp = Math.min(expForLevel(MAX_LEVEL), mon.exp + Math.max(0, Math.floor(amount)));
  mon.level = levelForExp(mon.exp);
  if (mon.level !== from && mon.hp > 0) {
    mon.hp = clampHp(mon, mon.hp + (maxHp(mon) - oldMax));
  }
  return { from, to: mon.level };
}

export function knowsMove(mon: MonsterInstance, moveId: string): boolean {
  return mon.moves.some((m) => m.id === moveId);
}

/** 學招：欄位未滿直接加入；滿了必須指定要替換的欄位，否則回傳 false。 */
export function learnMove(mon: MonsterInstance, moveId: string, replaceIndex?: number): boolean {
  if (knowsMove(mon, moveId)) return false;
  const slot = { id: moveId, pp: getMove(moveId).pp };
  if (mon.moves.length < MAX_MOVES) {
    mon.moves.push(slot);
    return true;
  }
  if (replaceIndex === undefined || replaceIndex < 0 || replaceIndex >= mon.moves.length) return false;
  mon.moves[replaceIndex] = slot;
  return true;
}

export function evolutionTarget(mon: MonsterInstance): string | null {
  const evo = getSpecies(mon.species).evolution;
  if (!evo || mon.level < evo.level || mon.hp <= 0) return null;
  return evo.into;
}

/** 進化：換物種、保留個體與已受的傷害；暱稱若是舊物種名就換成新名字。 */
export function evolve(mon: MonsterInstance, into: string): void {
  const oldSpecies = getSpecies(mon.species);
  const oldMax = maxHp(mon);
  const next = getSpecies(into);
  mon.species = next.id;
  if (mon.nickname === oldSpecies.name) mon.nickname = next.name;
  mon.hp = clampHp(mon, mon.hp + (maxHp(mon) - oldMax));
}

export function displayName(mon: MonsterInstance): string {
  return mon.nickname || getSpecies(mon.species).name;
}
