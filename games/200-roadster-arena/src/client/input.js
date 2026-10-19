// 輸入：鍵盤、手把（標準配置）與觸控，合成成同一份車輛輸入。一次性的動作（切鏡頭、吸附、空力、燈、重生、暫停）放進 actions。
const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace']);
const ACTION_KEYS = { KeyV: 'cam', KeyF: 'suction', KeyT: 'aero', KeyL: 'lights', KeyR: 'respawn', Enter: 'respawn', Escape: 'pause', KeyP: 'pause', Tab: 'controls', Backspace: 'restart' };

export class Input {
  constructor() {
    this.keys = new Set();
    this.actions = [];
    this.touch = { x: 0, y: 0, jump: false, boost: false, brake: false, active: false };
    this.pad = null; this.prevPad = {};
    this.device = 'kb';
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (PREVENT.has(e.code) && this.enabled) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.device = 'kb';
      if (e.code === 'Space') this.tapJump = true;
      const a = ACTION_KEYS[e.code];
      if (a) this.actions.push(a);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  // 觸控：左邊搖桿（上＝油門、下＝煞車／倒車、左右＝方向；空中是俯仰與偏航），右邊按鈕
  bindTouch(root) {
    const stick = root.querySelector('#stick'), knob = root.querySelector('#knob');
    let id = null, cx = 0, cy = 0;
    const R = 52;
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      this.touch.x = dx / R; this.touch.y = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener('pointerdown', (e) => {
      id = e.pointerId; stick.setPointerCapture(id);
      const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this.device = 'touch'; this.touch.active = true;
      move(e);
    });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.touch.x = this.touch.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    for (const el of root.querySelectorAll('[data-hold]')) {
      const key = el.dataset.hold;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.touch[key] = true; if (key === 'jump') this.tapJump = true; el.classList.add('on'); this.device = 'touch'; });
      const off = () => { this.touch[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    }
    for (const el of root.querySelectorAll('[data-tap]')) {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.actions.push(el.dataset.tap); });
    }
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected && p.mapping === 'standard') { this.pad = p; break; }
    if (!this.pad) return;
    const b = (i) => !!(this.pad.buttons[i] && this.pad.buttons[i].pressed);
    const edge = (i, a) => { const now = b(i); if (now && !this.prevPad[i]) { this.actions.push(a); this.device = 'pad'; } this.prevPad[i] = now; };
    edge(3, 'cam'); edge(9, 'pause'); edge(8, 'respawn'); edge(12, 'suction'); edge(14, 'aero'); edge(15, 'lights'); edge(0, 'confirm');
    if (this.pad.axes.some((a) => Math.abs(a) > 0.3) || this.pad.buttons.some((x) => x.pressed)) this.device = 'pad';
  }

  read(out) {
    this.pollPad();
    const k = this.keys;
    const dz = (v) => (Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86);
    let throttle = 0, steer = 0, pitch = 0, roll = 0, jump = false, boost = false, hb = false;
    if (k.has('KeyW') || k.has('ArrowUp')) { throttle += 1; pitch -= 1; }
    if (k.has('KeyS') || k.has('ArrowDown')) { throttle -= 1; pitch += 1; }
    if (k.has('KeyA') || k.has('ArrowLeft')) steer -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) steer += 1;
    if (k.has('KeyQ')) roll -= 1;
    if (k.has('KeyE')) roll += 1;
    if (k.has('Space') || this.tapJump) jump = true;
    this.tapJump = false;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) boost = true;
    if (k.has('KeyC') || k.has('KeyX')) hb = true;
    if (this.pad) {
      const a = this.pad.axes, bt = this.pad.buttons, v = (i) => (bt[i] ? bt[i].value : 0);
      const sx = dz(a[0] || 0), sy = dz(a[1] || 0);
      if (sx) steer = sx;
      if (sy) pitch = sy;
      const t = v(7) - v(6);
      if (Math.abs(t) > 0.05) throttle = t;
      if (bt[0]?.pressed) jump = true;
      if (bt[1]?.pressed) boost = true;
      if (bt[2]?.pressed) hb = true;
      if (bt[4]?.pressed) roll = -1;
      if (bt[5]?.pressed) roll = 1;
    }
    const t = this.touch;
    if (t.x || t.y) {
      steer = t.x; pitch = t.y;
      throttle = -t.y > 0.25 ? 1 : (-t.y < -0.5 ? -1 : (Math.abs(t.x) > 0.25 ? 0.8 : 0));
    }
    if (t.jump) jump = true;
    if (t.boost) boost = true;
    if (t.brake) hb = true;
    out.throttle = Math.max(-1, Math.min(1, throttle));
    out.steer = Math.max(-1, Math.min(1, steer));
    out.pitch = Math.max(-1, Math.min(1, pitch));
    out.yaw = out.steer;
    out.roll = roll;
    out.jump = jump; out.boost = boost; out.handbrake = hb;
    return out;
  }

  drain() { const a = this.actions; this.actions = []; return a; }
}
