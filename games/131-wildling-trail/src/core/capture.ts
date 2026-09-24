import { getSpecies } from '../data/species';
import { maxHp } from './monster';
import type { MonsterInstance, Status } from './types';

export const CAPTURE_MIN = 0.05;
export const CAPTURE_MAX = 0.95;

export const STATUS_CATCH_BONUS: Record<Status, number> = {
  none: 1,
  burn: 1.5,
  poison: 1.5,
  sleep: 2,
};

/**
 * 捕捉機率 = clamp(物種捕捉率 × 道具倍率 × 狀態倍率 × (3·最大HP − 2·目前HP) / (3·最大HP), 5%, 95%)
 * 滿血時 HP 因子為 1/3，剩 1 HP 時接近 1。
 */
export function captureChance(target: MonsterInstance, itemMultiplier: number): number {
  const max = maxHp(target);
  const hpFactor = (3 * max - 2 * target.hp) / (3 * max);
  const raw = getSpecies(target.species).catchRate * itemMultiplier * STATUS_CATCH_BONUS[target.status] * hpFactor;
  return Math.max(CAPTURE_MIN, Math.min(CAPTURE_MAX, raw));
}

/**
 * 由同一次擲骰推出籠子搖晃次數，只給動畫使用，不影響結果。
 * 成功固定搖 3 下；失敗時擲骰越接近門檻搖越多下。
 */
export function captureShakes(roll: number, chance: number, success: boolean): number {
  if (success) return 3;
  if (roll < Math.min(0.999, chance * 1.5)) return 2;
  if (roll < Math.min(0.999, chance * 2.5)) return 1;
  return 0;
}
