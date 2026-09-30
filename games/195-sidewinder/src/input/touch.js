// 觸控按鈕：畫在 touchRoot 裡（容器位置與大小由 app 決定，按鈕以格線填滿容器）。
// 以 root 層級的 pointer 事件做命中判斷，手指可在左右鍵之間滑動；多點觸控各自追蹤。

const CSS = `
.sw-touch{position:relative;width:100%;height:100%;display:none;grid-template-columns:1fr 1fr .28fr 1fr 1.25fr;grid-template-rows:1fr 1fr;
 grid-template-areas:"l r . n t" "l r . b t";gap:10px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));box-sizing:border-box;
 touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.sw-touch[data-on="1"]{display:grid}
.sw-tb{--c:8px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;min-width:0;min-height:0;
 background:#5b2f1c;color:#efe4cc;border:0;margin:0;padding:6px;font:700 17px/1 "PingFang TC","Heiti TC","Noto Sans CJK TC","Microsoft JhengHei",system-ui,sans-serif;
 letter-spacing:.12em;clip-path:polygon(var(--c) 0,calc(100% - var(--c)) 0,100% var(--c),100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,var(--c) 100%,0 calc(100% - var(--c)),0 var(--c));
 box-shadow:inset 0 -4px 0 #3a1b0f,inset 0 2px 0 #74412a;transition:background-color 60ms linear,color 60ms linear}
.sw-tb svg{width:58%;max-width:66px;height:auto;display:block}
.sw-tb>span:not(.sw-dia){margin-right:-.12em}
.sw-tb[data-k="l"]{grid-area:l}.sw-tb[data-k="r"]{grid-area:r}.sw-tb[data-k="t"]{grid-area:t}.sw-tb[data-k="b"]{grid-area:b}.sw-tb[data-k="n"]{grid-area:n}
.sw-tb[data-k="t"]{background:#6b3a1f}
.sw-tb[data-k="n"]{color:#e0ad2e}
.sw-tb .sw-dia{display:flex;gap:3px}.sw-tb .sw-dia i{width:6px;height:6px;background:currentColor;transform:rotate(45deg);opacity:.75}
.sw-tb[data-on="1"]{background:#d9a324;color:#2b140a;box-shadow:inset 0 3px 0 #a87a15}
@media (prefers-reduced-motion:reduce){.sw-tb{transition:none}}
`;

// 手漆看板風格的粗三角箭頭
const ARROW = (dir) => `<svg viewBox="0 0 48 40" aria-hidden="true"><path d="${dir < 0
  ? 'M4 20 L26 3 L26 13 L44 13 L44 27 L26 27 L26 37 Z'
  : 'M44 20 L22 3 L22 13 L4 13 L4 27 L22 27 L22 37 Z'}" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

const BUTTONS = [
  { k: 'l', html: ARROW(-1), label: '左轉' },
  { k: 'r', html: ARROW(1), label: '右轉' },
  { k: 'n', html: '<span>氮氣</span><span class="sw-dia"><i></i><i></i><i></i></span>', label: '氮氣' },
  { k: 'b', html: '<span>煞車</span>', label: '煞車' },
  { k: 't', html: '<span>油門</span>', label: '油門' },
];

function injectCss(doc) {
  if (doc.getElementById('sw-touch-css')) return;
  const st = doc.createElement('style');
  st.id = 'sw-touch-css';
  st.textContent = CSS;
  (doc.head || doc.documentElement).appendChild(st);
}

export function createTouch(root, { onActivity } = {}) {
  if (!root || typeof document === 'undefined') {
    return { state: () => ({ l: false, r: false, t: false, b: false, n: false }), setVisible() {}, visible: () => false, destroy() {} };
  }
  const doc = root.ownerDocument || document;
  injectCss(doc);
  const wrap = doc.createElement('div');
  wrap.className = 'sw-touch';
  wrap.setAttribute('data-on', '0');
  const els = {};
  for (const b of BUTTONS) {
    const el = doc.createElement('div');
    el.className = 'sw-tb';
    el.dataset.k = b.k;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', b.label);
    el.innerHTML = b.html;
    wrap.appendChild(el);
    els[b.k] = el;
  }
  root.appendChild(wrap);

  const ptr = new Map(); // pointerId → 按鈕 key
  let shown = false;

  function hit(x, y) {
    const t = doc.elementFromPoint ? doc.elementFromPoint(x, y) : null;
    const el = t && t.closest ? t.closest('.sw-tb') : null;
    return el && wrap.contains(el) ? el.dataset.k : null;
  }
  function refresh() {
    const on = new Set(ptr.values());
    for (const k in els) els[k].setAttribute('data-on', on.has(k) ? '1' : '0');
  }
  function down(e) {
    e.preventDefault();
    try { wrap.setPointerCapture(e.pointerId); } catch { /* 部分瀏覽器不支援 */ }
    ptr.set(e.pointerId, hit(e.clientX, e.clientY));
    refresh();
    if (onActivity) onActivity();
  }
  function move(e) {
    if (!ptr.has(e.pointerId)) return;
    const k = hit(e.clientX, e.clientY);
    if (k !== ptr.get(e.pointerId)) { ptr.set(e.pointerId, k); refresh(); }
  }
  function up(e) {
    if (!ptr.delete(e.pointerId)) return;
    refresh();
  }
  const noMenu = (e) => e.preventDefault();
  wrap.addEventListener('pointerdown', down);
  wrap.addEventListener('pointermove', move);
  wrap.addEventListener('pointerup', up);
  wrap.addEventListener('pointercancel', up);
  wrap.addEventListener('lostpointercapture', up);
  wrap.addEventListener('contextmenu', noMenu);

  return {
    state() {
      const on = new Set(ptr.values());
      return { l: on.has('l'), r: on.has('r'), t: on.has('t'), b: on.has('b'), n: on.has('n') };
    },
    setVisible(v) {
      shown = !!v;
      wrap.setAttribute('data-on', shown ? '1' : '0');
      if (!shown) { ptr.clear(); refresh(); }
    },
    visible: () => shown,
    release() { ptr.clear(); refresh(); },
    destroy() {
      wrap.removeEventListener('pointerdown', down);
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerup', up);
      wrap.removeEventListener('pointercancel', up);
      wrap.removeEventListener('lostpointercapture', up);
      wrap.removeEventListener('contextmenu', noMenu);
      wrap.remove();
    },
  };
}
