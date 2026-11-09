// 鍵鼠輸入。狀態存在預配置欄位，遊戲迴圈只讀不配置。
/** 靈敏度 1.00 倍的弧度／計數。2026-11-08 由 0.0022 調低：800 DPI 約 13 公分轉一圈（原本 9 公分）。 */
export const SENS0 = 0.0015;
export const input = {
  fwd: 0, side: 0, jump: false, crouch: false, walk: false,
  fire: false, alt: false, reload: false, reloadPress: false, use: false,
  firePress: 0, jumpPress: false, // 按下的瞬間（tick 消耗）：同一幀內按下又放開也不會漏掉
  dx: 0, dy: 0, locked: false, sens: SENS0, scopeSens: 1, invertY: false, raw: true,
  slot: 0, nextSlot: 0, // 1..5 按下時的一次性事件
  buy: false, score: false, wheel: 0,
  menu: false, // 主選單開著：Tab、空白鍵、方向鍵留給瀏覽器操作按鈕與滑桿
};
const keys = Object.create(null);

function axes() {
  input.fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  input.side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  input.jump = !!keys.Space;
  input.crouch = !!(keys.ControlLeft || keys.KeyC);
  input.walk = !!keys.ShiftLeft;
  input.use = !!keys.KeyE;
  input.reload = !!keys.KeyR;
  input.score = !!keys.Tab;
}

export function bindInput(canvas, onLockChange) {
  addEventListener('keydown', e => {
    if (!input.menu && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
    if (e.ctrlKey && e.code !== 'ControlLeft') return;
    if (!e.repeat) {
      if (e.code.startsWith('Digit')) { const d = +e.code.slice(5); if (d >= 1 && d <= 5) input.slot = d; }
      if (e.code === 'KeyQ') input.slot = 9;     // 上一把
      if (e.code === 'KeyB') input.buy = true;
      if (e.code === 'KeyG') input.drop = true;
      if (e.code === 'KeyF') input.inspect = true;
      if (e.code === 'KeyR') input.reloadPress = true;   // 按一下比一個 tick 還短也不會漏
      if (e.code === 'Space') input.jumpPress = true;
    }
    keys[e.code] = true; axes();
  });
  addEventListener('keyup', e => { keys[e.code] = false; axes(); });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; axes(); input.fire = input.alt = false; });
  document.addEventListener('mousemove', e => {
    if (!input.locked) return;
    input.dx += e.movementX; input.dy += e.movementY;
  });
  canvas.addEventListener('mousedown', e => {
    if (!input.locked) return;
    if (e.button === 0) { input.fire = true; input.firePress++; }
    if (e.button === 2) input.alt = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; if (e.button === 2) input.alt = false; });
  addEventListener('wheel', e => { input.wheel += Math.sign(e.deltaY); }, { passive: true });
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    onLockChange?.(input.locked);
  });
}

export function lockPointer(canvas) {
  const p = canvas.requestPointerLock?.(input.raw ? { unadjustedMovement: true } : undefined);
  // 部分瀏覽器不支援 unadjustedMovement，退回一般鎖定
  p?.catch?.(() => { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); });
}
