// 青雀 character art: original SVG portraits built from one parametric construction, in the table's jade, gold and ivory.
// Every call gets its own id prefix so several portraits can share one document without gradient clashes.
// Split by concern into ./art/: face, hair, garment and shared helpers; this module composes them and keeps the public API.
import { grad, r1, blossoms } from './art/common.mjs';
import { faceLayers } from './art/face.mjs';
import { hairLayers } from './art/hair.mjs';
import { bustClothes, figureSvg } from './art/garment.mjs';
let seq = 0;

export const CAST = {
  qingque: {
    name: '青雀', style: 'bob', mouth: 'open', lids: 0, tilt: 3, ahoge: true,
    hair: ['#3f6a5f', '#1d3531', '#0d1a18'], sheen: '#8fc2b1', line: '#0a1512',
    eye: ['#2a1a0c', '#b8812f', '#f6d58e'], skin: ['#fff6ec', '#f3d9c6', '#e4b9a4'],
    kimono: ['#17714f', '#0b4533'], collar: '#f5eed8', band: '#d8b060', motif: 'wave', acc: 'sparrow'
  },
  moon: {
    name: '月白', style: 'long', mouth: 'smile', lids: 0.2, tilt: -3,
    hair: ['#f4f5ef', '#c9d3cd', '#8e9f99'], sheen: '#ffffff', line: '#56655f',
    eye: ['#1d3a38', '#5aa89c', '#c9f0e4'], skin: ['#fffaf4', '#f5e2d6', '#e6c3b3'],
    kimono: ['#eef0e6', '#bfcfc2'], collar: '#1d6a50', band: '#caa25a', motif: 'hemp', acc: 'moon'
  },
  bamboo: {
    name: '竹隱', style: 'ponytail', mouth: 'smirk', lids: 0.12, tilt: 7,
    hair: ['#343a36', '#161a18', '#070908'], sheen: '#7c8a82', line: '#050706',
    eye: ['#10291a', '#3f9a61', '#bff0c8'], skin: ['#fff3e8', '#f1d6c2', '#dcb29b'],
    kimono: ['#23543d', '#102c20'], collar: '#e9e2c8', band: '#b98f45', motif: 'bamboo', acc: 'mask'
  },
  mountain: {
    name: '遠山', style: 'wave', mouth: 'calm', lids: 0.34, tilt: 1, mole: true,
    hair: ['#56606a', '#2a3139', '#12161b'], sheen: '#a8b4bd', line: '#0d1013',
    eye: ['#2b1d10', '#a47a3f', '#f0d49a'], skin: ['#fff5ec', '#f2dccb', '#e0b9a3'],
    kimono: ['#2f3a37', '#161d1b'], collar: '#e6d9b4', band: '#c9a45a', motif: 'ridge', acc: 'jade'
  }
};
export const SEAT_CAST = ['qingque', 'moon', 'bamboo', 'mountain'];

// The head in the portrait's 200×240 space, split into layers so a caller can put clothing between them:
// back (ponytail and back hair), neck, and front (face, then fringe, side locks and ornaments over it).
function parts(c, u) {
  const f = faceLayers(c, u), h = hairLayers(c, u), k = bustClothes(c, u);
  const defs = `
${grad(`${u}-gold`, [[0, '#fff0c0'], [.5, '#d9b262'], [1, '#8a6225']], 1, 1)}
${grad(`${u}-jade`, [[0, '#9fe0c4'], [1, '#146a4c']], 1, 1)}
${grad(`${u}-bg`, [[0, '#123f31'], [1, '#07201a']])}
<radialGradient id="${u}-rim" cx=".5" cy=".3" r=".75"><stop offset="0" stop-color="#e9cf8e" stop-opacity=".28"/><stop offset="1" stop-color="#e9cf8e" stop-opacity="0"/></radialGradient>
${f.defs}${h.defs}${k.defs}`;
  return { defs, back: h.back, neck: f.neck, body: k.body, front: f.face + '\n' + h.front };
}

// Head and shoulders in a 200×240 box: the seat portrait. frame=false leaves out the card (background, name, border).
export function bust(key, { frame = true, title = true, border: edge = true, view = '0 0 200 240' } = {}) {
  const c = CAST[key] ?? CAST.qingque, u = `ja${++seq}`, p = parts(c, u);
  const bg = frame ? `<rect width="200" height="240" fill="url(#${u}-bg)"/><rect width="200" height="240" fill="url(#${u}-rim)"/>${blossoms(u, [[22, 40, 7, .5], [176, 30, 5, .4], [182, 150, 8, .35], [16, 170, 6, .3], [160, 96, 3.5, .45], [34, 108, 3, .4]])}` : '';
  const plate = frame && title ? `<path d="M0 204H200V240H0Z" fill="#06180f" opacity=".72"/><text x="100" y="228" text-anchor="middle" font-family="'BiauKai','Kaiti TC','DFKai-SB','Noto Serif TC','Songti TC',serif" font-size="18" letter-spacing="6" fill="#f3dfaa">${c.name}</text>` : '';
  const border = frame && edge ? `<rect x="1.5" y="1.5" width="197" height="237" rx="13" fill="none" stroke="url(#${u}-gold)" stroke-width="3"/>` : '';
  return `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}"><defs>${p.defs}<clipPath id="${u}-frame"><rect width="200" height="240" rx="${frame ? 14 : 0}"/></clipPath></defs><g clip-path="url(#${u}-frame)">${bg}${p.back}${p.body}${p.neck}${p.front}${plate}</g>${border}</svg>`;
}

// Knee-up standing figure for the lobby and the result screen; drawn in ./art/garment.mjs around this character's head.
export function figure(key = 'qingque') {
  const c = CAST[key] ?? CAST.qingque, u = `jf${++seq}`;
  return figureSvg(c, u, parts(c, u));
}

// Lobby backdrop, 1600×900 (use preserveAspectRatio slice): a moonlit garden seen from an engawa. Jade night sky warming to gold
// at the horizon, layered mountains in mist, a pagoda on the far hill, ivory blossom boughs framing the top, and the veranda floor. Blossom placement uses a fixed seed so every visit draws the same garden.
export function scene() {
  const u = `js${++seq}`;
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const petal = (x, y, r, a) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(rnd() * 72).toFixed(0)})" opacity="${a.toFixed(2)}">${[0, 72, 144, 216, 288].map(t => `<ellipse cy="${(-r * .6).toFixed(1)}" rx="${(r * .44).toFixed(1)}" ry="${(r * .62).toFixed(1)}" transform="rotate(${t})" fill="#f7f0dc"/>`).join('')}<circle r="${(r * .22).toFixed(1)}" fill="#d9b262"/></g>`;
  // A bough is a tapered branch path plus clusters of blossoms along it.
  function bough(points, width, count) {
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
    let out = `<path d="${d}" stroke="#0a1a14" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="${d}" stroke="#2c4a3c" stroke-width="${width * .3}" stroke-linecap="round" fill="none" opacity=".5" transform="translate(-1 -2)"/>`;
    for (let i = 0; i < count; i++) {
      const k = rnd() * (points.length - 1), j = Math.floor(k), f = k - j, [ax, ay] = points[j], [bx, by] = points[j + 1];
      const x = ax + (bx - ax) * f + (rnd() - .5) * 60, y = ay + (by - ay) * f + (rnd() - .5) * 44;
      out += petal(x, y, 7 + rnd() * 9, .55 + rnd() * .45);
    }
    return out;
  }
  const falling = Array.from({ length: 26 }, () => petal(rnd() * 1600, 120 + rnd() * 640, 4 + rnd() * 6, .35 + rnd() * .5)).join('');
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
${grad(`${u}-sky`, [[0, '#051c16'], [.45, '#0d3a2e'], [.78, '#2f5e49'], [1, '#b99a58']])}
${grad(`${u}-far`, [[0, '#2d5a4a'], [1, '#1a3c31']])}
${grad(`${u}-mid`, [[0, '#18392e'], [1, '#0d241d']])}
${grad(`${u}-floor`, [[0, '#1d1a12'], [1, '#0b0a07']])}
${grad(`${u}-mist`, [[0, '#dfe9d8', 0], [.5, '#dfe9d8', .16], [1, '#dfe9d8', 0]])}
<radialGradient id="${u}-moon" cx=".5" cy=".5" r=".5"><stop offset=".62" stop-color="#fbf5e1"/><stop offset=".7" stop-color="#f3e3b4" stop-opacity=".35"/><stop offset="1" stop-color="#f3e3b4" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}-pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f1c56c" stop-opacity=".35"/><stop offset="1" stop-color="#f1c56c" stop-opacity="0"/></radialGradient>
<filter id="${u}-haze"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
<rect width="1600" height="900" fill="url(#${u}-sky)"/>
${Array.from({ length: 60 }, () => `<circle cx="${(rnd() * 1600).toFixed(0)}" cy="${(rnd() * 380).toFixed(0)}" r="${(.6 + rnd() * 1.2).toFixed(1)}" fill="#f4ecd2" opacity="${(.25 + rnd() * .5).toFixed(2)}"/>`).join('')}
<circle cx="780" cy="220" r="150" fill="url(#${u}-moon)"/><circle cx="750" cy="200" r="16" fill="#e9dfc2" opacity=".35"/><circle cx="810" cy="246" r="10" fill="#e9dfc2" opacity=".3"/>
<path d="M0 560L140 470 260 520 420 420 560 500 700 440 860 520 1000 430 1160 500 1320 410 1460 480 1600 440V900H0Z" fill="url(#${u}-far)" opacity=".85"/>
<rect y="470" width="1600" height="120" fill="url(#${u}-mist)" filter="url(#${u}-haze)"/>
<g transform="translate(900 392) scale(.8)" fill="#10281f"><path d="M-6 0V-160M6 0V-160" stroke="#10281f" stroke-width="4"/>${[0, 1, 2, 3, 4].map(i => `<path d="M${-70 + i * 9} ${-i * 34}Q0 ${-i * 34 - 18} ${70 - i * 9} ${-i * 34}L${56 - i * 9} ${-i * 34 - 12}H${-56 + i * 9}Z"/><rect x="${-40 + i * 7}" y="${-i * 34 - 32}" width="${80 - i * 14}" height="22"/><rect x="${-10 + i}" y="${-i * 34 - 26}" width="${20 - i * 2}" height="10" fill="#f1c56c" opacity=".7"/>`).join('')}<path d="M-3-170V-210M3-170V-210" stroke="#10281f" stroke-width="3"/></g>
<path d="M0 640L180 560 340 610 520 540 700 620 880 560 1060 630 1240 560 1420 620 1600 580V900H0Z" fill="url(#${u}-mid)"/>
<rect y="600" width="1600" height="90" fill="url(#${u}-mist)" filter="url(#${u}-haze)" opacity=".8"/>
<path d="M0 700H1600V900H0Z" fill="url(#${u}-floor)"/>
${Array.from({ length: 13 }, (_, i) => `<path d="M${-200 + i * 160} 900L${160 + i * 110} 700" stroke="#3a3223" stroke-width="2" opacity=".6"/>`).join('')}
<path d="M0 700H1600" stroke="#c9a04e" stroke-width="3" opacity=".7"/><path d="M0 708H1600" stroke="#000" stroke-width="10" opacity=".35"/>
<ellipse cx="780" cy="740" rx="420" ry="50" fill="url(#${u}-pool)" opacity=".7"/>
<path d="M0 0H1600V40H0Z" fill="#050f0b"/><path d="M0 40H1600" stroke="#c9a04e" stroke-width="2" opacity=".55"/>
${bough([[-20, 60], [120, 110], [260, 130], [380, 190], [470, 200]], 16, 70)}${bough([[140, 112], [180, 190], [150, 260]], 8, 22)}
${bough([[1620, 90], [1500, 120], [1400, 180], [1330, 190]], 14, 55)}${bough([[1480, 126], [1520, 220], [1490, 300]], 7, 18)}
${falling}
</svg>`;
}
