// 青雀 character art: original SVG portraits built from one parametric construction, in the table's jade, gold and ivory.
// Every call gets its own id prefix so several portraits can share one document without gradient clashes.
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

const grad = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;

// Fabric motifs are real <pattern>s, drawn in the band colour at low contrast so they read as woven, not printed on top.
function motif(u, c) {
  const ink = c.band, id = `${u}-fab`;
  const body = {
    wave: `<g fill="none" stroke="${ink}" stroke-opacity=".4" stroke-width="1.1">${[0, 1].map(r => [0, 1, 2].map(k => `<path d="M${k * 20 - (r ? 10 : 0)} ${14 + r * 10}a10 10 0 0 1 20 0M${k * 20 + 4 - (r ? 10 : 0)} ${14 + r * 10}a6 6 0 0 1 12 0"/>`).join('')).join('')}</g><path d="M31 5l2.6 1.4-2.6 1.4-1-1.4z" fill="${ink}" fill-opacity=".8"/>`,
    hemp: `<g fill="none" stroke="${ink}" stroke-opacity=".5" stroke-width=".8"><path d="M0 0L12 7 24 0M12 7V21M0 28L12 21 24 28M0 0V28M24 0V28M0 14H6M18 14H24"/></g>`,
    bamboo: `<g fill="${ink}" fill-opacity=".45"><path d="M4 30C8 18 13 11 22 6 15 13 11 21 9 31z"/><path d="M14 32C20 25 26 22 33 21 27 25 22 29 17 34z"/></g><path d="M30 0V36" stroke="${ink}" stroke-opacity=".3" stroke-width="2"/>`,
    ridge: `<g fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width="1"><path d="M0 22L9 12 15 18 24 6 34 20 40 16"/><path d="M0 32L10 26 18 30 27 22 40 30" stroke-opacity=".3"/></g>`
  }[c.motif];
  const size = { wave: [40, 26], hemp: [24, 28], bamboo: [36, 36], ridge: [40, 36] }[c.motif];
  return `<pattern id="${id}" width="${size[0]}" height="${size[1]}" patternUnits="userSpaceOnUse" patternTransform="rotate(-8) scale(.62)">${body}</pattern>`;
}

// Hair: the fringe is one mass whose lower edge alternates tips and shallow valleys; from each valley a parting line runs up
// towards the crown, which is what makes it read as separate locks. Side locks frame the cheeks; the back mass sits behind.
const r1 = n => Math.round(n * 10) / 10;
function fringe(tips) {
  // tips: [x, y, bend] left to right; valleys sit between neighbours, 9-14px above the shorter tip.
  const pts = [];
  tips.forEach(([x, y, bend], i) => {
    if (i) { const [px, py] = tips[i - 1]; pts.push({ x: (px + x) / 2 + (bend + tips[i - 1][2]) * .25, y: Math.min(py, y) - 10 - Math.abs(py - y) * .3, valley: true }); }
    pts.push({ x, y, bend });
  });
  const [first, last] = [tips[0], tips.at(-1)];
  let d = `M${first[0] - 6} ${first[1] - 18}C${first[0] - 12} 50 70 22 100 22S${last[0] + 12} 50 ${last[0] + 6} ${last[1] - 18}Q${last[0] + 3} ${last[1] - 6} ${last[0]} ${last[1]}`;
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i + 1], b = pts[i], bend = (a.bend ?? b.bend ?? 0);
    d += `Q${r1((a.x + b.x) / 2 + bend * .5)} ${r1((a.y + b.y) / 2)} ${r1(b.x)} ${r1(b.y)}`;
  }
  d += `Q${first[0] - 5} ${first[1] - 7} ${first[0] - 6} ${first[1] - 18}Z`;
  const partings = pts.filter(p => p.valley).map(p => `M${r1(p.x)} ${r1(p.y)}Q${r1(p.x + (p.x - 100) * .08)} ${r1(p.y - 18)} ${r1(100 + (p.x - 100) * .55)} ${r1(p.y - 34)}`);
  const glints = tips.filter((_, i) => i % 2 && i < tips.length - 1).map(([x, y, bend]) => `M${r1(x - bend * .6 + (100 - x) * .06)} ${r1(y - 30)}Q${r1(x - bend * .3)} ${r1(y - 24)} ${r1(x - bend * .1)} ${r1(y - 17)}`);
  return { fringe: d, partings, glints };
}
const HAIR = {
  bob: {
    back: 'M42 100C34 50 66 22 100 22S166 50 158 100C162 128 160 152 152 170Q146 164 140 168Q134 160 126 164L74 164Q66 160 60 168Q54 164 48 170C40 152 38 128 42 100Z',
    tips: [[54, 104, -6], [66, 96, -5], [79, 92, -4], [92, 88, -2], [104, 90, 3], [117, 93, 5], [130, 96, 6], [146, 104, 7]],
    side: ['M58 80C44 108 46 140 60 164Q58 142 66 124Q61 104 64 86Z', 'M142 80C156 108 154 140 140 164Q142 142 134 124Q139 104 136 86Z']
  },
  long: {
    back: 'M40 100C32 50 66 22 100 22S168 50 160 100C166 150 174 200 182 240L18 240C26 200 34 150 40 100Z',
    tips: [[53, 108, -7], [65, 99, -6], [78, 93, -4], [91, 90, -2], [101, 96, 1], [112, 91, 3], [125, 95, 5], [138, 100, 7], [148, 110, 8]],
    side: ['M58 80C42 124 46 180 50 236Q60 186 62 138Q60 104 64 86Z', 'M142 80C158 124 154 180 150 236Q140 186 138 138Q140 104 136 86Z']
  },
  ponytail: {
    back: 'M46 98C40 52 68 26 100 26S160 52 154 98C156 118 154 134 148 146Q140 138 132 144Q124 136 116 142L84 142Q76 136 68 144Q60 138 52 146C46 134 44 118 46 98Z',
    tail: 'M130 36C160 20 186 42 182 80C180 120 186 170 198 214C178 192 166 152 162 112C160 82 152 58 130 52Z',
    tips: [[55, 100, -6], [68, 92, -5], [82, 87, -3], [97, 85, 2], [111, 88, 4], [125, 92, 6], [140, 98, 7], [148, 106, 7]],
    side: ['M60 80C50 102 52 126 60 146Q60 128 66 114Q62 100 64 86Z', 'M140 80C150 102 148 126 140 146Q140 128 134 114Q138 100 136 86Z']
  },
  wave: {
    back: 'M38 100C30 50 66 22 100 22S170 50 162 100C174 134 164 160 176 196C184 214 180 230 184 240L16 240C20 230 16 214 24 196C36 160 26 134 38 100Z',
    tips: [[52, 106, -8], [66, 96, -7], [82, 88, -5], [96, 84, 2], [112, 88, 7], [128, 94, 9], [146, 104, 10]],
    side: ['M58 80C40 114 50 144 42 178C38 202 46 222 52 238Q64 208 60 178Q66 142 64 110Q62 96 64 86Z', 'M142 80C160 114 150 144 158 178C162 202 154 222 148 238Q136 208 140 178Q134 142 136 110Q138 96 136 86Z']
  }
};
for (const h of Object.values(HAIR)) Object.assign(h, fringe(h.tips));

// Hair ornaments: each is a small crafted object with its own light, pinned at the right temple.
function accessory(u, c) {
  switch (c.acc) {
    case 'sparrow': return `<g transform="translate(138 52) rotate(18)"><path d="M0 0C6-10 20-12 28-4C22-3 18 0 16 5C12 3 6 3 0 0Z" fill="url(#${u}-gold)"/><path d="M16 5C18 10 16 16 10 18C12 12 10 8 6 6Z" fill="#b8893a"/><circle cx="21" cy="-5" r="1.4" fill="#2a1a0c"/><path d="M28-4l5 1-5 2z" fill="#9c6e28"/></g><g stroke="#c9a04e" stroke-width=".9"><path d="M146 60V86M151 58V80M141 62V78"/></g><g fill="url(#${u}-jade)"><circle cx="146" cy="88" r="2.6"/><circle cx="151" cy="82" r="2.2"/><circle cx="141" cy="80" r="2"/></g>`;
    case 'moon': return `<g transform="translate(142 46)"><path d="M0 0A14 14 0 1 0 14 18 11 11 0 1 1 0 0Z" fill="url(#${u}-gold)"/><circle cx="16" cy="4" r="2" fill="#fff8e0"/></g><g stroke="#d7c38e" stroke-width=".8"><path d="M150 68V96M155 66V88"/></g><circle cx="150" cy="98" r="2.4" fill="#f4f1e6"/><circle cx="155" cy="90" r="2" fill="#f4f1e6"/>`;
    case 'mask': return `<g transform="translate(134 30) rotate(24)"><path d="M0 12C0 0 8-6 14-4L18-14 22-2C28-2 34 4 34 14C34 26 26 34 17 34S0 26 0 12Z" fill="#fbf7ec" stroke="#cdbf9d" stroke-width=".8"/><path d="M6 14Q10 10 13 14M21 14Q24 10 28 14" stroke="#b8322b" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M15 24Q17 27 19 24" stroke="#1c1c1c" stroke-width="1" fill="none"/><path d="M14-4L18-11 21-3" fill="#e0a8a0" fill-opacity=".6"/><path d="M4 20Q8 22 10 19M30 20Q26 22 24 19" stroke="#b8322b" stroke-width="1.2" fill="none"/></g><path d="M126 50C132 44 138 44 142 48" stroke="#b8322b" stroke-width="2.2" fill="none"/>`;
    case 'jade': return `<path d="M128 40L160 70" stroke="url(#${u}-gold)" stroke-width="2.4" stroke-linecap="round"/><circle cx="128" cy="40" r="5" fill="url(#${u}-jade)"/><circle cx="126.5" cy="38.5" r="1.6" fill="#e7fff4" fill-opacity=".8"/><path d="M154 64l6 12M158 62l7 9" stroke="#c9a45a" stroke-width=".8"/><circle cx="160" cy="77" r="2" fill="url(#${u}-jade)"/><circle cx="165" cy="72" r="1.7" fill="url(#${u}-jade)"/>`;
  }
  return '';
}

// One eye, drawn for the viewer's left; the right eye mirrors it. The iris glows from the lower centre out to a dark rim, the upper lid
// casts a soft shadow into it, and the lash line is a filled, tapered shape in warm near-black with a few flicks at the outer corner.
// lids lowers the upper lid (calmer, sleepier); tilt turns the eye so the outer corner rises (sharper) or falls (gentler).
function eye(u, c) {
  const d = c.lids * 7, top = 86 + d, t = c.tilt || 0;
  return `<g transform="rotate(${-t} 82 100)"><path d="M67 ${r1(98 + d * .6)}Q80 ${r1(top)} 95 ${r1(95 + d * .4)}Q93 110 81 112.5Q70 111 67 ${r1(98 + d * .6)}Z" fill="url(#${u}-white)"/>
<g clip-path="url(#${u}-eyeclip)"><ellipse cx="81.5" cy="102" rx="10.4" ry="12.4" fill="url(#${u}-irisR)"/><ellipse cx="81.5" cy="102" rx="10.4" ry="12.4" fill="url(#${u}-iris)" opacity=".55"/>
<ellipse cx="81.5" cy="102" rx="10.4" ry="12.4" fill="none" stroke="${c.eye[0]}" stroke-width="1.4" opacity=".75"/><ellipse cx="81.5" cy="102.5" rx="6.6" ry="8" fill="none" stroke="${c.eye[1]}" stroke-width=".6" opacity=".5"/>
<ellipse cx="81.5" cy="102" rx="3.5" ry="5.6" fill="${c.eye[0]}"/><path d="M72.5 106.5Q81.5 116 90.5 106.5Q81.5 111.5 72.5 106.5Z" fill="${c.eye[2]}" opacity=".95"/>
<circle cx="76.5" cy="108" r=".8" fill="#fff" opacity=".85"/><circle cx="87" cy="104" r=".6" fill="#fff" opacity=".7"/><circle cx="84" cy="109.5" r=".5" fill="${c.eye[2]}"/>
<path d="M60 ${r1(89 + d)}Q80 ${r1(83 + d)} 100 ${r1(91 + d)}V${r1(101 + d)}Q80 ${r1(93 + d)} 60 ${r1(99 + d)}Z" fill="${c.eye[0]}" opacity=".55" filter="url(#${u}-soft)"/></g>
<ellipse cx="77" cy="${r1(97 + d * .4)}" rx="3.3" ry="4.1" transform="rotate(-24 77 ${r1(97 + d * .4)})" fill="#fff"/><circle cx="86.8" cy="106.8" r="1.7" fill="#fff" opacity=".95"/>
<path d="M64 ${r1(99.5 + d * .6)}Q71 ${r1(top - 2.2)} 82 ${r1(top - 1.6)}Q91.5 ${r1(top - 1)} 97.5 ${r1(94 + d * .4)}Q90.5 ${r1(top + 2.6)} 81 ${r1(top + 2.8)}Q71 ${r1(top + 4)} 64 ${r1(99.5 + d * .6)}Z" fill="url(#${u}-lash)"/>
<path d="M65 ${r1(99 + d * .6)}Q60.5 ${r1(97.5 + d * .5)} 56.5 ${r1(93.5 + d * .5)}Q61 ${r1(95 + d * .5)} 66.5 ${r1(96 + d * .5)}Z" fill="${c.line}"/>
<path d="M66 ${r1(95.5 + d * .5)}Q62.5 ${r1(91.5 + d * .5)} 60.5 ${r1(89.8 + d * .5)}M68.5 ${r1(92.5 + d * .6)}Q66.5 ${r1(88.5 + d * .6)} 65 ${r1(87 + d * .6)}" stroke="${c.line}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<path d="M68.5 ${r1(89.5 + d)}Q80 ${r1(81.5 + d)} 93 ${r1(87.5 + d)}" stroke="#8a4a3c" stroke-width=".9" fill="none" opacity=".55"/>
<path d="M73.5 111.8Q81 114.6 88.5 111.2" stroke="#b57b6c" stroke-width="1" fill="none"/><path d="M88 111.3Q91.2 110 93 107.6" stroke="${c.line}" stroke-width="1" fill="none" opacity=".7"/><path d="M76 112.4l-.6 1.6M79.5 113.1l-.3 1.6" stroke="#8a5a4c" stroke-width=".6" opacity=".7"/></g>`;
}

const MOUTH = {
  open: '<path d="M95 126Q100 132 105 126Q100 127.6 95 126Z" fill="#8a3a3c"/><path d="M97.2 128.8Q100 130.6 102.8 128.8Q100 129.4 97.2 128.8Z" fill="#e58d88"/><path d="M94.2 125.9Q100 127.4 105.8 125.9" stroke="#96504c" stroke-width="1" fill="none" stroke-linecap="round"/>',
  smile: '<path d="M93 127Q100 132.5 107 127" stroke="#a4524d" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M96 129.2Q100 131 104 129.2" stroke="#e79b92" stroke-width="1.2" fill="none" opacity=".7"/>',
  calm: '<path d="M95 128Q100 130 105 128" stroke="#a4524d" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  smirk: '<path d="M94 128Q100 129.5 107 125.5" stroke="#a4524d" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
};

// Five-petal ivory blossoms (the palette's stand-in for sakura), blurred to sit behind the figure as out-of-focus light.
function blossoms(u, list, blur = true) {
  return list.map(([x, y, r, a], i) => `<g transform="translate(${x} ${y}) rotate(${i * 37})" opacity="${a}"${blur ? ` filter="url(#${u}-soft)"` : ''}>${[0, 72, 144, 216, 288].map(t => `<ellipse cx="0" cy="${-r * .62}" rx="${r * .42}" ry="${r * .62}" transform="rotate(${t})" fill="#fbf4e2"/>`).join('')}<circle r="${r * .22}" fill="#e2bf6e"/></g>`).join('');
}

// The head in the portrait's 200×240 space, split into layers so a caller can put clothing between them:
// back (ponytail and back hair), neck, and front (face, eyes, fringe, side locks, ornaments).
function parts(c, u) {
  const h = HAIR[c.style];
  const defs = `
${grad(`${u}-hair`, [[0, c.hair[0]], [.45, c.hair[1]], [1, c.hair[2]]])}
${grad(`${u}-skin`, [[0, c.skin[0]], [1, c.skin[1]]])}
${grad(`${u}-iris`, [[0, c.eye[0]], [.55, c.eye[1]], [1, c.eye[2]]])}
${grad(`${u}-kim`, [[0, c.kimono[0]], [1, c.kimono[1]]])}
${grad(`${u}-gold`, [[0, '#fff0c0'], [.5, '#d9b262'], [1, '#8a6225']], 1, 1)}
${grad(`${u}-jade`, [[0, '#9fe0c4'], [1, '#146a4c']], 1, 1)}
${grad(`${u}-bg`, [[0, '#123f31'], [1, '#07201a']])}
${grad(`${u}-sheen`, [[0, c.sheen, 0], [.5, c.sheen, .55], [1, c.sheen, 0]], 1, 0)}
<filter id="${u}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter><filter id="${u}-soft3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<radialGradient id="${u}-irisR" cx=".5" cy=".64" r=".62"><stop offset="0" stop-color="${c.eye[2]}"/><stop offset=".5" stop-color="${c.eye[1]}"/><stop offset="1" stop-color="${c.eye[0]}"/></radialGradient>
${grad(`${u}-lash`, [[0, '#6a3a30'], [.35, c.line], [1, c.line]], 1, 0)}
${grad(`${u}-neck`, [[0, c.skin[2], .55], [.45, c.skin[2], .1], [1, c.skin[2], 0]])}${grad(`${u}-hl`, [[0, '#ffe3ad', 0], [.6, '#ffe3ad', 0], [.97, '#ffe3ad', .32], [1, '#ffe3ad', .1]], 1, 0)}${grad(`${u}-hlF`, [[0, '#ffe3ad', 0], [.7, '#ffe3ad', 0], [1, '#ffe3ad', .2]], 1, 0)}
<radialGradient id="${u}-blush"><stop offset="0" stop-color="#f08f86" stop-opacity=".55"/><stop offset="1" stop-color="#f08f86" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}-rim" cx=".5" cy=".3" r=".75"><stop offset="0" stop-color="#e9cf8e" stop-opacity=".28"/><stop offset="1" stop-color="#e9cf8e" stop-opacity="0"/></radialGradient>
${motif(u, c)}
<clipPath id="${u}-eyeclip"><path d="M67 ${r1(98 + c.lids * 4.2)}Q80 ${r1(86 + c.lids * 7)} 95 ${r1(95 + c.lids * 2.8)}Q93 110 81 112.5Q70 111 67 ${r1(98 + c.lids * 4.2)}Z"/></clipPath>
${grad(`${u}-white`, [[0, '#e9e4e6'], [.4, '#fffdfb'], [1, '#ffffff']])}
<clipPath id="${u}-fringeclip"><path d="${h.fringe}"/></clipPath>
`;
  const face = 'M58 84C57 104 63 121 80 134Q92 144 100 146Q108 144 120 134C137 121 143 104 142 84C142 56 58 56 58 84Z';
  // Zigzag lower edge for the fringe's band of shine (the classic ring of light across anime hair).
  const zig = Array.from({ length: 16 }, (_, i) => `L${154 - i * 7.5} ${i % 2 ? 60 : 66}`).join('');
  const shoulders = 'M4 240C8 198 34 174 70 164Q80 160 88 154L112 154Q120 160 130 164C166 174 192 198 196 240Z';
  const body = `<path d="${shoulders}" fill="url(#${u}-kim)"/>
<path d="${shoulders}" fill="url(#${u}-fab)"/>
<path d="M86 154L100 196 114 154" fill="${c.collar}"/>
<path d="M115 153L100 196 95.5 186 108 153Z" fill="${c.band}" opacity=".95"/><path d="M85 153L95.5 186 92 196 77 157Z" fill="${c.band}" opacity=".7"/>
<path d="M100 196L115 153 126 157 104 206Z" fill="${c.kimono[1]}" opacity=".55"/>
<path d="M28 240C32 214 46 194 66 180" stroke="${c.kimono[1]}" stroke-width="2.4" fill="none" opacity=".7"/><path d="M172 240C168 214 154 194 134 180" stroke="${c.kimono[1]}" stroke-width="2.4" fill="none" opacity=".7"/><path d="M70 166Q58 172 48 188" stroke="#fff" stroke-width="3" fill="none" opacity=".12"/>`;
  const neck = `<path d="M90 128L110 128 112 160Q100 168 88 160Z" fill="url(#${u}-skin)"/><path d="M90 128L110 128 112 160Q100 168 88 160Z" fill="url(#${u}-neck)"/><path d="M90 136Q100 146 110 136L110.5 141Q100 151 89.5 141Z" fill="${c.skin[2]}" opacity=".35"/>`;
  const brows = `<path d="M70 83Q80 78 90 81" stroke="${c.hair[2]}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/><path d="M130 83Q120 78 110 81" stroke="${c.hair[2]}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>`;
  const back = `${h.tail ? `<path d="${h.tail}" fill="url(#${u}-hair)"/><path d="M136 36Q158 30 170 52" stroke="${c.sheen}" stroke-width="3" fill="none" opacity=".35"/><path d="M128 38Q134 30 142 36" stroke="#b8322b" stroke-width="5" stroke-linecap="round"/>` : ''}
<path d="${h.back}" fill="url(#${u}-hair)" stroke="${c.line}" stroke-width=".9"/><path d="${h.back}" fill="url(#${u}-hl)"/>`;
  const front = `<path d="${face}" fill="url(#${u}-skin)" stroke="#b27766" stroke-width=".9"/>
<path d="M58 86C57 104 64 122 82 134L86 127C72 117 65 104 65 88Z" fill="${c.skin[2]}" opacity=".45" filter="url(#${u}-soft3)"/><path d="M120 136Q100 146 84 134L90 131Q100 139 116 130Z" fill="${c.skin[2]}" opacity=".4" filter="url(#${u}-soft)"/>
<ellipse cx="74" cy="118" rx="11" ry="5.5" fill="url(#${u}-blush)"/><ellipse cx="126" cy="118" rx="11" ry="5.5" fill="url(#${u}-blush)"/><g stroke="#e27f79" stroke-width=".7" opacity=".55"><path d="M68 117l2-3M71.5 117.5l2-3M75 118l2-3"/><path d="M124 117.5l2-3M127.5 117.5l2-3M131 117l2-3"/></g>
${eye(u, c)}<g transform="translate(200 0) scale(-1 1)">${eye(u, c)}</g>
${brows}
<path d="M100.5 114.5L98.6 119.6L100.6 119.9" stroke="#c28a78" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="101.6" cy="118.4" r=".9" fill="#fff" opacity=".7"/>${c.mole ? '<circle cx="125" cy="116" r=".95" fill="#5a3a34"/>' : ''}
${MOUTH[c.mouth]}
<path d="${h.fringe}" fill="${c.skin[2]}" opacity=".3" transform="translate(1 3.5)"/>
${h.side.map(d => `<path d="${d}" fill="url(#${u}-hair)" stroke="${c.line}" stroke-width=".8"/>`).join('')}
${c.ahoge ? `<path d="M99.5 26C97 13 106 5 116 7C108.5 9 102.5 14 102 26Z" fill="url(#${u}-hair)" stroke="${c.line}" stroke-width=".7"/>` : ''}
<path d="${h.fringe}" fill="url(#${u}-hair)" stroke="${c.line}" stroke-width=".8"/><path d="${h.fringe}" fill="url(#${u}-hlF)"/>${h.side.map(d => `<path d="${d}" fill="url(#${u}-hl)"/>`).join('')}
<g stroke="${c.hair[1]}" stroke-width=".7" fill="none" opacity=".8" stroke-linecap="round"><path d="M54 98Q46 118 50 136"/><path d="M146 98Q156 116 151 132"/><path d="M62 40Q50 44 44 56"/></g>
<g clip-path="url(#${u}-fringeclip)">${h.tips.map(([x, y], i) => `<path d="M${r1(100 + (x - 100) * .4)} ${r1(y - 44)}Q${r1(x + (i % 2 ? 2 : -2))} ${r1(y - 22)} ${r1(x + (100 - x) * .05)} ${r1(y - 7)}" stroke="${c.sheen}" stroke-width=".6" fill="none" opacity=".3"/>`).join('')}${h.partings.map(d => `<path d="${d}" stroke="${c.hair[2]}" stroke-width="1.3" fill="none" opacity=".7"/>`).join('')}<path d="M44 48Q100 20 156 48L156 60${zig}L44 60Z" fill="${c.sheen}" opacity=".2"/><path d="M62 50Q84 32 100 31M110 32Q126 36 138 50" stroke="${c.sheen}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".3"/>${h.glints.map(d => `<path d="${d}" stroke="${c.sheen}" stroke-width="1.7" stroke-linecap="round" fill="none" opacity=".4"/>`).join('')}</g>
${accessory(u, c)}`;
  return { defs, back, neck, body, front };
}


// Head and shoulders in a 200×240 box: the seat portrait. frame=false leaves out the card (background, name, border).
export function bust(key, { frame = true, title = true, border: edge = true, view = '0 0 200 240' } = {}) {
  const c = CAST[key] ?? CAST.qingque, u = `ja${++seq}`, p = parts(c, u);
  const bg = frame ? `<rect width="200" height="240" fill="url(#${u}-bg)"/><rect width="200" height="240" fill="url(#${u}-rim)"/>${blossoms(u, [[22, 40, 7, .5], [176, 30, 5, .4], [182, 150, 8, .35], [16, 170, 6, .3], [160, 96, 3.5, .45], [34, 108, 3, .4]])}` : '';
  const plate = frame && title ? `<path d="M0 204H200V240H0Z" fill="#06180f" opacity=".72"/><text x="100" y="228" text-anchor="middle" font-family="'BiauKai','Kaiti TC','DFKai-SB','Noto Serif TC','Songti TC',serif" font-size="18" letter-spacing="6" fill="#f3dfaa">${c.name}</text>` : '';
  const border = frame && edge ? `<rect x="1.5" y="1.5" width="197" height="237" rx="13" fill="none" stroke="url(#${u}-gold)" stroke-width="3"/>` : '';
  return `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}"><defs>${p.defs}<clipPath id="${u}-frame"><rect width="200" height="240" rx="${frame ? 14 : 0}"/></clipPath></defs><g clip-path="url(#${u}-frame)">${bg}${p.back}${p.body}${p.neck}${p.front}${plate}</g>${border}</svg>`;
}

// Knee-up standing figure in a 600×900 box for the lobby: furisode whose long sleeves hang from the forearms, a gold obi at the
// waist, the left hand resting at the obi and the right raised to the chest with a tile. Light comes from the upper right.
export function figure(key = 'qingque') {
  const c = CAST[key] ?? CAST.qingque, u = `jf${++seq}`, p = parts(c, u);
  const head = 'translate(292 244) rotate(-4) scale(1.65) translate(-100 -160)';
  const kim = `url(#${u}-kimL)`, fab = `url(#${u}-fab)`, lit = `url(#${u}-lit)`;
  const shape = (d, extra = '') => `<path d="${d}" fill="${kim}"/><path d="${d}" fill="${fab}"/><path d="${d}" fill="${lit}"/>${extra}<path d="${d}" fill="none" stroke="#021410" stroke-width="2.2" stroke-linejoin="round" opacity=".9"/>`;
  const torso = 'M268 238C246 250 222 262 204 282C200 330 206 372 214 392L372 392C380 370 388 330 384 280C366 262 340 250 316 238Z';
  const skirt = 'M212 440C204 560 206 740 222 900L386 900C398 740 400 560 380 440Z';
  const sleeveL = 'M208 282C180 300 166 360 164 432C160 524 160 640 168 742Q214 770 266 748C270 660 266 560 258 470C248 452 234 446 226 440C222 380 220 320 208 282Z';
  const upperR = 'M380 278C406 292 422 340 422 398L398 404C394 362 384 322 366 292Z';
  const drapeR = 'M356 316L420 400C432 484 436 604 430 708Q384 736 336 716C332 604 338 460 356 316Z';
  const foreR = 'M398 408L432 388 376 298 344 318Z';
  const cuffR = 'M338 318C334 306 346 294 360 294C372 294 380 302 378 310C376 318 366 324 354 326C346 326 340 324 338 318Z';
  const flowers = (list, clip) => `<g clip-path="url(#${u}-${clip})">` + list.map(([x, y, r, rot]) => `<g transform="translate(${x} ${y}) rotate(${rot})">${[0, 72, 144, 216, 288].map(t => `<ellipse cx="0" cy="${-r * .6}" rx="${r * .42}" ry="${r * .6}" transform="rotate(${t})" fill="#f6efdc"/>`).join('')}<circle r="${r * .24}" fill="#d9b262"/>${[0, 72, 144, 216, 288].map(t => `<path d="M0 0V${-r * .5}" transform="rotate(${t + 36})" stroke="#c9a04e" stroke-width=".8"/>`).join('')}</g>`).join('') + '</g>';
  const stream = (x, y, w) => `<path d="M${x} ${y}c${w * .2}-12 ${w * .4} 12 ${w * .6} 0s${w * .3}-10 ${w * .4} 2" stroke="${c.band}" stroke-width="2" fill="none" opacity=".6"/>`;
  const fold = d => `<path d="${d}" stroke="#021510" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"/>`;
  return `<svg viewBox="0 -30 600 930" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}立繪"><defs>${p.defs}
${grad(`${u}-kimL`, [[0, c.kimono[0]], [.6, c.kimono[1]], [1, '#05261c']])}
${grad(`${u}-lit`, [[0, '#000', .28], [.55, '#000', 0], [1, '#dff3e6', .16]], 1, 0)}
${grad(`${u}-obi`, [[0, '#f3dc9c'], [.45, '#d4aa56'], [1, '#8f6a2b']])}
${grad(`${u}-lining`, [[0, '#f5eed8'], [1, '#d8cba2']])}
${grad(`${u}-tile`, [[0, '#fffdf1'], [1, '#e7e2cc']])}
<clipPath id="${u}-cl"><path d="${sleeveL}"/></clipPath><clipPath id="${u}-cs"><path d="${skirt}"/></clipPath><clipPath id="${u}-cr"><path d="${drapeR}"/></clipPath>
</defs>
<g transform="${head}">${p.back}</g>
${shape(sleeveL, `<path d="M168 742Q214 770 266 748L265 734Q214 756 169 728Z" fill="url(#${u}-lining)"/>`)}
${flowers([[200, 600, 20, 20], [236, 666, 14, 60], [192, 706, 10, 5]], 'cl')}${stream(170, 650, 90)}${fold('M190 330C182 420 180 560 186 700')}${fold('M232 470C236 560 238 650 236 740')}
${shape(skirt)}
<path d="M292 440C294 600 302 760 312 900" stroke="${c.band}" stroke-width="3" fill="none" opacity=".85"/><path d="M292 440C294 600 302 760 312 900L386 900C398 740 400 560 380 440Z" fill="#000" opacity=".1"/>
${fold('M250 470C246 600 248 760 256 900')}${fold('M350 480C356 620 354 760 348 900')}
${stream(222, 780, 110)}${stream(318, 840, 80)}${flowers([[248, 720, 24, 20], [284, 766, 16, 60], [350, 700, 20, 5], [244, 862, 28, 45], [362, 818, 15, 30]], 'cs')}
${shape(torso)}
<g transform="${head}">${p.neck}</g>
<path d="M270 240L292 350 314 240" fill="${c.collar}"/><path d="M318 238L292 350 285 330 304 238Z" fill="${c.band}"/><path d="M266 240L285 330 279 350 254 248Z" fill="${c.band}" opacity=".75"/>
<path d="M292 350L318 238 334 244 298 364Z" fill="${c.kimono[1]}" opacity=".6"/>
<path d="M210 380Q296 368 378 380L380 392Q296 380 209 392Z" fill="#efe4c2"/>
<path d="M208 390Q296 378 382 390L386 452Q296 440 206 452Z" fill="url(#${u}-obi)"/><path d="M208 390Q296 378 382 390L382 397Q296 385 208 397Z" fill="#fff4cf" opacity=".55"/>
<g fill="none" stroke="#8f6a2b" stroke-width="1.2" opacity=".55">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${226 + i * 28} 404l9 9-9 9-9-9z"/>`).join('')}</g>
<path d="M206 424Q296 412 386 424" stroke="#0f5a41" stroke-width="5" fill="none"/><path d="M206 424Q296 412 386 424" stroke="#7fcaa9" stroke-width="1.4" fill="none" opacity=".6"/>
<circle cx="296" cy="417" r="9" fill="url(#${u}-jade)"/><circle cx="293" cy="414" r="2.8" fill="#e7fff4" opacity=".7"/>
<g transform="${head}">${p.front}</g>
${shape(upperR)}${shape(drapeR, `<path d="M336 716Q384 736 430 708L429 694Q384 720 337 702Z" fill="url(#${u}-lining)"/>`)}
${flowers([[392, 560, 18, 15], [368, 628, 12, 50], [406, 652, 9, 80]], 'cr')}${stream(340, 590, 90)}${fold('M364 380C356 480 352 600 352 700')}${fold('M408 430C414 520 416 620 414 700')}
${shape(foreR)}<path d="M344 318L398 408" stroke="#021510" stroke-width="2" opacity=".4"/><path d="${cuffR}" fill="url(#${u}-lining)"/><path d="M342 316C346 308 356 302 366 304" stroke="#bfae7c" stroke-width="1.4" fill="none"/>
<g transform="rotate(-12 328 262)"><rect x="306" y="228" width="44" height="60" rx="6" fill="url(#${u}-tile)" stroke="#cfc8ad" stroke-width="1.2"/><rect x="306" y="280" width="44" height="10" rx="4" fill="#14704d"/>
<path d="M318 266C320 254 330 248 340 252C334 256 332 262 334 270C328 272 322 270 318 266Z" fill="#12613f"/><path d="M334 270L340 278M328 271L330 280" stroke="#b52027" stroke-width="2" stroke-linecap="round"/><circle cx="336" cy="256" r="1.6" fill="#b52027"/><path d="M340 252l6-2-4 5z" fill="#c9a04e"/></g>
<path d="M322 296C318 284 324 272 332 276C336 284 334 292 330 298Z" fill="url(#${u}-skin)" stroke="${c.skin[2]}" stroke-width="1"/><path d="M333 300C331 288 338 278 346 282C348 290 344 298 340 302Z" fill="url(#${u}-skin)" stroke="${c.skin[2]}" stroke-width="1"/>
</svg>`;
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
