// 手機觸控：左搖桿、右半邊滑動轉向、右下按鈕。
import { SENS0 } from '../core/input.js';
// 觸控轉向的倍率依滑鼠預設靈敏度換算：預設調低後手機轉速維持原本的 1.6 × 0.0022。
const TK = 1.6 * 0.0022 / SENS0;
// 圖示一律 inline SVG：單檔、不多一次請求，顏色跟著 currentColor。位置在 style.js 的 .k-*。
const svg = (body, attrs = 'fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${attrs}>${body}</svg>`;
const fill = 'fill="currentColor"';
const ICON = {
  fire: svg('<path d="M12 1.5c2.5 2.2 3.8 4.9 3.8 8v1.2H8.2V9.5c0-3.1 1.3-5.8 3.8-8z"/><path d="M8.2 12.2h7.6v7H8.2z"/><path d="M7 20.6h10V23H7z"/>', fill),
  jump: svg('<path d="M5.5 13 12 6.5 18.5 13"/><path d="M5.5 18.5h13"/>'),
  crouch: svg('<path d="M5.5 11 12 17.5 18.5 11"/><path d="M5.5 5.5h13"/>'),
  reload: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"/><path d="M19.8 3v4.3h-4.3"/>'),
  use: svg('<path d="M8.3 12.5V5.2a1.350 1.350 0 0 1 2.700 0V11h.4V3.700a1.350 1.350 0 0 1 2.700 0V11h.4V5a1.350 1.350 0 0 1 2.700 0v6.3h.3V7.6a1.3 1.3 0 0 1 2.6 0v8c0 4.6-2.8 7.4-7 7.4-3 0-4.8-1.3-6.3-3.5l-3.700-5.4c-1-1.5.9-3 2.2-1.8z"/>', fill),
  scope: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>'),
  swap: svg('<path d="M4 8.5h15M15.5 4.5l4 4-4 4"/><path d="M20 15.5H5M8.5 11.5l-4 4 4 4"/>'),
  buy: svg('<path d="M16.5 7.5C15.8 6 14.2 5.2 12 5.2c-2.700 0-4.5 1.3-4.5 3.3 0 4.700 9.3 2.3 9.3 7 0 2-1.900 3.3-4.8 3.3-2.4 0-4.2-.9-5-2.6"/><path d="M12 2.5v19"/>'),
};
export function initTouch(root, input, canvas) {
  const btn = (k, name, down, up) => {
    const b = document.createElement('div'); b.className = `tc k-${k}`; b.setAttribute('role', 'button'); b.setAttribute('aria-label', name); b.innerHTML = ICON[k] ?? '';
    const off = () => { b.classList.remove('on'); up?.(); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('on'); down(); try { b.setPointerCapture?.(e.pointerId); } catch { /* 合成事件沒有真的指標 */ } });
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); root.appendChild(b); return b;
  };
  const stick = btn('stick', '移動', () => {}, () => {});
  let sx = 0, sy = 0;
  stick.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; input.locked = true; });
  stick.addEventListener('pointermove', e => { if (!e.buttons && e.pointerType === 'mouse') return; input.side = Math.max(-1, Math.min(1, (e.clientX - sx) / 44)); input.fwd = Math.max(-1, Math.min(1, -(e.clientY - sy) / 44)); });
  const stop = () => { input.side = 0; input.fwd = 0; }; stick.addEventListener('pointerup', stop); stick.addEventListener('pointercancel', stop);
  btn('fire', '射擊', () => { input.fire = true; input.firePress++; }, () => { input.fire = false; });
  btn('jump', '跳躍', () => { input.jump = true; input.jumpPress = true; }, () => { input.jump = false; });
  btn('crouch', '蹲下', () => { input.crouch = !input.crouch; });
  btn('reload', '換彈', () => { input.reload = true; }, () => { input.reload = false; });
  btn('use', '使用', () => { input.use = true; }, () => { input.use = false; });
  btn('scope', '瞄準鏡', () => { input.alt = true; }, () => { input.alt = false; });
  btn('swap', '換武器', () => { input.wheel = 1; });
  btn('buy', '購買', () => { input.buy = true; }).classList.add('buy');
  let lx = 0, ly = 0, id = -1;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; input.locked = true; id = e.pointerId; lx = e.clientX; ly = e.clientY; });
  canvas.addEventListener('pointermove', e => { if (e.pointerId !== id) return; input.dx += (e.clientX - lx) * TK; input.dy += (e.clientY - ly) * TK; lx = e.clientX; ly = e.clientY; });
  canvas.addEventListener('pointerup', () => { id = -1; });
}
