// 自繪圖示：圖鑑（封面印著一條魚的野外手冊）、暫停（兩支直立的槳）、聲音（船鈴）、關閉；品質徽章是琺瑯別針。
const S = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  book: S('<path d="M5 4.5h10.5a2 2 0 0 1 2 2V19.5H7a2 2 0 0 1-2-2z"/><path d="M5 17.5a2 2 0 0 1 2-2h10.5"/><path d="M8.2 10.3c1.4-1.5 3.6-1.5 5 0-1.4 1.5-3.6 1.5-5 0z"/><path d="M13.2 10.3l1.6-1.1v2.2z"/><path d="M19.5 7v13"/>'),
  pause: S('<path d="M8.5 3.5v11"/><path d="M15.5 3.5v11"/><path d="M8.5 14.5c-1.3 0-2 1.3-2 3s.9 3 2 3 2-1.3 2-3-.7-3-2-3z"/><path d="M15.5 14.5c-1.3 0-2 1.3-2 3s.9 3 2 3 2-1.3 2-3-.7-3-2-3z"/>'),
  play: S('<path d="M8 5.5v13l10-6.5z"/>'),
  bell: S('<path d="M12 3.5v1.6"/><path d="M7 15.5c0-5 1.6-8.6 5-8.6s5 3.6 5 8.6z"/><path d="M5.5 15.5h13"/><path d="M10.6 18.2a1.6 1.6 0 0 0 2.8 0"/><path d="M20 8.5c.8 1 .8 3 0 4"/><path d="M4 8.5c-.8 1-.8 3 0 4"/>'),
  bellOff: S('<path d="M12 3.5v1.6"/><path d="M7 15.5c0-5 1.6-8.6 5-8.6s5 3.6 5 8.6z"/><path d="M5.5 15.5h13"/><path d="M10.6 18.2a1.6 1.6 0 0 0 2.8 0"/><path d="M4.5 4.5l15 15"/>'),
  close: S('<path d="M6 6.5l12 11"/><path d="M18 6.5l-12 11"/>'),
};

export const TIER_COL = ['#a39886', '#8cc063', '#d9dde0', '#e9b949', '#9d7bd0'];

// 品質琺瑯徽章（SVG 字串）。普通是木紋圓片、良質是葉片、銀星／金星是六角別針、王冠是虹彩琉璃六角
let gid = 0;
export function badge(tier, size = 40) {
  const id = 'q' + (gid++);
  const star = (cx, cy, r) => {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2); }
    return d + 'Z';
  };
  const hex = 'M20 2.5l15.2 8.75v17.5L20 37.5 4.8 28.75v-17.5z';
  const txt = (s, fill) => `<text x="20" y="20.5" text-anchor="middle" dominant-baseline="central" font-family="Iowan Old Style, Palatino, Georgia, serif" font-size="17" font-weight="700" fill="${fill}">${s}</text>`;
  let body;
  if (tier === 0) body = `<circle cx="20" cy="20" r="16.5" fill="#a39886" stroke="#6f6658" stroke-width="2"/><path d="M8 17c6-3 18-3 24 0M9 23c6 2.5 16 2.5 22 0" stroke="#8a806f" stroke-width="1.2" fill="none"/>${txt('C', '#2f2a22')}`;
  else if (tier === 1) body = `<path d="M20 3.5C30 9 34 19 20 36.5 6 19 10 9 20 3.5z" fill="#8cc063" stroke="#4f7a35" stroke-width="2"/><path d="M20 9v24" stroke="#5f8c43" stroke-width="1.2"/>${txt('B', '#203214')}`;
  else if (tier === 2) body = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f7"/><stop offset=".55" stop-color="#c3c9cd"/><stop offset="1" stop-color="#e6eaec"/></linearGradient></defs><path d="${hex}" fill="url(#${id})" stroke="#7c858b" stroke-width="2"/><path d="${star(20, 20.5, 9.5)}" fill="#5f686e"/>`;
  else if (tier === 3) body = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe39a"/><stop offset=".5" stop-color="#e2a93a"/><stop offset="1" stop-color="#f6cf6c"/></linearGradient></defs><path d="${hex}" fill="url(#${id})" stroke="#94681c" stroke-width="2"/><path d="${star(13.6, 20.5, 6.6)}" fill="#6e4c12"/><path d="${star(26.4, 20.5, 6.6)}" fill="#6e4c12"/>`;
  else body = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cdb8f0"/><stop offset=".35" stop-color="#8e6cc8"/><stop offset=".62" stop-color="#7cc4c0"/><stop offset="1" stop-color="#e3c3ea"/></linearGradient></defs><path d="${hex}" fill="url(#${id})" stroke="#4e3a78" stroke-width="2"/><path d="M10.5 26.5h19l1.6-11-5.6 4.3L20 11.5l-5.5 8.3-5.6-4.3z" fill="#2c1f47" stroke="#2c1f47" stroke-width="1" stroke-linejoin="round"/><path d="M8.5 9.5l5 1.5" stroke="#fff" stroke-opacity=".55" stroke-width="1.6"/>`;
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}

// 魚簍格：小魚剪影，依品質上色；空格是虛線輪廓
export function slot(tier) {
  const fish = 'M2 7c3-4.2 9.5-4.6 13.5-.4L20 3v8l-4.5-3.6C11.5 11.6 5 11.2 2 7z';
  if (tier == null) return `<svg viewBox="0 0 22 14"><path d="${fish}" fill="none" stroke="#8f8a78" stroke-width="1.1" stroke-dasharray="2 1.6"/></svg>`;
  return `<svg viewBox="0 0 22 14"><path d="${fish}" fill="${TIER_COL[tier]}" stroke="#16231c" stroke-width=".8"/><circle cx="5.2" cy="6.3" r=".9" fill="#16231c"/></svg>`;
}

// 吊牌的麻繩
export const STRING = `<svg viewBox="0 0 82 30" fill="none"><path d="M0 9c18 0 30 14 52 10s18-10 30-4" stroke="#a88a5a" stroke-width="3" stroke-linecap="round"/><path d="M0 9c18 0 30 14 52 10s18-10 30-4" stroke="#7a6038" stroke-width="1" stroke-dasharray="3 3" stroke-linecap="round"/></svg>`;
