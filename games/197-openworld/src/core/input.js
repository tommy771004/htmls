// 鍵盤／滑鼠狀態。hit() 只在按下的那個 frame 為 true，由 endFrame() 清除。

const BLOCKED = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.buttons = new Set();
    this.clicked = new Set();
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.buttons.clear();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.buttons.add(e.button);
      this.clicked.add(e.button);
    });
    document.addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (!this.locked) {
        this.keys.clear();
        this.buttons.clear();
      }
      this.onLockChange?.(this.locked);
    });
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  lock() {
    if (this.noLock) return; // 自動化測試（?debug）不可搶走使用者的游標
    // 某些瀏覽器在剛解除鎖定後立刻再鎖會 reject，吞掉即可
    this.canvas.requestPointerLock()?.catch?.(() => {});
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }

  down(code) {
    return this.keys.has(code);
  }

  hit(code) {
    return this.pressed.has(code);
  }

  axis(neg, pos) {
    return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
  }

  endFrame() {
    this.pressed.clear();
    this.clicked.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
