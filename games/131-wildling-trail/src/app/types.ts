// 應用層（遊戲流程與介面狀態）的共用型別。這一層也不碰 Phaser 或 DOM，
// 畫面層只讀取這裡產生的 view model，並把輸入轉成 Button 送進來。

import type { AnimCue, Snapshot } from '../core/battle';
import type { GrowthCue } from '../core/growth';
import type { Dir } from '../core/types';

export type Button = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'menu';

/** 同一時間只有一個模式能接收輸入。 */
export type Mode = 'title' | 'explore' | 'dialog' | 'menu' | 'transition' | 'battle' | 'result' | 'cleared';

export type Sfx =
  | 'cursor'
  | 'confirm'
  | 'cancel'
  | 'error'
  | 'bump'
  | 'step'
  | 'talk'
  | 'buy'
  | 'heal'
  | 'save'
  | 'pickup'
  | 'encounter'
  | 'levelup'
  | 'evolve'
  | 'clear';

/** 畫面層要播放的一次性回饋。 */
export type Effect =
  | { kind: 'sfx'; id: Sfx }
  | { kind: 'step'; from: { x: number; y: number }; to: { x: number; y: number }; dir: Dir }
  | { kind: 'turn'; dir: Dir }
  | { kind: 'bump'; dir: Dir }
  | { kind: 'mapChanged'; map: string }
  | { kind: 'healParty' }
  | { kind: 'saved'; ok: boolean };

export type TransitionKind = 'warp' | 'battleIn' | 'battleOut' | 'whiteout' | 'enterWorld';

export interface ListRow {
  label: string;
  right?: string;
  sub?: string;
  /** 素材 key（怪獸小圖示或道具圖示）。 */
  icon?: string;
  disabled?: boolean;
  hp?: [number, number];
  tone?: 'ok' | 'warn' | 'bad' | 'muted' | 'accent';
}

export interface DetailVM {
  title?: string;
  sprite?: string;
  lines: string[];
}

export interface QtyVM {
  value: number;
  max: number;
  price: number;
  total: number;
  balance: number;
}

export interface PanelVM {
  kind: string;
  title: string;
  rows: ListRow[];
  cursor: number;
  detail?: DetailVM;
  hint?: string;
  qty?: QtyVM;
  layout?: 'list' | 'starter';
}

export interface DialogVM {
  speaker?: string;
  text: string;
  /** 本行的唯一序號；畫面層用來判斷是否需要重新打字。 */
  serial: number;
  choice?: { options: string[]; cursor: number };
  more: boolean;
}

export interface BattleVM {
  kind: 'wild' | 'trainer';
  bg: string;
  trainerName: string;
  snap: Snapshot;
  /** 目前顯示的訊息（事件或提示）。 */
  text: string;
  serial: number;
  cues: AnimCue[];
  phase: 'events' | 'command' | 'panel';
  commands?: { labels: string[]; cursor: number };
  panel?: PanelVM;
  turn: number;
}

export interface ResultVM {
  text: string;
  serial: number;
  cue?: GrowthCue;
  bg: string;
  panel?: PanelVM;
  /** 進化或升級時要顯示的怪獸。 */
  focus?: { species: string; uid: string };
}

export interface ClearedVM {
  playTime: string;
  caught: number;
  seen: number;
  total: number;
  party: { name: string; species: string; level: number }[];
}
