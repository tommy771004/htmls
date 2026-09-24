import type { Button, DialogVM } from './types';

export interface DialogLine {
  speaker?: string;
  text: string;
}

export interface DialogChoice {
  options: string[];
  /** 按取消時視為選了哪一項；省略代表取消無效，必須明確選擇。 */
  cancelIndex?: number;
  onPick: (index: number) => void;
}

let serialCounter = 0;

/**
 * 一段對話：逐行前進，最後一行可以附帶選項。
 * 結束（或選完）時只會呼叫一次回呼，連按確認不會重複觸發。
 */
export class Dialog {
  private index = 0;
  private cursor = 0;
  private done = false;
  private serials: number[];

  constructor(
    readonly lines: DialogLine[],
    private readonly choice?: DialogChoice,
    private readonly onClose?: () => void,
  ) {
    if (lines.length === 0) throw new Error('對話至少要有一行');
    this.serials = lines.map(() => ++serialCounter);
  }

  get finished(): boolean {
    return this.done;
  }

  private get onLast(): boolean {
    return this.index === this.lines.length - 1;
  }

  /** 回傳 true 表示這個輸入被處理（有反應）。 */
  press(button: Button, onFinish: () => void): 'advance' | 'cursor' | 'pick' | 'close' | 'none' {
    if (this.done) return 'none';
    const choosing = this.onLast && this.choice;
    if (choosing) {
      const n = this.choice!.options.length;
      if (button === 'up' || button === 'left') {
        this.cursor = (this.cursor + n - 1) % n;
        return 'cursor';
      }
      if (button === 'down' || button === 'right') {
        this.cursor = (this.cursor + 1) % n;
        return 'cursor';
      }
      let pick: number | null = null;
      if (button === 'confirm') pick = this.cursor;
      else if ((button === 'cancel' || button === 'menu') && this.choice!.cancelIndex !== undefined) pick = this.choice!.cancelIndex;
      if (pick === null) return 'none';
      this.done = true;
      onFinish();
      this.choice!.onPick(pick);
      return 'pick';
    }
    if (button !== 'confirm' && button !== 'cancel') return 'none';
    if (!this.onLast) {
      this.index++;
      return 'advance';
    }
    this.done = true;
    onFinish();
    this.onClose?.();
    return 'close';
  }

  /** 指標直接點選項目。 */
  pick(index: number, onFinish: () => void): boolean {
    if (this.done || !this.onLast || !this.choice) return false;
    if (index < 0 || index >= this.choice.options.length) return false;
    this.cursor = index;
    return this.press('confirm', onFinish) === 'pick';
  }

  vm(): DialogVM {
    const line = this.lines[this.index];
    return {
      speaker: line.speaker,
      text: line.text,
      serial: this.serials[this.index],
      choice: this.onLast && this.choice ? { options: this.choice.options, cursor: this.cursor } : undefined,
      more: !this.onLast,
    };
  }
}
