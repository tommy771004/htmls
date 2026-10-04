// 鍵盤滑鼠（pointer lock）與手機觸控，轉成共用的按鍵位元。
import { BITS } from '../core/rules.js';

export function makeInput(canvas) {
  const I = {
    keys: new Set(), mouse: 0, dx: 0, dy: 0, wheel: 0, locked: false, crouchToggle: false, adsToggle: false,
    pulses: 0, touch: false, touchMove: [0, 0], touchFire: false, touchAds: false, sens: 1, onKey: null, enabled: false,
  };
  const pulse = (b) => { I.pulses |= b; };
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    if (!I.enabled) return;
    if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) { if (I.keys.has(e.code)) return; }
    I.keys.add(e.code);
    if (e.code === 'KeyC' || e.code === 'ControlLeft') I.crouchToggle = !I.crouchToggle;
    if (e.code === 'Digit1') pulse(BITS.SLOT1);
    if (e.code === 'Digit2') pulse(BITS.SLOT2);
    if (e.code === 'KeyQ') pulse(BITS.SWAP);
    I.onKey?.(e.code, true);
  });
  addEventListener('keyup', (e) => { I.keys.delete(e.code); I.onKey?.(e.code, false); });
  addEventListener('blur', () => { I.keys.clear(); I.mouse = 0; });
  canvas.addEventListener('mousedown', (e) => {
    if (!I.enabled) return;
    if (!I.locked && !I.touch) { try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch { /* 不支援 */ } }
    I.mouse |= 1 << e.button;
  });
  addEventListener('mouseup', (e) => { I.mouse &= ~(1 << e.button); });
  addEventListener('contextmenu', (e) => { if (I.enabled) e.preventDefault(); });
  addEventListener('mousemove', (e) => { if (I.locked) { I.dx += e.movementX; I.dy += e.movementY; } });
  addEventListener('wheel', (e) => { if (I.locked && Math.abs(e.deltaY) > 2) pulse(BITS.SWAP); }, { passive: true });
  document.addEventListener('pointerlockchange', () => { I.locked = document.pointerLockElement === canvas; I.onLock?.(I.locked); });

  I.bits = () => {
    const k = I.keys;
    let b = 0;
    const tm = I.touchMove;
    if (k.has('KeyW') || k.has('ArrowUp') || tm[1] < -0.35) b |= BITS.FWD;
    if (k.has('KeyS') || k.has('ArrowDown') || tm[1] > 0.35) b |= BITS.BACK;
    if (k.has('KeyA') || k.has('ArrowLeft') || tm[0] < -0.35) b |= BITS.LEFT;
    if (k.has('KeyD') || k.has('ArrowRight') || tm[0] > 0.35) b |= BITS.RIGHT;
    if (k.has('Space') || I.touchJump) b |= BITS.JUMP;
    if (k.has('ShiftLeft') || k.has('ShiftRight') || (I.touch && tm[1] < -0.92)) b |= BITS.SPRINT;
    if (I.crouchToggle) b |= BITS.CROUCH;
    if (I.mouse & 1 || I.touchFire) b |= BITS.FIRE;
    if (I.mouse & 4 || I.touchAds) b |= BITS.ADS;
    if (k.has('KeyR') || I.touchReload) b |= BITS.RELOAD;
    if (k.has('KeyE') || I.touchUse) b |= BITS.USE;
    if (k.has('KeyF') || k.has('Digit4') || I.touchPlate) b |= BITS.PLATE;
    b |= I.pulses;
    return b;
  };
  I.consumePulses = () => { I.pulses = 0; };
  I.takeMouse = () => { const d = [I.dx, I.dy]; I.dx = 0; I.dy = 0; return d; };

  // ---- 觸控 ----
  I.setupTouch = (root) => {
    I.touch = true;
    root.innerHTML = `<div class="stick" id="tStick"><i></i></div>
      <button class="tb fire" id="tFire" style="right:28px;bottom:120px">射擊</button>
      <button class="tb" id="tAds" style="right:120px;bottom:150px">開鏡</button>
      <button class="tb" id="tJump" style="right:28px;bottom:36px">跳</button>
      <button class="tb" id="tCrouch" style="right:100px;bottom:36px">蹲</button>
      <button class="tb" id="tReload" style="right:172px;bottom:36px">換彈</button>
      <button class="tb" id="tUse" style="right:120px;bottom:230px">撿</button>
      <button class="tb" id="tPlate" style="right:196px;bottom:110px">上甲</button>
      <button class="tb" id="tSwap" style="right:28px;bottom:220px">換槍</button>
      <button class="tb menu" id="tMenu">選單</button>`;
    const stick = root.querySelector('#tStick'), knob = stick.firstElementChild;
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sid = t.identifier; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
    const moveStick = (t) => { const dx = (t.clientX - sx) / 55, dy = (t.clientY - sy) / 55; const l = Math.hypot(dx, dy) || 1, k = Math.min(1, l); I.touchMove = [dx / l * k, dy / l * k]; knob.style.transform = `translate(${I.touchMove[0] * 40}px,${I.touchMove[1] * 40}px)`; };
    // 右半螢幕拖曳轉視角
    let lid = null, lx = 0, ly = 0;
    addEventListener('touchstart', (e) => {
      if (!I.enabled) return;
      for (const t of e.changedTouches) if (t.target === canvas || t.target === root) { if (t.clientX > innerWidth * 0.4 && lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; } }
    }, { passive: true });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) moveStick(t);
        if (t.identifier === lid) { I.dx += (t.clientX - lx) * 2.2; I.dy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; }
      }
    }, { passive: true });
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; I.touchMove = [0, 0]; knob.style.transform = ''; } if (t.identifier === lid) lid = null; } };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    const hold = (id, key) => { const el = root.querySelector(id); el.addEventListener('touchstart', (e) => { e.preventDefault(); I[key] = true; el.classList.add('on'); }, { passive: false }); el.addEventListener('touchend', () => { I[key] = false; el.classList.remove('on'); }); };
    hold('#tFire', 'touchFire'); hold('#tJump', 'touchJump'); hold('#tReload', 'touchReload'); hold('#tUse', 'touchUse'); hold('#tPlate', 'touchPlate');
    const tog = (id, fn) => { const el = root.querySelector(id); el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.toggle('on', fn()); }, { passive: false }); };
    tog('#tAds', () => (I.touchAds = !I.touchAds));
    tog('#tCrouch', () => (I.crouchToggle = !I.crouchToggle));
    root.querySelector('#tSwap').addEventListener('touchstart', (e) => { e.preventDefault(); pulse(BITS.SWAP); }, { passive: false });
    root.querySelector('#tMenu').addEventListener('click', () => I.onKey?.('Escape', true));
  };
  return I;
}
