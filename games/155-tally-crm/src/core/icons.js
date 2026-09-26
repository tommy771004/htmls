/* icons · 劃記自繪圖示
   20×20 格線、內容落在 2–18 安全區；1.6 描邊、圓頭端點、方角轉折。
   共同的自創細節：每個封閉形都在左上角留一道「提筆缺口」，像手寫時筆尖離紙，
   方形取代圓形（人頭、窗格），和人名字塊的方正感一致。 */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});
  const { raw, esc } = CRM.util;

  /** 左上角留缺口的方框 */
  const frame = (x1, y1, x2, y2, g = 2) => `M${x1 + g} ${y1}H${x2}V${y2}H${x1}V${y1 + g}`;
  /** 左上方留缺口的圓（gapAt 為缺口中心角度，螢幕座標，225° = 左上） */
  function ring(cx, cy, r, gapAt = 225, gap = 36) {
    const rad = (d) => (d * Math.PI) / 180;
    const a0 = rad(gapAt + gap / 2);
    const a1 = rad(gapAt - gap / 2);
    const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    return `M${p(a0)}A${r} ${r} 0 1 1 ${p(a1)}`;
  }
  const dot = (x, y, r = 1.15) => ['dot', x, y, r];

  const I = {
    /* navigation */
    dashboard: [frame(3, 3, 17, 17), 'M6 13.5A4 4 0 0 1 14 13.5', 'M10 13.5L12.4 10.6'],
    contacts: [frame(7, 3, 13, 9, 1.6), 'M4 17V15.6C4 13.6 5.4 12 7.5 12H12.5C14.6 12 16 13.6 16 15.6V17'],
    companies: [frame(4, 3, 12.5, 17), 'M12.5 8.5H16V17', 'M2.5 17H17.5', 'M7 6.5H9.5M7 9.5H9.5M7 12.5H9.5'],
    deals: ['M11 3H17V9L9.5 16.5L3.5 10.5L9 5', dot(14, 6)],
    tasks: [frame(3, 3, 17, 17), 'M6.5 10.2L9 12.7L13.8 7.4'],
    activities: ['M4 5V7M4 9V11M4 13V15', 'M7.5 6H16.5M7.5 10H14M7.5 14H15.5'],

    /* actions */
    search: [ring(8.5, 8.5, 5.2), 'M12.4 12.4L16.8 16.8'],
    plus: ['M10 4V16M4 10H16'],
    filter: ['M3 5H17M5.5 10H14.5M8 15H12'],
    sort: ['M6 4V16M3.5 13.5L6 16L8.5 13.5', 'M11 5H17M11 10H15M11 15H13'],
    more: [dot(4.5, 10), dot(10, 10), dot(15.5, 10)],
    close: ['M5 5L15 15M15 5L5 15'],
    check: ['M4.5 10.5L8.3 14.3L15.5 5.7'],
    chevronDown: ['M6 8L10 12L14 8'],
    chevronUp: ['M6 12L10 8L14 12'],
    chevronLeft: ['M12 6L8 10L12 14'],
    chevronRight: ['M8 6L12 10L8 14'],
    arrowRight: ['M4 10H16M11.5 5.5L16 10L11.5 14.5'],
    arrowUpRight: ['M6 14L14 6M8 6H14V12'],
    drag: [dot(7.5, 5), dot(12.5, 5), dot(7.5, 10), dot(12.5, 10), dot(7.5, 15), dot(12.5, 15)],
    undo: ['M7 5.5L4 8.5L7 11.5', 'M4.5 8.5H12C14.5 8.5 16.2 10.3 16.2 12.6S14.5 16.7 12 16.7H8.5'],
    trash: ['M3.5 5.5H16.5', 'M8 5.5V3.5H12V5.5', 'M5.2 5.5L6 17H14L14.8 5.5', 'M8.5 9V13.5M11.5 9V13.5'],
    edit: ['M12.5 4.5L15.5 7.5L7 16H4V13L10.5 6.5'],
    link: ['M9.5 6.5L11 5C12.4 3.6 14.6 3.6 16 5S17.4 8.6 16 10L14.5 11.5', 'M10.5 13.5L9 15C7.6 16.4 5.4 16.4 4 15S2.6 11.4 4 10L5.5 8.5', 'M8 12L12 8'],
    refresh: ['M16.5 10A6.5 6.5 0 1 1 14.6 5.4', 'M15 2.6V5.6H12'],
    help: [ring(10, 10, 7), 'M8 8.2C8 7 8.9 6.1 10 6.1S12 7 12 8.2C12 9.6 10 9.8 10 11.4', dot(10, 13.9, 1)],

    /* records & activity types */
    phone: ['M7 3.5L9 7.5L7.3 9C8.3 11 9 11.7 11 12.7L12.5 11L16.5 13V15.5C16.5 16.2 15.9 16.8 15.2 16.8C8.9 16.4 3.6 11.1 3.2 4.8C3.2 4.1 3.8 3.5 4.5 3.5H5'],
    mail: [frame(3, 5, 17, 15), 'M3.6 6.2L10 11L16.4 6.2'],
    meeting: [frame(4, 3.5, 8, 7.5, 1.2), frame(12, 3.5, 16, 7.5, 1.2), 'M2.5 14V12.8C2.5 11.5 3.5 10.5 4.8 10.5H7.2C8.5 10.5 9.5 11.5 9.5 12.8V14', 'M10.5 14V12.8C10.5 11.5 11.5 10.5 12.8 10.5H15.2C16.5 10.5 17.5 11.5 17.5 12.8V14', 'M2.5 17H17.5'],
    note: ['M6 3H12L16 7V17H4V5', 'M12 3.4V7H15.6', 'M7 10.5H13M7 13.5H11'],
    stage: ['M4 5L9 10L4 15M10 5L15 10L10 15'],
    calendar: [frame(3, 4.5, 17, 17), 'M3.8 8.5H16.2', 'M7 3V6M13 3V6'],
    clock: [ring(10, 10, 7), 'M10 6.5V10L12.5 11.8'],
    flag: ['M5 17V3.5', 'M5 4H15L12.5 7.5L15 11H5'],
    pin: ['M10 17.5C10 17.5 4.5 12.6 4.5 8.4C4.5 5.3 7 3 10 3S15.5 5.3 15.5 8.4C15.5 12.6 10 17.5 10 17.5Z', frame(8.3, 6.6, 11.7, 10, 1)],
    tag: ['M8 3.5L6.5 16.5M13.5 3.5L12 16.5M4 7.5H16.5M3.5 12.5H16'],
    coin: [ring(10, 10, 7), 'M12.2 7.6C11.7 7.1 10.9 6.8 10 6.8C8.8 6.8 8 7.4 8 8.3C8 10.4 12.2 9.5 12.2 11.6C12.2 12.5 11.3 13.1 10 13.1C9 13.1 8.2 12.8 7.7 12.2', 'M10 5.3V6.8M10 13.1V14.7'],
    target: [ring(10, 10, 7), ring(10, 10, 3.6, 225, 50), dot(10, 10, 1)],
    user: [frame(7, 3, 13, 9, 1.6), 'M4 17V15.6C4 13.6 5.4 12 7.5 12H12.5C14.6 12 16 13.6 16 15.6V17'],
    keyboard: [frame(2.5, 5, 17.5, 15), dot(6, 8.5, .9), dot(10, 8.5, .9), dot(14, 8.5, .9), 'M6.5 12H13.5'],

    /* views */
    list: [dot(4, 5, 1), dot(4, 10, 1), dot(4, 15, 1), 'M7.5 5H17M7.5 10H17M7.5 15H17'],
    board: [frame(3, 3.5, 6.5, 16.5, 1.3), frame(8.25, 3.5, 11.75, 12, 1.3), frame(13.5, 3.5, 17, 14, 1.3)],
    grid: [frame(3, 3, 8.5, 8.5, 1.5), frame(11.5, 3, 17, 8.5, 1.5), frame(3, 11.5, 8.5, 17, 1.5), frame(11.5, 11.5, 17, 17, 1.5)],
    week: [frame(3, 4.5, 17, 17), 'M3.8 8.5H16.2', 'M7 3V6M13 3V6', 'M7.5 8.8V16.4M12.5 8.8V16.4'],
  };

  function body(name) {
    const parts = I[name];
    if (!parts) return '';
    return parts
      .map((p) => (Array.isArray(p) ? `<circle cx="${p[1]}" cy="${p[2]}" r="${p[3]}" fill="currentColor" stroke="none"/>` : `<path d="${p}"/>`))
      .join('');
  }

  /** icon('phone', { size: 16, cls: 'x', label: '通話' }) → Raw <svg> */
  function icon(name, { size = 20, cls = '', label = '' } = {}) {
    const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
    return raw(
      `<svg class="ic${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="4" ${a11y}>${body(name)}</svg>`,
    );
  }

  CRM.icons = { names: Object.keys(I), paths: I, frame, ring };
  CRM.icon = icon;
})();
