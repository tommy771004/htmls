// 鍵盤 + 觸控輸入。數位按鍵 → 類比 steer（有爬升，反向時快速回零）。
import { config } from './config.js';
import { clamp } from './shared.js';


const KEY_ACTION = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'crouch', ShiftRight: 'crouch', KeyS: 'crouch', ArrowDown: 'crouch',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
};
const PREVENT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

function isTextTarget(t) {
  if (!t || !t.tagName) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

export class Input {
  constructor(domElement) {
    this.domElement = domElement || null;
    this.C = { ...config.input }; // 預設值唯一來源是 config.js
    this._keys = { left: false, right: false, crouch: false };
    this._touch = { left: false, right: false, crouch: false };
    this._steer = 0;
    this._jump = false;
    this._pause = false;
    this._mute = false;
    this._override = null;
    this._ovJumpLatched = false;
    this._touchCleanup = [];

    this._onKeyDown = (e) => {
      const code = e.code || '';
      const act = KEY_ACTION[code] || (e.key === ' ' ? 'jump' : null);
      if (!act) return;
      if (isTextTarget(e.target)) return;
      if (PREVENT.has(code) || act === 'jump') e.preventDefault();
      if (act === 'jump') { if (!e.repeat) this._jump = true; return; }
      if (act === 'pause') { if (!e.repeat) this._pause = true; return; }
      if (act === 'mute') { if (!e.repeat) this._mute = true; return; }
      this._keys[act] = true;
    };
    this._onKeyUp = (e) => {
      const code = e.code || '';
      const act = KEY_ACTION[code] || (e.key === ' ' ? 'jump' : null);
      if (!act) return;
      if (PREVENT.has(code) || act === 'jump') e.preventDefault();
      if (act in this._keys) this._keys[act] = false;
    };
    this._onBlur = () => this.reset();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown, { passive: false });
      window.addEventListener('keyup', this._onKeyUp, { passive: false });
      window.addEventListener('blur', this._onBlur);
    }
  }

  // 觸控按鈕（HUD 建立後呼叫）。elements: { left, right, jump, boost }
  bindTouch(elements) {
    if (!elements) return;
    const bindHold = (el, key) => {
      if (!el) return;
      const ids = new Set();
      const down = (e) => {
        e.preventDefault();
        ids.add(e.pointerId);
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        this._touch[key] = true;
        el.classList && el.classList.add('active');
      };
      const up = (e) => {
        ids.delete(e.pointerId);
        if (ids.size === 0) {
          this._touch[key] = false;
          el.classList && el.classList.remove('active');
        }
      };
      this._listen(el, 'pointerdown', down);
      this._listen(el, 'pointerup', up);
      this._listen(el, 'pointercancel', up);
      this._listen(el, 'pointerleave', up);
      this._listen(el, 'lostpointercapture', up);
      this._listen(el, 'contextmenu', (e) => e.preventDefault());
      if (el.style) el.style.touchAction = 'none';
    };
    bindHold(elements.left, 'left');
    bindHold(elements.right, 'right');
    bindHold(elements.boost, 'crouch');
    const j = elements.jump;
    if (j) {
      this._listen(j, 'pointerdown', (e) => {
        e.preventDefault();
        this._jump = true;
        j.classList && j.classList.add('active');
      });
      const off = () => j.classList && j.classList.remove('active');
      this._listen(j, 'pointerup', off);
      this._listen(j, 'pointercancel', off);
      this._listen(j, 'pointerleave', off);
      this._listen(j, 'contextmenu', (e) => e.preventDefault());
      if (j.style) j.style.touchAction = 'none';
    }
  }

  _listen(el, type, fn) {
    el.addEventListener(type, fn, { passive: false });
    this._touchCleanup.push(() => el.removeEventListener(type, fn));
  }

  update(dt) {
    const C = this.C;
    const left = this._keys.left || this._touch.left;
    const right = this._keys.right || this._touch.right;
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    let s = this._steer;
    if (target === 0) {
      s = moveToward(s, 0, C.steerReturn * dt);
    } else if (s !== 0 && Math.sign(s) !== target) {
      // 反向：先以回中速率快速過零，剩餘時間再往新方向爬升
      const step = C.steerReturn * dt;
      if (Math.abs(s) > step) s -= Math.sign(s) * step;
      else {
        const rest = dt - Math.abs(s) / C.steerReturn;
        s = target * Math.min(1, C.steerRamp * rest);
      }
    } else {
      s = moveToward(s, target, C.steerRamp * dt);
    }
    this._steer = clamp(s, -1, 1);
  }

  get steer() {
    const o = this._override;
    if (o) return clamp(+o.steer || 0, -1, 1);
    return this._steer;
  }

  get crouch() {
    const o = this._override;
    if (o) return !!o.crouch;
    return this._keys.crouch || this._touch.crouch;
  }

  get jumpPressed() {
    const o = this._override;
    if (o) return !!o.jump && !this._ovJumpLatched;
    return this._jump;
  }

  consumeJump() {
    const o = this._override;
    if (o) {
      this._jump = false;
      const j = !!o.jump;
      if (!j) { this._ovJumpLatched = false; return false; }
      if (this._ovJumpLatched) return false;
      this._ovJumpLatched = true;
      return true;
    }
    const j = this._jump;
    this._jump = false;
    return j;
  }

  get pausePressed() { return this._pause; }
  consumePause() { const p = this._pause; this._pause = false; return p; }

  get mutePressed() { return this._mute; }
  consumeMute() { const m = this._mute; this._mute = false; return m; }

  // bot 用：{ steer, crouch, jump }；null 取消
  setOverride(obj) {
    this._override = obj || null;
    if (!obj) this._ovJumpLatched = false;
  }

  reset() {
    this._keys.left = this._keys.right = this._keys.crouch = false;
    this._touch.left = this._touch.right = this._touch.crouch = false;
    this._steer = 0;
    this._jump = false;
    this._pause = false;
    this._mute = false;
  }

  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('blur', this._onBlur);
    }
    for (const f of this._touchCleanup) f();
    this._touchCleanup.length = 0;
  }
}

function moveToward(v, t, step) {
  if (v < t) return Math.min(t, v + step);
  if (v > t) return Math.max(t, v - step);
  return v;
}
