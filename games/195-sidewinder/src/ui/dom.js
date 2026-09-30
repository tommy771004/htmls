// DOM 小工具：建元素、格式化金額與時間。

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 可導覽的按鈕（data-nav 交給 nav.js）
export function btn(label, onClick, attrs = {}) {
  return h('button', { type: 'button', 'data-nav': '', ...attrs, onclick: onClick }, label);
}

export function fmtMoney(n) {
  const v = Math.round(n || 0);
  return (v < 0 ? '−$' : '$') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fmtTime(t) {
  if (!(t > 0) || !Number.isFinite(t)) return '--';
  const cs = Math.floor(t * 100 + 1e-6);
  const m = Math.floor(cs / 6000);
  const s = Math.floor(cs / 100) % 60;
  const c = cs % 100;
  return m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 只在字串改變時寫 textContent
export function setText(el, s) {
  if (el && el.textContent !== s) el.textContent = s;
}
