// 輸入：鍵盤滑鼠、手把（標準配置）與觸控，合成成同一份車輛輸入。
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { l: false, r: false, dx: 0, dy: 0 };
    this.touch = { x: 0, y: 0, jump: false, boost: false, slide: false, active: false };
    this.pad = null;
    this.prevPad = {};
    this.actions = [];           // 'cam' 'pause' 'skip'
    this.look = { x: 0, y: 0 };  // 自由視角的滑鼠／右搖桿輸入
    this.lastDevice = 'kb';
    this.canvas = canvas;
    const down = (e) => {
      if (e.repeat) return;
      // 焦點在暫停選單的滑桿上時，方向鍵交給滑桿調整，不要被遊戲吃掉
      if (e.target && e.target.tagName === 'INPUT' && e.code !== 'Escape' && e.code !== 'KeyP') return;
      const k = e.code;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      this.keys.add(k);
      this.lastDevice = 'kb';
      if (k === 'Space') this.tapJump = true;   // 很短的點按也至少算一個 tick
      if (k === 'KeyY') this.actions.push('cam');
      if (k === 'Escape' || k === 'KeyP') this.actions.push('pause');
      if (k === 'Space' || k === 'Enter') this.actions.push('skip');
    };
    const up = (e) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.l = true;
      if (e.button === 2) { this.mouse.r = true; this.tapJump = true; this.actions.push('skip'); }
      this.lastDevice = 'kb';
      if (this.wantLock && document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* 不支援就算了 */ }
      }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    this.bindTouch();
  }

  bindTouch() {
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let id = null, cx = 0, cy = 0;
    const R = 50;
    stick.addEventListener('pointerdown', (e) => {
      id = e.pointerId; stick.setPointerCapture(id);
      const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      this.touch.x = dx / R; this.touch.y = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.lastDevice = 'touch';
    };
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.touch.x = this.touch.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    const btn = (el, key, action) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.touch[key] = true; if (key === 'jump') this.tapJump = true; el.classList.add('on'); this.lastDevice = 'touch'; if (action) this.actions.push(action); });
      const off = () => { this.touch[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    };
    btn(document.getElementById('tJump'), 'jump', 'skip');
    btn(document.getElementById('tBoost'), 'boost');
    btn(document.getElementById('tSlide'), 'slide');
    document.getElementById('tCam').addEventListener('pointerdown', (e) => { e.preventDefault(); this.actions.push('cam'); });
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected && p.mapping === 'standard') { this.pad = p; break; }
    if (!this.pad) return;
    const b = (i) => !!(this.pad.buttons[i] && this.pad.buttons[i].pressed);
    const edge = (i, a) => { const now = b(i); if (now && !this.prevPad[i]) { this.actions.push(a); this.lastDevice = 'pad'; } this.prevPad[i] = now; };
    edge(3, 'cam'); edge(9, 'pause'); edge(0, 'skip');
    if (this.pad.axes.some((a) => Math.abs(a) > 0.3) || this.pad.buttons.some((x) => x.pressed)) this.lastDevice = 'pad';
  }

  // 合成這一幀的車輛輸入
  read(out, airborne) {
    this.pollPad();
    const k = this.keys;
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
    let throttle = 0, steer = 0, pitch = 0, roll = 0;
    let jump = false, boost = false, slide = false;
    if (k.has('KeyW')) { throttle += 1; pitch -= 1; }
    if (k.has('KeyS')) { throttle -= 1; pitch += 1; }
    if (k.has('KeyA')) steer -= 1;
    if (k.has('KeyD')) steer += 1;
    if (k.has('KeyQ')) roll -= 1;
    if (k.has('KeyE')) roll += 1;
    if (k.has('Space') || this.mouse.r || this.tapJump) jump = true;
    this.tapJump = false;
    if (k.has('ShiftLeft') || k.has('ShiftRight') || this.mouse.l) boost = true;
    if (k.has('KeyC')) slide = true;
    if (this.pad) {
      const a = this.pad.axes, bt = this.pad.buttons;
      const v = (i) => (bt[i] ? bt[i].value : 0);
      const sx = dz(a[0] || 0), sy = dz(a[1] || 0);
      if (sx) steer = sx;
      if (sy) pitch = sy;
      const t = v(7) - v(6);
      if (Math.abs(t) > 0.05) throttle = t;
      if (bt[0] && bt[0].pressed) jump = true;
      if (bt[1] && bt[1].pressed) boost = true;
      if (bt[2] && bt[2].pressed) slide = true;
      if (bt[4] && bt[4].pressed) roll = -1;
      if (bt[5] && bt[5].pressed) roll = 1;
      this.look.x = dz(a[2] || 0); this.look.y = dz(a[3] || 0);
    }
    const t = this.touch;
    if (t.x || t.y) { steer = t.x; pitch = t.y; throttle = -t.y > 0.2 ? 1 : (-t.y < -0.45 ? -1 : (Math.abs(t.x) > 0.2 ? 1 : 0)); }
    if (t.jump) jump = true;
    if (t.boost) boost = true;
    if (t.slide) slide = true;
    // 方向鍵：自由視角
    if (!this.pad || (!this.look.x && !this.look.y)) {
      this.look.x = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
      this.look.y = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
    }
    out.throttle = Math.max(-1, Math.min(1, throttle));
    out.steer = Math.max(-1, Math.min(1, steer));
    out.pitch = Math.max(-1, Math.min(1, pitch));
    // 空中按住甩尾鍵：左右變成滾轉（自由滾轉）
    if (airborne && slide && !roll) { out.yaw = 0; out.roll = out.steer; } else { out.yaw = out.steer; out.roll = roll; }
    out.jump = jump; out.boost = boost; out.slide = slide;
    return out;
  }

  takeMouse() { const d = [this.mouse.dx, this.mouse.dy]; this.mouse.dx = this.mouse.dy = 0; return d; }
  drain() { const a = this.actions; this.actions = []; return a; }
}
