// HUD 圖示：六把槍的側面剪影與小圖示（單色 SVG，用 currentColor 上色）。
// 槍的座標系是 100×32，槍口朝右。
const r = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z`;
const GUN = {
  p9: [r(28, 9, 44, 7), r(32, 16, 34, 3), 'M34 16h10l-3 14H31z', 'M44 19h9v1.6h-9z M51 19h2v4h-2z', r(68, 7.5, 2, 2), r(30, 7.8, 3, 1.5)].join(''),
  smg: [r(8, 11, 14, 2), r(8, 11, 2, 9), r(8, 18, 14, 2), r(22, 10, 36, 7), r(58, 12, 18, 3), r(30, 8, 20, 2), 'M30 17h6l-2 10h-6z', r(44, 17, 5, 13), r(74, 11.5, 4, 4)].join(''),
  ar: ['M4 13l18-2v7L6 22z', r(22, 10, 36, 7), r(58, 11, 18, 5), r(76, 12.5, 20, 2), r(90, 10, 2, 3), r(40, 8, 12, 2), 'M33 17h6l-3 10h-6z', 'M46 17h8l4 11-7 2z'].join(''),
  sg: ['M2 14l20-3v7L4 22z', r(22, 11, 26, 7), r(48, 11, 48, 3), r(48, 15, 40, 2.5), r(58, 14, 16, 5.5), 'M28 18h6l-2 8h-6z', r(92, 9.5, 2, 1.5)].join(''),
  dmr: ['M3 13l19-2v7L5 21z', r(22, 10, 34, 7), r(30, 5, 22, 3), r(28, 5.5, 3, 2), r(50, 3.5, 6, 5.5), r(36, 8, 2, 2), r(46, 8, 2, 2), r(56, 10.5, 22, 6), r(78, 12.5, 18, 2), 'M32 17h6l-3 10h-6z', r(44, 17, 7, 9)].join(''),
  sr: ['M2 12l22-2 2 8h-8l-4 5-10-2z', r(24, 10, 30, 6), r(31, 4, 23, 3.5), r(27, 4.5, 4, 2.8), r(54, 2.8, 7, 6), r(36, 7.5, 2, 2.5), r(48, 7.5, 2, 2.5), r(54, 11.5, 44, 2.2), r(50, 16, 2, 3.5), 'M48.5 19.5h5v2.5h-5z', 'M30 16h6l-2 9-6-1z', 'M74 13.7l1.6.3-3 10-1.6-.3z M76 13.7l1.6-.3 3 10-1.6.3z'].join(''),
};
export const gunIcon = (w, cls = 'gi') => (GUN[w] ? `<svg class="${cls}" viewBox="0 0 100 32" aria-hidden="true"><path d="${GUN[w]}" fill="currentColor"/></svg>` : '');

const ICON = {
  // 存活：人形
  alive: '<circle cx="8" cy="4.5" r="3"/><path d="M2.5 15c0-3.6 2.4-6 5.5-6s5.5 2.4 5.5 6z"/>',
  // 擊殺：準星
  kills: '<path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="8" cy="8" r="4.2" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="8" cy="8" r="1.2"/>',
  // 護甲片
  plate: '<path d="M8 1.5 14 4v4.5c0 3.4-2.6 5.6-6 6.5-3.4-.9-6-3.1-6-6.5V4z"/>',
  // 背心
  vest: '<path d="M4 2h2.5c.4 1.2 1 1.8 1.5 1.8S9.1 3.2 9.5 2H12l2 4-1.5 1V14h-9V7L2 6z"/>',
  // 爆頭：骷髏
  head: '<path fill-rule="evenodd" d="M8 1.5A5.5 5.5 0 0 0 2.5 7c0 2 1 3.3 2.5 4v3h6v-3c1.5-.7 2.5-2 2.5-4A5.5 5.5 0 0 0 8 1.5zM5.6 6.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zm4.8 0a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zM7 12h.8v2H7zm1.2 0H9v2h-.8z"/>',
  // 毒圈：圓圈
  storm: '<circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8" cy="8" r="1.8"/>',
  trophy: '<path d="M4 2h8v3.5A4 4 0 0 1 8 9.5 4 4 0 0 1 4 5.5zM2 3h2v2.5H3A1 1 0 0 1 2 4.5zM12 3h2v1.5a1 1 0 0 1-1 1h-1zM7 9.5h2V12h2.5v2h-7v-2H7z"/>',
  pause: '<path d="M4 3h3v10H4zM9 3h3v10H9z"/>',
};
export const icon = (k, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">${ICON[k] || ''}</svg>`;
