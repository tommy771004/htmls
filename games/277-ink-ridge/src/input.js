// 輸入：鍵盤、滑鼠（點畫面鎖定指標）、觸控（左下搖桿、右下按鈕、右半邊拖曳轉鏡頭）。
// 測試可用 override 直接塞輸入。
export function makeInput(canvas, pad) {
  const keys = new Set();
  const st = { mx: 0, my: 0, lookX: 0, lookY: 0, jump: false, jumpHeld: false, strike: false, pause: false, lastLook: -99, touch: false };
  let override = null;
  const isTyping = (e) => /input|textarea/i.test(e.target.tagName);
  addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const k = e.code;
    if (!keys.has(k)) {
      if (k === 'Space') st.jump = true;
      if (k === 'KeyJ' || k === 'KeyK') st.strike = true;
      if (k === 'Escape' || k === 'KeyP') st.pause = true;
    }
    keys.add(k);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // 滑鼠：點畫面鎖定指標；鎖定時移動轉鏡頭、左鍵出手。沒鎖定時左鍵拖曳也能轉
  let drag = null;
  canvas.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement === canvas) { if (e.button === 0) st.strike = true; return; }
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
  });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { st.lookX += e.movementX; st.lookY += e.movementY; st.lastLook = performance.now(); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); st.lookX += dx; st.lookY += dy; st.lastLook = performance.now(); }
  });
  addEventListener('mouseup', () => {
    if (drag && drag.moved < 4 && st.allowLock && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* 不支援就算了 */ } }
    drag = null;
  });

  // 觸控
  const stick = pad.querySelector('#stick'), knob = pad.querySelector('#knob');
  let stickId = null, sx = 0, sy = 0, lookId = null, lx = 0, ly = 0;
  const R = 52;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
  stick.addEventListener('pointerdown', (e) => {
    st.touch = true; stickId = e.pointerId; const b = stick.getBoundingClientRect(); sx = b.left + b.width / 2; sy = b.top + b.height / 2;
    try { stick.setPointerCapture(e.pointerId); } catch { /* 合成事件沒有可捕捉的指標 */ } moveStick(e); e.preventDefault();
  });
  const moveStick = (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    setKnob(dx, dy); st.tmx = dx / R; st.tmy = -dy / R;
  };
  stick.addEventListener('pointermove', moveStick);
  const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; st.tmx = st.tmy = 0; setKnob(0, 0); };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
  for (const b of pad.querySelectorAll('[data-k]')) {
    b.addEventListener('pointerdown', (e) => {
      st.touch = true; e.preventDefault(); b.classList.add('on');
      if (b.dataset.k === 'jump') { st.jump = true; st.tJumpHeld = true; }
      if (b.dataset.k === 'strike') st.strike = true;
    });
    const up = () => { b.classList.remove('on'); if (b.dataset.k === 'jump') st.tJumpHeld = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    st.touch = true; lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    st.lookX += (e.clientX - lx) * 1.4; st.lookY += (e.clientY - ly) * 1.4; lx = e.clientX; ly = e.clientY; st.lastLook = performance.now();
  });
  const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
  addEventListener('pointerup', endLook); addEventListener('pointercancel', endLook);

  return {
    st,
    setOverride(o) { override = o; },
    /** 每個模擬步讀一次；邊緣觸發的鍵讀完就清掉 */
    read() {
      if (override) {
        const o = { mx: override.mx || 0, my: override.my || 0, jump: !!override.jump, jumpHeld: !!(override.jumpHeld ?? override.jump), strike: !!override.strike };
        override.jump = false; override.strike = false;
        return o;
      }
      let mx = 0, my = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my -= 1;
      if (st.tmx || st.tmy) { mx = st.tmx; my = st.tmy; }
      const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      const o = { mx, my, jump: st.jump, jumpHeld: keys.has('Space') || !!st.tJumpHeld, strike: st.strike };
      st.jump = false; st.strike = false;
      return o;
    },
    takeLook() { const x = st.lookX, y = st.lookY; st.lookX = st.lookY = 0; return [x, y]; },
    takePause() { const p = st.pause; st.pause = false; return p; },
    clear() { keys.clear(); st.jump = st.strike = st.pause = false; st.tmx = st.tmy = 0; setKnob(0, 0); },
  };
}
