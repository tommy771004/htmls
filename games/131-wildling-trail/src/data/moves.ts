import type { MoveDef } from '../core/types';

/** 十二個可學習的招式。 */
export const MOVE_LIST: MoveDef[] = [
  {
    id: 'spark', name: '火花', type: 'flame', power: 40, accuracy: 100, pp: 25, priority: 0, target: 'enemy',
    effects: [{ kind: 'status', status: 'burn', chance: 0.1 }],
    desc: '噴出小火星攻擊，10% 使對手灼傷。',
  },
  {
    id: 'scorch', name: '灼息', type: 'flame', power: 0, accuracy: 85, pp: 15, priority: 0, target: 'enemy',
    effects: [{ kind: 'status', status: 'burn', chance: 1 }],
    desc: '吹出滾燙氣息，使對手灼傷。',
  },
  {
    id: 'warmup', name: '熱身', type: 'flame', power: 0, accuracy: null, pp: 20, priority: 0, target: 'self',
    effects: [{ kind: 'stage', who: 'self', stat: 'atk', delta: 1, chance: 1 }],
    desc: '活動筋骨，自己的攻擊提高 1 級。',
  },
  {
    id: 'blaze', name: '爆燃', type: 'flame', power: 80, accuracy: 85, pp: 8, priority: 0, target: 'enemy',
    effects: [],
    desc: '全身燃起烈焰衝撞，威力強但不易命中。',
  },
  {
    id: 'bubble', name: '水泡', type: 'tide', power: 40, accuracy: 100, pp: 25, priority: 0, target: 'enemy',
    effects: [{ kind: 'stage', who: 'target', stat: 'spd', delta: -1, chance: 0.2 }],
    desc: '吐出一串水泡，20% 使對手速度降低 1 級。',
  },
  {
    id: 'jet', name: '疾流', type: 'tide', power: 30, accuracy: 100, pp: 20, priority: 1, target: 'enemy',
    effects: [],
    desc: '射出細水柱，優先度 +1，必定比一般招式先出手。',
  },
  {
    id: 'lull', name: '眠泡', type: 'tide', power: 0, accuracy: 65, pp: 10, priority: 0, target: 'enemy',
    effects: [{ kind: 'status', status: 'sleep', chance: 1 }],
    desc: '溫熱的泡泡讓對手睡著 1–3 回合。',
  },
  {
    id: 'surge', name: '潮湧', type: 'tide', power: 75, accuracy: 90, pp: 10, priority: 0, target: 'enemy',
    effects: [],
    desc: '召來一道浪頭沖向對手。',
  },
  {
    id: 'vine', name: '藤鞭', type: 'moss', power: 40, accuracy: 100, pp: 25, priority: 0, target: 'enemy',
    effects: [],
    desc: '甩出細藤抽打對手。',
  },
  {
    id: 'spore', name: '孢子粉', type: 'moss', power: 0, accuracy: 90, pp: 15, priority: 0, target: 'enemy',
    effects: [{ kind: 'status', status: 'poison', chance: 1 }],
    desc: '撒出孢子，使對手中毒。',
  },
  {
    id: 'leech', name: '吸取', type: 'moss', power: 40, accuracy: 100, pp: 15, priority: 0, target: 'enemy',
    effects: [{ kind: 'drain', ratio: 0.5 }],
    desc: '吸走養分，回復造成傷害的一半。',
  },
  {
    id: 'gale', name: '葉旋', type: 'moss', power: 70, accuracy: 95, pp: 10, priority: 0, target: 'enemy',
    effects: [{ kind: 'stage', who: 'target', stat: 'atk', delta: -1, chance: 0.3 }],
    desc: '捲起葉片旋風，30% 使對手攻擊降低 1 級。',
  },
];

/**
 * 替代招式：所有招式使用次數耗盡時使用，不在學習表中、不消耗次數。
 * 無屬性、必中，使用者承受造成傷害 1/4 的反作用（至少 1）。
 */
export const STRUGGLE: MoveDef = {
  id: 'struggle', name: '拚命', type: null, power: 40, accuracy: null, pp: 0, priority: 0, target: 'enemy',
  effects: [{ kind: 'recoil', ratio: 0.25 }],
  desc: '招式用盡時的最後手段，會受到反作用傷害。',
};

export const MOVES: Record<string, MoveDef> = Object.fromEntries(
  [...MOVE_LIST, STRUGGLE].map((m) => [m.id, m]),
);

export function getMove(id: string): MoveDef {
  const move = MOVES[id];
  if (!move) throw new Error(`未知招式：${id}`);
  return move;
}
