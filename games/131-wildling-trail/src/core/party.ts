import { displayName, isFainted } from './monster';
import type { MonsterInstance } from './types';

export const PARTY_MAX = 6;
export const BOX_MAX = 60;

export interface Roster {
  party: MonsterInstance[];
  box: MonsterInstance[];
}

export function hasStorageFor(roster: Roster): boolean {
  return roster.party.length < PARTY_MAX || roster.box.length < BOX_MAX;
}

/**
 * 新怪獸入隊：隊伍未滿放隊伍，滿了送收納箱。
 * 絕不覆蓋既有個體；同一個 uid 已存在時拒絕，避免重複新增。
 */
export function storeNewMonster(roster: Roster, mon: MonsterInstance): 'party' | 'box' | null {
  const exists = roster.party.some((m) => m.uid === mon.uid) || roster.box.some((m) => m.uid === mon.uid);
  if (exists) return null;
  if (roster.party.length < PARTY_MAX) {
    roster.party.push(mon);
    return 'party';
  }
  if (roster.box.length < BOX_MAX) {
    roster.box.push(mon);
    return 'box';
  }
  return null;
}

/** 存入收納箱：隊伍至少要留一隻還能戰鬥的怪獸。 */
export function depositCheck(roster: Roster, index: number): string | null {
  const mon = roster.party[index];
  if (!mon) return '沒有這隻怪獸';
  if (roster.box.length >= BOX_MAX) return '收納箱已經滿了';
  const rest = roster.party.filter((_, i) => i !== index);
  if (rest.length === 0) return '隊伍裡至少要留一隻怪獸';
  if (rest.every(isFainted)) return '隊伍裡至少要留一隻還能戰鬥的怪獸';
  return null;
}

export function deposit(roster: Roster, index: number): string {
  const error = depositCheck(roster, index);
  if (error) throw new Error(error);
  const [mon] = roster.party.splice(index, 1);
  roster.box.push(mon);
  return `${displayName(mon)}被存進了收納箱。`;
}

export function withdrawCheck(roster: Roster, index: number): string | null {
  if (!roster.box[index]) return '沒有這隻怪獸';
  if (roster.party.length >= PARTY_MAX) return '隊伍已經滿了（最多 6 隻）';
  return null;
}

export function withdraw(roster: Roster, index: number): string {
  const error = withdrawCheck(roster, index);
  if (error) throw new Error(error);
  const [mon] = roster.box.splice(index, 1);
  roster.party.push(mon);
  return `${displayName(mon)}加入了隊伍。`;
}

export function swapParty(roster: Roster, a: number, b: number): void {
  if (!roster.party[a] || !roster.party[b]) throw new Error('交換位置超出範圍');
  [roster.party[a], roster.party[b]] = [roster.party[b], roster.party[a]];
}
