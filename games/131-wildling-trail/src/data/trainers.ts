export interface TrainerDef {
  id: string;
  name: string;
  party: { species: string; level: number }[];
  reward: number;
  /** 首次勝利時與戰果一起提交的旗標。 */
  winFlags: string[];
}

export const TRAINER_LIST: TrainerDef[] = [
  {
    id: 'ranger',
    name: '守林人・朔',
    party: [
      { species: 'mistsnail', level: 8 },
      { species: 'cinderow', level: 9 },
    ],
    reward: 300,
    winFlags: ['hasPermit'],
  },
  {
    id: 'boss',
    name: '場主・嵐',
    party: [
      { species: 'cinderow', level: 11 },
      { species: 'mistsnail', level: 11 },
      { species: 'verdmoth', level: 13 },
    ],
    reward: 1000,
    winFlags: ['bossDefeated'],
  },
];

export const TRAINERS: Record<string, TrainerDef> = Object.fromEntries(TRAINER_LIST.map((t) => [t.id, t]));

export function getTrainer(id: string): TrainerDef {
  const trainer = TRAINERS[id];
  if (!trainer) throw new Error(`未知訓練家：${id}`);
  return trainer;
}
