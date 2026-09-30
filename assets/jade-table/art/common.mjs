// Shared helpers for the 青雀 character art.
export const grad = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
export const r1 = n => Math.round(n * 10) / 10;

// Five-petal ivory blossoms (the palette's stand-in for sakura), blurred to sit behind the figure as out-of-focus light.
export function blossoms(u, list, blur = true) {
  return list.map(([x, y, r, a], i) => `<g transform="translate(${x} ${y}) rotate(${i * 37})" opacity="${a}"${blur ? ` filter="url(#${u}-soft)"` : ''}>${[0, 72, 144, 216, 288].map(t => `<ellipse cx="0" cy="${-r * .62}" rx="${r * .42}" ry="${r * .62}" transform="rotate(${t})" fill="#fbf4e2"/>`).join('')}<circle r="${r * .22}" fill="#e2bf6e"/></g>`).join('');
}
