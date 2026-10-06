// 選單導覽：鍵盤／手把（input.onMenu）與滑鼠／觸控共用。
// 目前畫面的根元素內所有 [data-nav] 可聚焦；上下左右用空間最近鄰，左右在滑桿／分段鈕上改值。

const ACT_GAP = 260; // 同一元素兩次啟動的最短間隔（原生 Enter click 與 onMenu confirm 去重）

export function createNav() {
  let scope = null; // { root, onBack, onMenu }
  let cur = null;
  const lastAct = new WeakMap();

  function items() {
    if (!scope) return [];
    return [...scope.root.querySelectorAll('[data-nav]')].filter((el) => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length > 0);
  }

  function focus(el, fromPointer = false, noScroll = false) {
    if (cur && cur !== el) cur.classList.remove('is-focus');
    cur = el || null;
    if (!cur) return;
    cur.classList.add('is-focus');
    if (!fromPointer && document.activeElement !== cur) {
      try { cur.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
    }
    if (!fromPointer && !noScroll && cur.scrollIntoView) {
      const r = cur.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) cur.scrollIntoView({ block: 'nearest' });
    }
  }

  // 空間導覽：往 dir 方向找中心最近、夾角最小的元素
  function move(dir) {
    const list = items();
    if (!list.length) return;
    if (!cur || !list.includes(cur)) { focus(list[0]); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bs = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      const dx = b.left + b.width / 2 - ax;
      const dy = b.top + b.height / 2 - ay;
      let along;
      let across;
      if (dir === 'up') { along = -dy; across = dx; }
      else if (dir === 'down') { along = dy; across = dx; }
      else if (dir === 'left') { along = -dx; across = dy; }
      else { along = dx; across = dy; }
      if (along <= 4) continue;
      const score = along + Math.abs(across) * 2.2;
      if (score < bs) { bs = score; best = el; }
    }
    if (best) focus(best);
    else if (dir === 'up' || dir === 'down') {
      // 到底就繞回（直列選單比較好用）
      const i = list.indexOf(cur);
      focus(list[dir === 'down' ? (i + 1) % list.length : (i - 1 + list.length) % list.length]);
    }
  }

  function adjust(el, d) {
    if (el.navAdjust) { el.navAdjust(d); return true; }
    return false;
  }

  // 由 input.onMenu 呼叫
  function handle(type) {
    if (!scope) return false;
    if (scope.onMenu && scope.onMenu(type) === true) return true;
    switch (type) {
      case 'up': case 'down':
        move(type);
        return true;
      case 'left': case 'right':
        if (cur && adjust(cur, type === 'left' ? -1 : 1)) return true;
        move(type);
        return true;
      case 'confirm':
        if (!cur || !items().includes(cur)) { move('down'); return true; }
        cur.click();
        return true;
      case 'back':
        if (scope.onBack) { scope.onBack(); return true; }
        return false;
      default:
        return false;
    }
  }

  // Enter 交給 onMenu 的 confirm 處理，擋掉按鈕的原生啟動（否則換畫面後同一次按鍵會再按到新畫面的按鈕）
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.code === 'NumpadEnter') && e.target && e.target.closest && e.target.closest('[data-nav]')) e.preventDefault();
  }, true);

  // 同一元素短時間內只啟動一次（Enter 的原生 click 與 onMenu confirm 會同時到）
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest && e.target.closest('[data-nav]');
    if (!el) return;
    // 雙擊的第二下：按鈕常在第一下時被重建（車庫購買後 render()），lastAct 認不得新元素 → 會買兩次或點穿到新畫面。
    // 鍵盤／手把觸發的 cur.click() detail 為 0，不受影響
    if (e.detail > 1) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    const now = performance.now();
    const t = lastAct.get(el) || -1e9;
    if (now - t < ACT_GAP) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    lastAct.set(el, now);
    if (scope && scope.root.contains(el)) focus(el, true);
  }, true);

  // Tab 鍵移動的原生焦點與畫面上的焦點菱形同步
  document.addEventListener('focusin', (e) => {
    const el = e.target && e.target.closest && e.target.closest('[data-nav]');
    if (el && el !== cur && scope && scope.root.contains(el)) focus(el, true);
  });

  // 滑鼠移到項目上就移動焦點（只換外觀，不搶實際焦點以免捲動）
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target && e.target.closest && e.target.closest('[data-nav]');
    if (el && scope && scope.root.contains(el) && !el.disabled) focus(el, true);
  });

  return {
    // 切換畫面：root 為畫面根元素；initial 為預設焦點（元素或 selector）
    setScope(root, opts = {}) {
      scope = root ? { root, onBack: opts.onBack, onMenu: opts.onMenu } : null;
      if (cur) cur.classList.remove('is-focus');
      cur = null;
      if (!root) return;
      let init = opts.initial;
      if (typeof init === 'string') init = root.querySelector(init);
      const list = items();
      // 初始焦點不捲動（窄螢幕先看到畫面頂端）
      focus(init && list.includes(init) ? init : list[0] || null, false, true);
    },
    get current() { return cur; },
    get root() { return scope && scope.root; },
    focus,
    handle,
    refresh() {
      const list = items();
      if (!cur || !list.includes(cur)) focus(list[0] || null);
    },
  };
}
