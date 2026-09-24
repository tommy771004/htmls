// 戰後培育流程：經驗值、升級、學招與進化。
// 以 generator 表示「一步一步的結算」，需要玩家選擇時 yield 一個提示並等待回傳的選項。

import { getMove } from '../data/moves';
import { getSpecies } from '../data/species';
import {
  MAX_MOVES,
  displayName,
  evolutionTarget,
  evolve,
  gainExp,
  knowsMove,
  learnMove,
  movesLearnedAt,
} from './monster';
import type { MonsterInstance } from './types';

export type GrowthCue =
  | { a: 'exp'; uid: string }
  | { a: 'levelup'; uid: string; level: number }
  | { a: 'learn'; uid: string }
  | { a: 'evolveStart'; uid: string; from: string; to: string }
  | { a: 'evolved'; uid: string; from: string; to: string };

export type GrowthStep =
  | { kind: 'msg'; text: string; cue?: GrowthCue }
  /** 招式欄滿了：回傳要忘掉的欄位 0–3，或 -1 放棄學習。 */
  | { kind: 'learn'; uid: string; move: string; text: string };

/** 單一招式的學習流程（欄位未滿直接學會，滿了詢問玩家）。 */
export function* learnFlow(mon: MonsterInstance, moveId: string): Generator<GrowthStep, void, number | undefined> {
  if (knowsMove(mon, moveId)) return;
  const move = getMove(moveId);
  const name = displayName(mon);
  if (mon.moves.length < MAX_MOVES) {
    learnMove(mon, moveId);
    yield { kind: 'msg', text: `${name}學會了${move.name}！`, cue: { a: 'learn', uid: mon.uid } };
    return;
  }
  const choice = yield {
    kind: 'learn',
    uid: mon.uid,
    move: moveId,
    text: `${name}想學習${move.name}，但是已經會 ${MAX_MOVES} 個招式了。要忘記哪一個招式？`,
  };
  if (choice === undefined || choice < 0 || choice >= mon.moves.length) {
    yield { kind: 'msg', text: `${name}放棄學習${move.name}。` };
    return;
  }
  const old = getMove(mon.moves[choice].id).name;
  learnMove(mon, moveId, choice);
  yield { kind: 'msg', text: `${name}忘記了${old}，學會了${move.name}！`, cue: { a: 'learn', uid: mon.uid } };
}

/**
 * 依隊伍順序發放經驗值 → 逐級升級與學招 → 本場有升級且沒倒下的怪獸檢查進化。
 * 直接修改傳入的隊伍（應為戰鬥用的複本），由呼叫端在流程結束後一次提交。
 */
export function* growthFlow(
  party: MonsterInstance[],
  ledger: ReadonlyMap<string, number>,
): Generator<GrowthStep, void, number | undefined> {
  const leveled = new Set<string>();
  for (const mon of party) {
    const amount = ledger.get(mon.uid) ?? 0;
    if (amount <= 0 || mon.hp <= 0) continue;
    yield { kind: 'msg', text: `${displayName(mon)}得到了 ${amount} 點經驗值！`, cue: { a: 'exp', uid: mon.uid } };
    const { from, to } = gainExp(mon, amount);
    for (let level = from + 1; level <= to; level++) {
      leveled.add(mon.uid);
      yield { kind: 'msg', text: `${displayName(mon)}升到了 Lv.${level}！`, cue: { a: 'levelup', uid: mon.uid, level } };
      for (const moveId of movesLearnedAt(mon.species, level)) yield* learnFlow(mon, moveId);
    }
  }
  for (const mon of party) {
    if (!leveled.has(mon.uid)) continue;
    // 一次跳過兩個進化門檻時會連續進化。
    let target = evolutionTarget(mon);
    while (target) {
      const from = mon.species;
      const before = displayName(mon);
      yield { kind: 'msg', text: `咦？${before}的樣子……`, cue: { a: 'evolveStart', uid: mon.uid, from, to: target } };
      evolve(mon, target);
      yield {
        kind: 'msg',
        text: `${before}進化成了${getSpecies(target).name}！`,
        cue: { a: 'evolved', uid: mon.uid, from, to: target },
      };
      for (const moveId of movesLearnedAt(mon.species, mon.level)) yield* learnFlow(mon, moveId);
      target = evolutionTarget(mon);
    }
  }
}
