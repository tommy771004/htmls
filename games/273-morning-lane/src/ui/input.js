// 輸入：三個操作——轉向、加速、丟報。鍵盤 ←→／AD、↑／W、空白鍵；觸控是畫面下方四顆按鈕。
// 丟報是「按下那一刻」的事件，固定步長迴圈用 consume() 取走，不會因為一幀跑好幾步而重複丟。
export function makeInput() {
  const keys = new Set();
  const touch = { left: false, right: false, accel: false };
  let throwQueued = false;
  const handlers = {};
  const fire = (n) => (handlers[n] || []).forEach((f) => f());
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') { throwQueued = true; e.preventDefault(); }
    if (e.code === 'KeyC') fire('cam');
    if (e.code === 'KeyR') fire('restart');
    if (e.code === 'KeyV') fire('aim');
    if (e.code === 'KeyM') fire('mute');
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); Object.keys(touch).forEach((k) => (touch[k] = false)); });
  for (const b of document.querySelectorAll('#pad [data-k]')) {
    const k = b.dataset.k;
    const down = (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} b.classList.add('on'); if (k === 'throw') throwQueued = true; else touch[k] = true; };
    const up = (e) => { e.preventDefault(); b.classList.remove('on'); if (k !== 'throw') touch[k] = false; };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }
  function state() {
    const l = keys.has('ArrowLeft') || keys.has('KeyA') || touch.left;
    const r = keys.has('ArrowRight') || keys.has('KeyD') || touch.right;
    return { steer: (r ? 1 : 0) - (l ? 1 : 0), accel: keys.has('ArrowUp') || keys.has('KeyW') || touch.accel };
  }
  return {
    state,
    consume() { const s = state(); s.throw = throwQueued; throwQueued = false; return s; },
    on(n, f) { (handlers[n] ||= []).push(f); },
  };
}
