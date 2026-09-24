// 規則引擎共用型別。這一層不得 import Phaser 或觸碰 DOM。

export type ElementType = 'flame' | 'tide' | 'moss';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type StatKey = 'atk' | 'def' | 'spd';
/** 存檔中可保存的持續性狀態；睡眠只存在於戰鬥中，戰鬥結束時自然清除。 */
export type PersistentStatus = 'none' | 'burn' | 'poison';
export type Status = PersistentStatus | 'sleep';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface Stats extends BaseStats {}

export interface LearnEntry {
  level: number;
  move: string;
}

export interface EvolutionRule {
  /** 升到此等級（含）後，在戰鬥結算時進化。 */
  level: number;
  into: string;
}

export interface SpeciesDef {
  id: string;
  name: string;
  type: ElementType;
  base: BaseStats;
  /** 0–1 的基礎捕捉率，實際機率見 capture.ts。 */
  catchRate: number;
  /** 被擊倒時提供的基礎經驗值。 */
  expYield: number;
  learnset: LearnEntry[];
  evolution?: EvolutionRule;
  /** 素材參照：front / back / icon 三張像素圖的 key。 */
  sprite: { front: string; back: string; icon: string };
  dex: string;
}

export type MoveTarget = 'enemy' | 'self';

export type MoveEffect =
  | { kind: 'status'; status: 'burn' | 'poison' | 'sleep'; chance: number }
  | { kind: 'stage'; who: 'self' | 'target'; stat: StatKey; delta: number; chance: number }
  | { kind: 'drain'; ratio: number }
  | { kind: 'recoil'; ratio: number };

export interface MoveDef {
  id: string;
  name: string;
  /** null 只用於替代招式「拚命」：無屬性、無本系加成。 */
  type: ElementType | null;
  /** 0 表示不造成傷害的變化招式。 */
  power: number;
  /** 1–100；null 表示必中。 */
  accuracy: number | null;
  pp: number;
  priority: number;
  target: MoveTarget;
  effects: MoveEffect[];
  desc: string;
}

export type ItemKind = 'capture' | 'heal' | 'cure';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  price: number;
  /** capture：捕捉倍率；heal：回復 HP 量。 */
  value: number;
  desc: string;
  /** 素材參照：背包小圖示。 */
  sprite: string;
}

export interface MoveSlot {
  id: string;
  pp: number;
}

/** 怪獸個體：同物種的每一隻都有自己的狀態。 */
export interface MonsterInstance {
  uid: string;
  species: string;
  nickname: string;
  level: number;
  exp: number;
  hp: number;
  status: Status;
  /** 剩餘熟睡回合，只在 status === 'sleep' 時有意義。 */
  sleepTurns: number;
  moves: MoveSlot[];
}

export type Bag = Record<string, number>;

export interface Settings {
  sound: boolean;
  reducedMotion: boolean;
  instantText: boolean;
}

export interface Dex {
  seen: string[];
  caught: string[];
}

export interface PlayerPos {
  map: string;
  x: number;
  y: number;
  facing: Dir;
}

/** 可存檔的完整世界進度。 */
export interface Progress {
  player: PlayerPos;
  party: MonsterInstance[];
  box: MonsterInstance[];
  bag: Bag;
  money: number;
  dex: Dex;
  flags: Record<string, boolean>;
  defeated: string[];
  settings: Settings;
  nextUid: number;
  playTimeMs: number;
}
