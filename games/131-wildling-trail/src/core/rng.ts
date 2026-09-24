// 所有亂數都經過這個介面，測試時注入固定種子即可重現整場遊戲。

export interface Rng {
  /** [0, 1) 的浮點數。 */
  next(): number;
  /** [min, max] 的整數（含兩端）。 */
  int(min: number, max: number): number;
  /** 以 probability（0–1）判定成功。 */
  chance(probability: number): boolean;
  /** 依權重挑一個元素。 */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  /** 目前內部狀態，可存下來稍後以 createRng(state) 接續。 */
  state(): number;
}

/** mulberry32：32 位元狀態、足夠均勻，且每一步都可重現。 */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int(min, max) {
      if (max < min) throw new RangeError(`int(${min}, ${max})`);
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(probability) {
      if (probability >= 1) return true;
      if (probability <= 0) return false;
      return next() < probability;
    },
    weighted(items, weight) {
      if (items.length === 0) throw new RangeError('weighted() on empty list');
      const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
      if (total <= 0) return items[0];
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, weight(item));
        if (roll < 0) return item;
      }
      return items[items.length - 1];
    },
    state: () => s,
  };
  return rng;
}

/** 依序回傳指定數值的假亂數，只給單元測試逼出特定分支用。 */
export function scriptedRng(values: number[], fallback = 0.5): Rng {
  let i = 0;
  const next = () => (i < values.length ? values[i++] : fallback);
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => (p >= 1 ? true : p <= 0 ? false : next() < p),
    weighted(items, weight) {
      const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, weight(item));
        if (roll < 0) return item;
      }
      return items[items.length - 1];
    },
    state: () => i,
  };
}
