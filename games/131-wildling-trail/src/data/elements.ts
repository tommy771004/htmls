import type { ElementType } from '../core/types';

export const ELEMENTS: readonly ElementType[] = ['flame', 'tide', 'moss'];

export const ELEMENT_NAME: Record<ElementType, string> = {
  flame: '焰',
  tide: '潮',
  moss: '苔',
};

/**
 * 屬性相剋表（攻擊方 → 防守方 → 倍率）。
 * 焰燒苔、苔吸潮、潮滅焰；被剋 ×0.5，同屬性與其他組合 ×1。
 */
export const TYPE_CHART: Record<ElementType, Record<ElementType, number>> = {
  flame: { flame: 1, tide: 0.5, moss: 2 },
  tide: { flame: 2, tide: 1, moss: 0.5 },
  moss: { flame: 0.5, tide: 2, moss: 1 },
};

export function typeMultiplier(attack: ElementType | null, defend: ElementType): number {
  if (attack === null) return 1;
  return TYPE_CHART[attack][defend];
}
