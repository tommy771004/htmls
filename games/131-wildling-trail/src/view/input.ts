// 輸入層：鍵盤與觸控都轉成抽象按鍵。方向鍵可按住連續移動；
// 確認與取消忽略鍵盤自動重複，避免按住時連續觸發。

import type { Button } from '../app/types';

const KEYMAP: Record<string, Button> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  KeyZ: 'confirm',
  Space: 'confirm',
  Escape: 'cancel',
  KeyX: 'cancel',
  Backspace: 'cancel',
};

export type DirButton = 'up' | 'down' | 'left' | 'right';
const DIR_BUTTONS: DirButton[] = ['up', 'down', 'left', 'right'];

export class Input {
  /** 目前按住的方向（最後按下的優先）。 */
  private held: DirButton[] = [];
  private onPress: (b: Button) => void = () => undefined;
  private onFirstGesture: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {}

  attach(onPress: (b: Button) => void, onFirstGesture: () => void): void {
    this.onPress = onPress;
    this.onFirstGesture = onFirstGesture;
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', () => (this.held = []));
    this.bindPad();
  }

  get heldDir(): DirButton | null {
    return this.held[this.held.length - 1] ?? null;
  }

  private gesture(): void {
    if (this.onFirstGesture) {
      const fn = this.onFirstGesture;
      this.onFirstGesture = null;
      fn();
    }
  }

  private keydown = (e: KeyboardEvent): void => {
    const b = KEYMAP[e.code];
    if (!b) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    this.gesture();
    if ((DIR_BUTTONS as string[]).includes(b)) {
      const d = b as DirButton;
      if (!this.held.includes(d)) this.held.push(d);
      if (e.repeat) return;
      this.onPress(d);
      return;
    }
    if (e.repeat) return;
    this.onPress(b);
  };

  private keyup = (e: KeyboardEvent): void => {
    const b = KEYMAP[e.code];
    if (!b) return;
    this.held = this.held.filter((d) => d !== b);
  };

  /** 觸控按鈕：data-btn 屬性對應 Button；方向鍵按住會持續移動。 */
  private bindPad(): void {
    const buttons = this.root.querySelectorAll<HTMLElement>('[data-btn]');
    for (const el of buttons) {
      const b = el.dataset.btn as Button;
      const isDir = (DIR_BUTTONS as string[]).includes(b);
      const release = () => {
        el.classList.remove('down');
        if (isDir) this.held = this.held.filter((d) => d !== b);
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('down');
        this.gesture();
        if (isDir && !this.held.includes(b as DirButton)) this.held.push(b as DirButton);
        this.onPress(b);
      });
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
}
