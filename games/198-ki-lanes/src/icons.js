// 技能圖示：每個角色、每個技能一個手繪 SVG 記號（48×48），用角色元素色描繪。
const W = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor"';

export const ICONS = {
  homura: {
    Q: W(`<circle cx="19" cy="29" r="9" ${F}/><path d="M24 22 L40 8 L33 21 L42 19 L28 31" ${F} opacity=".75"/><circle cx="17" cy="31" r="3.5" fill="#fff"/>`),
    W: W(`<path d="M8 14 l9 10 -9 10 M17 14 l9 10 -9 10" ${S} opacity=".6"/><circle cx="34" cy="24" r="8" ${F}/><path d="M30 20 h8 M30 24 h8 M30 28 h7" stroke="#16110c" stroke-width="2"/>`),
    E: W(`<path d="M10 36 C14 16 26 10 38 12" ${S} stroke-dasharray="3 5"/><path d="M33 6 l8 6 -8 6 -8 -6z" ${F}/><circle cx="12" cy="36" r="3" ${F} opacity=".5"/>`),
    R: W(`<path d="M6 20 L42 10 L42 38 L6 28 Z" ${F} opacity=".45"/><path d="M6 22 L42 17 L42 31 L6 26 Z" ${F}/><path d="M8 24 H42" stroke="#fff" stroke-width="2.4"/>`),
  },
  shimo: {
    Q: W(`<path d="M8 40 L30 18 L40 8 L36 22 L14 42 Z" ${F}/><path d="M30 18 L36 22" stroke="#16110c" stroke-width="2"/><path d="M6 30 l6 -2 M12 40 l2 -6" ${S} stroke-width="2.4" opacity=".6"/>`),
    W: W(`<path d="M10 38 C10 20 22 10 40 10" ${S} stroke-width="5"/><path d="M14 40 C16 26 26 18 40 16" ${S} stroke-width="2" opacity=".55"/><path d="M36 6 l6 4 -5 5" ${S}/>`),
    E: W(`<path d="M8 30 c6 -6 12 6 18 0 s12 -6 16 0" ${S}/><path d="M10 38 c6 -5 12 5 18 0 s10 -5 12 0" ${S} opacity=".55"/><path d="M24 6 l5 8 -5 8 -5 -8z" ${F}/>`),
    R: W(`<g ${S}><path d="M24 4 V44 M6.7 14 L41.3 34 M6.7 34 L41.3 14"/><path d="M20 8 l4 4 4 -4 M20 40 l4 -4 4 4"/></g><circle cx="24" cy="24" r="5" ${F}/>`),
  },
  iwao: {
    Q: W(`<path d="M24 44 L10 12 L18 14 Z M24 44 L24 6 L29 12 Z M24 44 L38 12 L30 14 Z" ${F}/><path d="M8 44 H40" ${S}/>`),
    W: W(`<rect x="22" y="12" width="16" height="24" rx="3" ${F}/><path d="M6 16 H16 M4 24 H18 M6 32 H16" ${S}/>`),
    E: W(`<path d="M24 5 L40 14 L40 32 L24 43 L8 32 L8 14 Z" ${S}/><path d="M24 13 L33 18 L33 29 L24 35 L15 29 L15 18 Z" ${F} opacity=".7"/>`),
    R: W(`<path d="M24 4 V26 M16 18 L24 27 L32 18" ${S} stroke-width="4"/><path d="M6 36 L16 32 L22 40 L28 31 L34 38 L42 34" ${S}/><path d="M4 44 H44" ${S} stroke-width="2"/>`),
  },
  raiga: {
    Q: W(`<path d="M30 4 L14 26 H24 L18 44 L36 20 H26 Z" ${F}/><path d="M36 30 l6 -2 -3 6" ${S} stroke-width="2.4" opacity=".7"/>`),
    W: W(`<g ${S} stroke-width="2.6"><path d="M8 12 l10 6 M6 22 l12 3 M8 32 l10 -2 M12 40 l8 -5"/></g><circle cx="32" cy="24" r="9" ${F}/>`),
    E: W(`<path d="M10 10 L38 38 M38 10 L10 38" ${S} stroke-width="4"/><circle cx="24" cy="24" r="4" fill="#16110c" stroke="currentColor" stroke-width="2"/>`),
    R: W(`<g ${F}><circle cx="24" cy="6" r="3"/><circle cx="41" cy="18" r="3"/><circle cx="35" cy="40" r="3"/><circle cx="13" cy="40" r="3"/><circle cx="7" cy="18" r="3"/></g><path d="M24 6 L35 40 L7 18 L41 18 L13 40 Z" ${S} stroke-width="2.4"/>`),
  },
  D: W(`<path d="M24 3 L28 15 L40 8 L33 20 L45 24 L33 28 L40 40 L28 33 L24 45 L20 33 L8 40 L15 28 L3 24 L15 20 L8 8 L20 15 Z" ${F} opacity=".85"/><circle cx="24" cy="24" r="6" fill="#16110c"/>`),
  B: W(`<path d="M10 40 V20 L24 9 L38 20 V40" ${S}/><path d="M19 40 V29 H29 V40" ${S}/>`),
  C: W(`<path d="M24 44 C12 40 12 28 18 20 C18 28 22 28 22 24 C22 16 26 10 30 6 C30 16 38 20 36 32 C35 40 30 44 24 44 Z" ${F}/>`),
};
