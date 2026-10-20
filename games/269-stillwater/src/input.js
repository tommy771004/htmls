// 輸入：鍵盤（WASD／方向鍵划船、空白鍵拋竿／提竿／按住收線、E 互動、Tab／B 圖鑑、P 暫停、M 靜音、T 切換時段）
// 與觸控（左下虛擬搖桿划船、右下大圓鈕、互動鈕）。按鍵事件以佇列交給遊戲迴圈處理。
export function createInput(els) {
  const keys = new Set();
  const queue = [];
  const st = { joyX: 0, joyY: 0, act: false, touch: false };
  const isTyping = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
    if (e.repeat) { keys.add(k); return; }
    keys.add(k);
    const map = { Space: 'act', Enter: 'enter', KeyE: 'interact', Tab: 'book', KeyB: 'book', KeyP: 'pause', Escape: 'esc', KeyM: 'mute', KeyT: 'time', KeyR: 'release' };
    if (map[k]) queue.push({ type: map[k], down: true });
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'Space') queue.push({ type: 'act', down: false });
  });
  addEventListener('blur', () => { keys.clear(); st.act = false; queue.push({ type: 'act', down: false }); });

  // 觸控搖桿
  const joy = els.joy, knob = els.knob;
  let jid = null, jc = [0, 0];
  const R = 46;
  const jmove = (e) => {
    const dx = e.clientX - jc[0], dy = e.clientY - jc[1], d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    st.joyX = (dx * k) / R; st.joyY = (dy * k) / R;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  joy.addEventListener('pointerdown', (e) => {
    st.touch = true; jid = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch { /* 合成事件沒有真的指標 */ }
    const r = joy.getBoundingClientRect(); jc = [r.left + r.width / 2, r.top + r.height / 2]; jmove(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) jmove(e); });
  const jend = (e) => { if (e.pointerId !== jid) return; jid = null; st.joyX = st.joyY = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  // 大圓鈕：按住＝按住空白鍵
  const btn = els.act;
  btn.addEventListener('pointerdown', (e) => { st.touch = true; try { btn.setPointerCapture(e.pointerId); } catch { /* 同上 */ } st.act = true; queue.push({ type: 'act', down: true }); e.preventDefault(); });
  const bend = () => { if (!st.act) return; st.act = false; queue.push({ type: 'act', down: false }); };
  btn.addEventListener('pointerup', bend); btn.addEventListener('pointercancel', bend);
  btn.addEventListener('keydown', (e) => { if (e.code === 'Enter' && !e.repeat) { st.act = true; queue.push({ type: 'act', down: true }); } });
  btn.addEventListener('keyup', (e) => { if (e.code === 'Enter') bend(); });

  return {
    st,
    push(type) { queue.push({ type, down: true }); },
    drain() { return queue.splice(0, queue.length); },
    held() { return keys.has('Space') || st.act; },
    axes() {
      let fwd = 0, turn = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) turn += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) turn -= 1;
      if (st.joyX || st.joyY) {
        if (st.joyY < -0.35) fwd = 1; else if (st.joyY > 0.45) fwd = -1;
        if (st.joyX < -0.35) turn = 1; else if (st.joyX > 0.35) turn = -1;
      }
      return { fwd, turn };
    },
    clear() { keys.clear(); st.act = false; },
  };
}
