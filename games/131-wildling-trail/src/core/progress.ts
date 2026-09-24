import type { Flags } from './world';

/** 所有合法的任務／世界旗標。讀檔時出現其他名稱視為損壞。 */
export const FLAG_NAMES = [
  'gotStarter',
  'firstWildBattle',
  'firstCatch',
  'healedAfterCatch',
  'hasPermit',
  'bossDefeated',
  'clearedShown',
  'item_route_berry',
  'item_forest_fineCage',
  'item_forest_herb',
] as const;

export type FlagName = (typeof FLAG_NAMES)[number];

export interface Objective {
  id: string;
  title: string;
  detail: string;
  /** 目標人物（同一張地圖時畫面會在頭上標示「！」）。 */
  target?: { map: string; entity: string };
}

/** 依旗標推出目前的主線目標；每一步的完成判定都是一個旗標。 */
export function currentObjective(flags: Flags, caughtCount: number, speciesTotal: number): Objective {
  if (!flags.gotStarter) {
    return {
      id: 'starter', title: '和禾老師說話',
      detail: '面向廣場上的禾老師，按 Enter／Z（手機按 Ⓐ）說話，學習操作並選擇第一個夥伴。',
      target: { map: 'village', entity: 'tutor' },
    };
  }
  if (!flags.firstWildBattle) {
    return {
      id: 'grass', title: '探索草地道路',
      detail: '從村子北邊出口前往風草道，走進高草叢，遇見野生怪獸。',
    };
  }
  if (!flags.firstCatch) {
    return {
      id: 'catch', title: '捕捉一隻野生怪獸',
      detail: '戰鬥中選「背包」→「晶籠」。先把對手的 HP 打到黃色或紅色，比較容易成功。',
    };
  }
  if (!flags.healedAfterCatch) {
    return {
      id: 'heal', title: '回村治療與補給',
      detail: '回芽口村找治療所前的蘇護士恢復隊伍，也可以到阿良的攤位買晶籠和莓果露。',
      target: { map: 'village', entity: 'healer' },
    };
  }
  if (!flags.hasPermit) {
    return {
      id: 'trial', title: '通過守林人的試煉',
      detail: '穿過風草道北邊進入霧苔林，在森林北側找到守林人朔並打贏她，取得挑戰許可。',
      target: { map: 'forest', entity: 'ranger' },
    };
  }
  if (!flags.bossDefeated) {
    return {
      id: 'boss', title: '擊敗挑戰場場主',
      detail: '帶著挑戰許可，從霧苔林北邊的石門進入石冠挑戰場，打敗場主嵐。',
      target: { map: 'arena', entity: 'boss' },
    };
  }
  return {
    id: 'free', title: '自由探索',
    detail: `恭喜通關！繼續收集怪獸、完成圖鑑吧（已捕捉 ${caughtCount}／${speciesTotal}）。`,
  };
}

/** 旅行筆記裡的里程碑清單。 */
export const MILESTONES: { flag: FlagName; label: string }[] = [
  { flag: 'gotStarter', label: '選擇第一個夥伴' },
  { flag: 'firstWildBattle', label: '第一次野生遭遇' },
  { flag: 'firstCatch', label: '第一次捕捉成功' },
  { flag: 'healedAfterCatch', label: '回村治療隊伍' },
  { flag: 'hasPermit', label: '取得挑戰許可' },
  { flag: 'bossDefeated', label: '擊敗場主嵐' },
];
