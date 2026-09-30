// 表單元件：滑桿、分段選擇、開關。都不用 <input>（input 模組會略過文字輸入框的按鍵）。
import { h } from './dom.js';

// 滑桿：value 0..1，step 為左右鍵一次的量；fmt 顯示數值
export function slider({ label, value = 0.5, step = 0.05, fmt = (v) => Math.round(v * 100) + '%', onChange }) {
  let v = Math.max(0, Math.min(1, value));
  const fill = h('span', { class: 'sl-fill' });
  const thumb = h('span', { class: 'sl-thumb' });
  const track = h('span', { class: 'sl-track' }, fill, thumb);
  const out = h('span', { class: 'sl-val' });
  const el = h('div', { class: 'slider', role: 'slider', tabindex: '0', 'data-nav': '', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('span', { class: 'sl-label' }, label), track, out);

  function paint() {
    const pct = (v * 100).toFixed(1) + '%';
    fill.style.width = pct;
    thumb.style.left = pct;
    out.textContent = fmt(v);
    el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    el.setAttribute('aria-valuetext', fmt(v));
  }
  function set(nv, emit = true) {
    nv = Math.max(0, Math.min(1, nv));
    if (nv === v && emit) return;
    v = nv;
    paint();
    if (emit && onChange) onChange(v);
  }
  el.navAdjust = (d) => set(Math.round((v + d * step) / step) * step);
  let drag = false;
  const fromEvent = (e) => {
    const r = track.getBoundingClientRect();
    set((e.clientX - r.left) / Math.max(1, r.width));
  };
  track.addEventListener('pointerdown', (e) => {
    drag = true;
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    fromEvent(e);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => { if (drag) fromEvent(e); });
  const end = () => { drag = false; };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (e) => {
    // 直接聚焦時（Tab）也能用方向鍵；onMenu 同時會送 left/right，所以這裡只處理 Home/End
    if (e.key === 'Home') { set(0); e.preventDefault(); }
    if (e.key === 'End') { set(1); e.preventDefault(); }
  });
  paint();
  el.setValue = (nv) => set(nv, false);
  return el;
}

// 分段選擇：options [{value,label}]
export function segmented({ label, options, value, onChange }) {
  const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', 'data-nav': '', role: 'radio', class: 'seg-b' }, o.label);
    b.addEventListener('click', () => {
      select(o.value);
      if (onChange) onChange(o.value);
    });
    b._value = o.value;
    return b;
  });
  function select(v) {
    for (const b of buttons) {
      const on = b._value === v;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.classList.toggle('on', on);
    }
  }
  group.append(...buttons);
  select(value);
  group.setValue = select;
  return h('div', { class: 'field' }, h('span', { class: 'f-label' }, label), group);
}

// 開關
export function toggle({ label, value, onChange, on = '開', off = '關' }) {
  let v = !!value;
  const state = h('span', { class: 'tg-state' });
  const b = h('button', { type: 'button', 'data-nav': '', class: 'toggle', role: 'switch' }, h('span', { class: 'f-label' }, label), state);
  const paint = () => {
    b.setAttribute('aria-checked', v ? 'true' : 'false');
    b.classList.toggle('on', v);
    state.textContent = v ? on : off;
  };
  b.addEventListener('click', () => {
    v = !v;
    paint();
    if (onChange) onChange(v);
  });
  b.navAdjust = (d) => {
    const nv = d > 0;
    if (nv !== v) { v = nv; paint(); if (onChange) onChange(v); }
  };
  paint();
  b.setValue = (nv) => { v = !!nv; paint(); };
  return b;
}
