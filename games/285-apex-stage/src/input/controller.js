// 雙模統一輸入控制層（Gamepad API 即時輪詢 + 鍵盤無縫切換 + 手機觸控支援）
// 偵測到手把或鍵盤任一輸入時自動切換 activeDevice 與 UI 按鍵提示圖示

export class UnifiedInputController {
  constructor(callbacks = {}) {
    this.cb = callbacks; // { onAction(actionName), onDeviceChange(device) }
    this.activeDevice = 'keyboard'; // 'keyboard' | 'gamepad' | 'touch'
    this.mode = 'garage';           // 'garage' | 'driving'

    this.keys = new Set();
    this.touchState = {
      left: false,
      right: false,
      throttle: false,
      brake: false,
      handbrake: false
    };

    // 類比平滑輸出（供物理引擎讀取）
    this.state = {
      steer: 0,      // +1 左轉, -1 右轉
      throttle: 0,   // 0..1
      brake: 0,      // 0..1
      handbrake: false,
      orbitDeltaX: 0,
      orbitDeltaY: 0
    };

    // 手把邊緣觸發狀態記憶
    this.prevPadButtons = new Array(20).fill(false);
    this.stickLatchX = 0;

    // 測試用程式化覆寫輸入（供自動試駕迴圈與驗收腳本使用）
    this.overrideInput = null;

    this._bindEvents();
  }

  setMode(mode) {
    this.mode = mode;
    this.keys.clear();
  }

  _setDevice(dev) {
    if (this.activeDevice !== dev) {
      this.activeDevice = dev;
      if (this.cb.onDeviceChange) this.cb.onDeviceChange(dev);
    }
  }

  _emit(action, payload) {
    if (this.cb.onAction) this.cb.onAction(action, payload);
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      this._setDevice('keyboard');
      if (this.cb.onFirstInteract) this.cb.onFirstInteract();

      const code = e.code;
      const isRepeat = this.keys.has(code);
      this.keys.add(code);

      if (code === 'KeyN' && !isRepeat) {
        e.preventDefault();
        this._emit('mute');
        return;
      }

      if (this.mode === 'garage' && !isRepeat) {
        if (code === 'ArrowLeft' || code === 'KeyA') {
          e.preventDefault();
          this._emit('prevCar');
        } else if (code === 'ArrowRight' || code === 'KeyD') {
          e.preventDefault();
          this._emit('nextCar');
        } else if (code === 'KeyQ') {
          e.preventDefault();
          this._emit('prevClass');
        } else if (code === 'KeyE') {
          e.preventDefault();
          this._emit('nextClass');
        } else if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          this._emit('startDrive');
        } else if (code === 'KeyX' || code === 'KeyP') {
          e.preventDefault();
          this._emit('cyclePaint');
        } else if (code === 'KeyY' || code === 'KeyT') {
          e.preventDefault();
          this._emit('cycleTrack');
        }
      } else if (this.mode === 'driving' && !isRepeat) {
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
          e.preventDefault();
          this._emit('shiftUp');
        } else if (code === 'ControlLeft' || code === 'ControlRight') {
          e.preventDefault();
          this._emit('shiftDown');
        } else if (code === 'KeyM') {
          e.preventDefault();
          this._emit('toggleTransmission');
        } else if (code === 'KeyC') {
          e.preventDefault();
          this._emit('cycleCamera');
        } else if (code === 'KeyR') {
          e.preventDefault();
          this._emit('resetCar');
        } else if (code === 'Escape') {
          e.preventDefault();
          this._emit('returnGarage');
        }
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  /**
   * 每幀輪詢鍵盤、Gamepad API 與觸控狀態
   */
  poll(dt) {
    if (this.overrideInput) {
      this.state.steer = this.overrideInput.steer ?? 0;
      this.state.throttle = this.overrideInput.throttle ?? 0;
      this.state.brake = this.overrideInput.brake ?? 0;
      this.state.handbrake = !!this.overrideInput.handbrake;
      return this.state;
    }

    // 1. 鍵盤與觸控基礎狀態
    const kLeft = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.touchState.left;
    const kRight = this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.touchState.right;
    const kUp = this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touchState.throttle;
    const kDown = this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.touchState.brake;
    const kSpace = this.keys.has('Space') || this.touchState.handbrake;

    let targetSteer = (kLeft ? 1 : 0) - (kRight ? 1 : 0);
    let targetThrottle = kUp ? 1 : 0;
    let targetBrake = kDown ? 1 : 0;
    let targetHandbrake = kSpace;
    let orbitX = 0;

    // 2. Gamepad API 輪詢（支援 Xbox / DualShock / DualSense 標準映射）
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) {
        pad = pads[i];
        break;
      }
    }

    if (pad) {
      const deadzone = 0.08;
      const applyDZ = (v) => (Math.abs(v) < deadzone ? 0 : (v - Math.sign(v) * deadzone) / (1 - deadzone));

      const lx = applyDZ(pad.axes[0] || 0);
      const rx = applyDZ(pad.axes[2] || 0);
      const rt = pad.buttons[7] ? pad.buttons[7].value : 0;
      const lt = pad.buttons[6] ? pad.buttons[6].value : 0;

      const pressed = (idx) => !!(pad.buttons[idx] && pad.buttons[idx].pressed);
      const justPressed = (idx) => pressed(idx) && !this.prevPadButtons[idx];

      // 檢查是否有任何手把活動以自動切換裝置提示
      const anyBtn = pad.buttons.some((b) => b && (b.pressed || b.value > 0.15));
      if (anyBtn || Math.abs(lx) > 0.12 || Math.abs(rx) > 0.12) {
        this._setDevice('gamepad');
        if (this.cb.onFirstInteract) this.cb.onFirstInteract();
      }

      if (this.mode === 'garage') {
        orbitX = rx * 2.4;

        // D-Pad Left (14) / Right (15) 或左搖桿橫撥切換車款
        if (justPressed(14) || (lx < -0.65 && this.stickLatchX >= 0)) {
          this.stickLatchX = -1;
          this._emit('prevCar');
        } else if (justPressed(15) || (lx > 0.65 && this.stickLatchX <= 0)) {
          this.stickLatchX = 1;
          this._emit('nextCar');
        } else if (Math.abs(lx) < 0.3) {
          this.stickLatchX = 0;
        }

        // LB (4) / RB (5) 切換車輛性能等級
        if (justPressed(4)) this._emit('prevClass');
        if (justPressed(5)) this._emit('nextClass');

        // A (0) 確認並進入駕駛
        if (justPressed(0)) this._emit('startDrive');
        // X (2) 快速切換車漆
        if (justPressed(2)) this._emit('cyclePaint');
        // Y (3) 切換賽道與測試場
        if (justPressed(3)) this._emit('cycleTrack');
      } else if (this.mode === 'driving') {
        // 左搖桿漸進式指數曲線轉向（小角度精細、大角度靈敏）
        if (Math.abs(lx) > 0) {
          const curved = Math.sign(-lx) * Math.pow(Math.abs(lx), 1.35);
          targetSteer = curved;
        }
        if (rt > 0.02) targetThrottle = Math.max(targetThrottle, rt);
        if (lt > 0.02) targetBrake = Math.max(targetBrake, lt);
        if (pressed(3)) targetHandbrake = true; // Y 鍵手煞車

        // A (0) 或 X (2) 升檔；B (1) 降檔
        if (justPressed(0) || justPressed(2)) this._emit('shiftUp');
        if (justPressed(1)) this._emit('shiftDown');

        // RB (5) 切換視角；LB (4) 切換自手排；Select/Back (8) 重置；Start (9) 回車庫
        if (justPressed(5)) this._emit('cycleCamera');
        if (justPressed(4)) this._emit('toggleTransmission');
        if (justPressed(8)) this._emit('resetCar');
        if (justPressed(9)) this._emit('returnGarage');
      }

      for (let i = 0; i < 20; i++) {
        this.prevPadButtons[i] = pressed(i);
      }
    }

    // 鍵盤轉向使用平滑步進（模擬類比漸進轉向手感，回正速度更快）
    if (this.activeDevice === 'gamepad') {
      this.state.steer = targetSteer;
    } else {
      const rate = targetSteer === 0 ? 9.5 : 6.2;
      this.state.steer += (targetSteer - this.state.steer) * Math.min(1, rate * dt);
      if (Math.abs(this.state.steer) < 0.01 && targetSteer === 0) this.state.steer = 0;
    }

    this.state.throttle = targetThrottle;
    this.state.brake = targetBrake;
    this.state.handbrake = targetHandbrake;
    this.state.orbitDeltaX = orbitX;

    return this.state;
  }
}
