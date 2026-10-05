// 輸入：鍵盤（WASD／方向鍵、空白、E、B、C、P、M、Esc、Enter）、滑鼠左鍵、觸控搖桿與圓鈕（Pointer Events）。
// 焦點在卡片（選單、魚簍、暫停、結算）裡的按鈕上時，空白鍵交給按鈕本身；焦點在大圓鈕上按 Enter 等於按住大圓鈕。
const cardButton = () => { const a = document.activeElement; const c = a && a.tagName === 'BUTTON' && a.closest('.card'); return !!c && !c.classList.contains('hidden'); };
const focusedId = () => (document.activeElement && document.activeElement.id) || '';
export class Input {
  constructor(canvas, handlers) {
    this.keys = new Set();
    this.touch = { x: 0, y: 0 };
    this.h = handlers;
    this.actionHeld = false;
    const isMove = (c) => ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c);
    addEventListener('keydown', (e) => {
      this.h.gesture();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isMove(e.code)) { this.keys.add(e.code); e.preventDefault(); return; }
      if (e.code === 'Space') { if (cardButton()) return; e.preventDefault(); if (!e.repeat) this.down('key'); return; }
      const enter = e.code === 'Enter' || e.code === 'NumpadEnter';
      if (enter && focusedId() === 'btnMain') { e.preventDefault(); if (!e.repeat) this.down('enter'); return; }
      if (e.repeat) return;
      if (enter && focusedId() === 'btnStow') { e.preventDefault(); this.h.stow(); return; }
      if (e.code === 'KeyE') this.h.stow();
      else if (e.code === 'KeyB') this.h.bait();
      else if (e.code === 'KeyC') this.h.creel();
      else if (e.code === 'KeyP') this.h.pause();
      else if (e.code === 'KeyM') this.h.mute();
      else if (e.code === 'Escape') this.h.escape();
      else if (enter && !cardButton()) this.h.enter();
    });
    addEventListener('keyup', (e) => {
      if (isMove(e.code)) this.keys.delete(e.code);
      if (e.code === 'Space' && this.src.has('key')) { e.preventDefault(); this.up('key'); }
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && this.src.has('enter')) { e.preventDefault(); this.up('enter'); }
    });
    addEventListener('blur', () => { this.keys.clear(); this.up('all'); });
    canvas.addEventListener('pointerdown', (e) => {
      this.h.gesture();
      if (e.pointerType === 'mouse' && e.button === 0) { this.down('mouse'); }
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.up('mouse'); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.src = new Set();
  }
  down(src) {
    this.src.add(src);
    if (!this.actionHeld) { this.actionHeld = true; this.h.actionDown(); }
  }
  up(src) {
    if (src === 'all') this.src.clear(); else this.src.delete(src);
    if (this.actionHeld && !this.src.size) { this.actionHeld = false; this.h.actionUp(); }
  }
  bindButton(el, onDown, onUp) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.h.gesture(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch { /* 合成事件沒有指標可捕捉 */ } onDown(); });
    const end = (e) => { if (!el.classList.contains('down')) return; e.preventDefault(); el.classList.remove('down'); onUp(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  bindStick(el, knob) {
    let id = null;
    const set = (e) => {
      const r = el.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.4), y = (e.clientY - (r.top + r.height / 2)) / (r.height * 0.4);
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      this.touch.x = x; this.touch.y = y;
      knob.style.transform = `translate(${(x * r.width * 0.32).toFixed(0)}px, ${(y * r.height * 0.32).toFixed(0)}px)`;
    };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.h.gesture(); id = e.pointerId; try { el.setPointerCapture(id); } catch { /* 合成事件 */ } set(e); });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.touch.x = 0; this.touch.y = 0; knob.style.transform = ''; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  // 螢幕方向的移動向量：x 右、y 下（鏡頭朝 −Z，所以 y 下＝+Z）
  move() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    if (Math.hypot(this.touch.x, this.touch.y) > 0.12) { x = this.touch.x; y = this.touch.y; }
    return { x, y };
  }
}
