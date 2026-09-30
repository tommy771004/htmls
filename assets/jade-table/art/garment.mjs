// 青雀 art · clothing: the kimono motifs, the portrait's collar and shoulders, and the lobby figure's furisode.
// Layers are SVG strings in the portrait's 200×240 space; u is the per-portrait id prefix, c an entry of CAST.
import { grad, r1 } from './common.mjs';

// Fabric motifs are real <pattern>s, drawn in the band colour at low contrast so they read as woven, not printed on top.
export function motif(u, c) {
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

// Local colour maths: every shade is derived from the CAST entry so 月白's pale kimono and 遠山's dark one both shade in their own hue.
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const P = (x, y) => `${r1(x)} ${r1(y)}`;
// A pointed crescent between the quadratic x0,y0 → cx,cy → x1,y1 and the same curve bowed w to its left (negative w: to its right).
// Every fold, cast shadow, lit edge and rim in this module is one of these, so shadows have crisp anime edges instead of blur.
const cres = (x0, y0, cx, cy, x1, y1, w) => {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  return `M${P(x0, y0)}Q${P(cx, cy)} ${P(x1, y1)}Q${P(cx - dy / l * 2 * w, cy + dx / l * 2 * w)} ${P(x0, y0)}Z`;
};
// A fold that opens toward its end: pointed where the cloth is pinched, w wide where it meets a hem or an edge.
const wedge = (x0, y0, cx, cy, x1, y1, w) => {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w;
  return `M${P(x0, y0)}Q${P(cx, cy)} ${P(x1, y1)}L${P(x1 + nx, y1 + ny)}Q${P(cx + nx * .7, cy + ny * .7)} ${P(x0, y0)}Z`;
};
// Light: one warm key from the viewer's upper right, cool jade ambient. Shadows sit left and under, rims on the right edges.
function tones(c) {
  const [k0, k1] = c.kimono, cool = '#0b2530';
  const lum = rgb(k0).reduce((s, v, i) => s + v * [.3, .59, .11][i], 0) / 255;
  return {
    ho: lum < .3 ? .6 : .38, dark: lum < .3, pale: lum > .6,
    vol: mix(k1, cool, lum > .6 ? .62 : .45), sh: mix(k1, cool, lum > .6 ? .42 : .3), core: mix(k1, '#010806', .62), hl: mix(k0, '#ffe8bf', .5), rim: '#ffe2ae', line: mix(k1, '#020c09', .58),
    jub: c.collar, jubS: mix(c.collar, '#1f4a40', .4), gl: mix(c.band, '#fff7dc', .62), gd: mix(c.band, '#3b2508', .5),
    ps: mix(mix(k1, cool, .3), mix(k1, '#010806', .62), lum > .6 ? .55 : .25), pk: mix(k1, '#010806', .62),
    skin: c.skin[1], skinS: mix(c.skin[1], c.skin[2], .7), skinC: mix(c.skin[2], '#a8545a', .3)
  };
}

// The collar stack in the portrait's space. Back to front: the kimono's back collar standing behind the nape (a low, dark band that
// only shows beside the neck), the base of the neck, chest skin in the V, the two opaque juban collars (c.collar) and the two gold
// kimono collars, wearer's left over right. figureSvg() reuses it through a stretch transform, so it carries no strokes.
function collar(c, u, t, rise = 4) {
  const jl = `${u}-g-jl`, jr = `${u}-g-jr`, back = mix(t.gd, '#2a1a06', .35), jL = mix(c.collar, '#fffdf4', .62), jD = mix(c.collar, '#6e5a3a', .34);
  // Back collar: an open band standing `rise` above the lapel tops beside the neck. Its ends run exactly into the gold collars'
  // outer top corners (77,157 and 115,153) and its lower edge is the lapel tops themselves, so it never ends in a cap.
  const y = 153 - rise, backD = `M77 157.2Q78.4 ${r1(y + 1.4)} 86.6 ${r1(y)}Q100 ${r1(y - 1.2)} 112.4 ${r1(y + .2)}L115 153.2L108 153.2Q100 155 91 153.8L85 153.2Z`;
  // Juban collars: L (under, viewer-left) and R (over); inner edges meet at about (95.3, 178.6).
  const JL = 'M83.4 153.2L96.6 194 100.4 189.4 89.4 153.2Z', JR = 'M103.8 153.2L110.4 153.2 94.2 197.4 89.4 194.4Z';
  return `<clipPath id="${jl}"><path d="${JL}"/></clipPath><clipPath id="${jr}"><path d="${JR}"/></clipPath>
<path d="${backD}" fill="${back}"/><path d="${cres(77, 157.2, 78.8, y + 1.6, 86.6, y + .1, .7)}" fill="#1a1004" opacity=".35"/>
<path d="M90.8 145.5Q89.6 150.4 87.4 153.4H112.6Q110.4 150.4 109.2 145.5Z" fill="${t.skinS}"/>
<path d="M86 153.2H113L95.6 186Z" fill="${t.skinS}"/><path d="M88 153.2Q100 156.4 112 153.2L110.6 157.4Q100 163 90.2 158.4Z" fill="${t.skinC}" opacity=".35"/><path d="${cres(103.8, 153.2, 97.6, 170, 92.4, 186, 1.8)}" fill="${t.skinC}" opacity=".6"/><path d="${cres(89.4, 153.2, 92.8, 166, 96, 180, -1)}" fill="${t.skinC}" opacity=".45"/>
<path d="${JL}" fill="${c.collar}"/><g clip-path="url(#${jl})"><path d="${cres(89.6, 153.4, 94.8, 172, 100.2, 190, .55)}" fill="${jL}"/><path d="${cres(84.4, 153.4, 90.4, 174, 96.6, 194, -.75)}" fill="${jD}"/><path d="${cres(103.8, 153.2, 97.6, 172, 91.4, 190, 1.5)}" fill="${jD}"/></g>
<path d="${JR}" fill="${c.collar}"/><g clip-path="url(#${jr})"><path d="${cres(103.6, 153.4, 96.8, 174, 89.8, 194.4, -.55)}" fill="${jL}"/><path d="${cres(109.8, 153.4, 102.4, 174, 94.4, 196.4, .8)}" fill="${jD}"/></g>
<path d="M77 157L91 200 97 194 85 153Z" fill="url(#${u}-g-au2)"/><path d="${cres(85, 153, 91, 171.5, 97, 190, .9)}" fill="${t.gl}" opacity=".85"/><path d="${cres(77, 157, 84, 178.5, 91, 200, -1.2)}" fill="${t.gd}" opacity=".7"/>
<path d="${cres(92, 196, 90, 218, 88, 240, 2.6)}" fill="${t.core}" opacity=".5"/>
<path d="M115 153L99 200 96 240 88 240 92 196 108 153Z" fill="url(#${u}-g-au)"/><path d="${cres(112.5, 154, 104.5, 176.5, 96.5, 199, -1.3)}${cres(96.5, 199, 94, 220, 92.5, 240, -1)}" fill="${t.gl}" opacity=".9"/><path d="${cres(108, 153, 100, 174.5, 92, 196, -1.1)}${cres(92, 196, 90, 218, 88, 240, -1)}" fill="${t.gd}" opacity=".85"/><path d="${cres(115, 153, 107, 176.5, 99, 200, .7)}" fill="#fff7dc" opacity=".7"/>`;
}
const collarDefs = (u, t, c) => `<linearGradient id="${u}-g-au" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${t.gl}"/><stop offset=".45" stop-color="${c.band}"/><stop offset="1" stop-color="${t.gd}"/></linearGradient>
<linearGradient id="${u}-g-au2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.band}"/><stop offset="1" stop-color="${t.gd}"/></linearGradient>`;

export function bustClothes(c, u) {
  const t = tones(c), SH = 'M-8 240V206C4 190 30 177 58 169.6Q76 164 88 154L112 154Q124 164 142 169.6C170 177 196 190 208 206V240Z';
  const defs = `
<linearGradient id="${u}-kim" x1="1" y1="0" x2=".15" y2="1"><stop offset="0" stop-color="${c.kimono[0]}"/><stop offset=".55" stop-color="${mix(c.kimono[0], c.kimono[1], .35)}"/><stop offset="1" stop-color="${mix(c.kimono[0], c.kimono[1], t.dark ? .55 : .7)}"/></linearGradient>
${collarDefs(u, t, c)}
${motif(u, c)}
<clipPath id="${u}-g-sh"><path d="${SH}"/></clipPath>
`;
  // Lit plane first, opaque and crisp-edged, so the woven motif keeps its own colour on top of it instead of being washed out.
  const lit = 'M116 158C134 166 150 170 168 176C188 184 200 196 206 212V240H180C177 218 169 202 157 192C145 182 129 174 114 168Z';
  // 1st shadow: the outer flank turning away (a band hugging the left silhouette, so the shoulder top stays cloth-coloured), the
  // underlying panel beside the overlap, and drop folds that hang from the sleeve seams; the right-side fold sits on the lit plane.
  const S = ['M-8 204C4 190 20 181 40 175.4C32 192 27 214 28 240H-8Z', cres(92, 205, 88, 222, 84, 240, 7), wedge(40, 204, 47, 222, 50, 240, 6)].join('');
  const S2 = [wedge(158, 206, 163, 224, 165, 240, 5), wedge(128, 214, 131, 228, 132, 240, 3.5)].join('');
  const K = [cres(92, 205, 88, 222, 84, 240, 2.2), wedge(40, 206, 47, 223, 50, 240, 2), cres(76, 158, 82, 180, 92, 209, 3), cres(40, 175.4, 31, 204, 28, 240, 1.3)].join('');
  const K2 = [wedge(158, 208, 163, 225, 165, 240, 1.6)].join('');
  const H = [cres(122, 163, 160, 170, 198, 198, 1.2), cres(160, 206, 165, 224, 167, 240, -1.2), cres(130, 214, 133, 228, 134, 240, -.9), cres(110, 212, 118, 226, 120, 240, -3)].join('');
  const R = cres(138, 167.6, 178, 173.4, 208, 206, 1.9);
  const body = `<path d="${SH}" fill="url(#${u}-kim)"/>
<g clip-path="url(#${u}-g-sh)"><path d="${lit}" fill="${mix(c.kimono[0], '#ffe8bf', t.dark ? .16 : .18)}"/></g>
<path d="${SH}" fill="url(#${u}-fab)"/>
<g clip-path="url(#${u}-g-sh)"><path d="${S}" fill="${t.sh}" opacity="${t.dark ? .55 : .66}"/><path d="${S2}" fill="${t.sh}" opacity=".35"/><path d="${K}" fill="${t.core}" opacity=".7"/><path d="${K2}" fill="${t.core}" opacity=".4"/><path d="${H}" fill="${t.hl}" opacity="${t.dark ? .26 : .33}"/><path d="${R}" fill="${t.rim}" opacity=".75"/></g>
<path d="M-8 206C4 190 30 177 58 169.6Q76 164 88 154M112 154Q124 164 142 169.6C170 177 196 190 208 206" fill="none" stroke="${t.line}" stroke-width="1.1" stroke-linejoin="round"/>
${collar(c, u, t)}`;
  return { defs, body };
}

// Knee-up standing figure in a 600×900 box for the lobby: furisode whose long sleeves hang from the forearms, a gold obi at the
// waist, the left hand resting at the obi and the right raised to the chest with a tile. Light comes from the upper right.
// p is the head from parts(): back, neck and front are placed with the head transform; p.defs carries every shared gradient.
export function figureSvg(c, u, p) {
  const head = 'translate(292 244) rotate(-4) scale(1.65) translate(-100 -160)';
  const t = tones(c), g = `${u}-g-`;
  // Each cloth piece: base, woven motif, its embroidery, then crisp shadow / core / light / rim shapes clipped to it, then the line.
  // A fold is a ridge: shadow crescent on its left, a thin dark core in the trough, a lit sliver on its right.
  // Flowers (fl) are an opaque print drawn over the finished cloth shading, then shaded, clipped to their own silhouettes, with the
  // cloth's soft form gradient and its large shadow planes only (never the narrow fold stripes) in the cloth's own jade shadow hue,
  // so a flower in shadow darkens (centre and stamens included) instead of fading or picking up grey slats.
  // Each shadow shape is its own <path>, so overlapping crescents of opposite winding never cut light slivers into each other.
  const piece = (d, id, { S = [], K = [], H = [], R = [], deco = '', extra = '', folds = [], fl = [], lift = '' }) => {
    const S0 = [...S], K0 = [...K];
    for (const [x0, y0, cx, cy, x1, y1, w] of folds) { S.push(wedge(x0, y0, cx, cy, x1, y1, w * 1.6)); K.push(wedge(x0, y0, cx, cy, x1, y1, w * .45)); H.push(cres(x0, y0, cx, cy, x1, y1, -w * .3)); }
    const f = (a, fill, o) => a.length ? `<g fill="${fill}" opacity="${o}">${a.map(x => `<path d="${x}"/>`).join('')}</g>` : '';
    const print = fl.length ? `${flowers(fl)}<clipPath id="${g}${id}f">${petals(fl)}</clipPath><g clip-path="url(#${g}${id}f)"><rect x="150" y="230" width="300" height="680" fill="url(#${g}lit)"/>${f(S0, t.ps, .4)}${f(K0, t.pk, .3)}${f(R, '#fff8e4', .6)}</g>` : '';
    return `<clipPath id="${g}${id}"><path d="${d}"/></clipPath><path d="${d}" fill="url(#${g}k)"/><path d="${d}" fill="url(#${u}-fab)"/><g clip-path="url(#${g}${id})">${deco}<rect x="150" y="230" width="300" height="680" fill="url(#${g}lit)"/><path d="${d}" fill="url(#${g}vol)"/><path d="${d}" fill="url(#${g}volV)"/>${t.dark && lift ? `<path d="${lift}" fill="${t.hl}" opacity=".18"/>` : ''}${f(S, t.sh, t.pale ? .78 : .62)}${f(K, t.core, t.pale ? .8 : .7)}${f(H, t.hl, t.ho)}${f(R, t.rim, .75)}${print}${extra}</g><path d="${d}" fill="none" stroke="${t.line}" stroke-width="2" stroke-linejoin="round"/>`;
  };
  // Padded hem roll (fuki) along a quadratic edge, h deep, lit on top.
  const fuki = (x0, y0, cx, cy, x1, y1, h) => `<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}L${x1} ${y1 + h}Q${cx} ${cy + h} ${x0} ${y0 + h}Z" fill="url(#${g}lin)" stroke="${t.line}" stroke-width="1.4"/><path d="${cres(x0 + 3, y0 + 2, cx, cy + 2, x1 - 3, y1 + 2, 1.2)}" fill="#fff" opacity=".5"/>`;
  const torso = 'M268 238C246 250 222 262 204 282C200 330 206 372 214 392L372 392C380 370 388 330 384 280C366 262 340 250 316 238Z';
  const skirt = 'M212 440C204 560 206 740 222 900L386 900C398 740 400 560 380 440Z';
  const sleeveL = 'M208 282C180 300 166 360 164 432C160 524 160 640 168 742Q214 770 266 748C270 660 266 560 258 470C248 452 234 446 226 440C222 380 220 320 208 282Z';
  const foreL = 'M204 404C224 399 242 402 251 410Q258 416 258 426L257.5 452Q257 461 249 463C234 469 218 468 204 462Z';
  const upperR = 'M380 278C406 292 422 340 422 398L398 404C394 362 384 322 366 292Z';
  const drapeR = 'M356 316L420 400C432 484 436 604 430 708Q384 736 336 716C332 604 338 460 356 316Z';
  const foreR = 'M396 410Q420 404 434 388L378 296Q358 300 342 316Z';
  const petal = (x, y, r, rot, a) => `<ellipse cy="${r1(-r * .6)}" rx="${r1(r * .42)}" ry="${r1(r * .6)}" transform="translate(${x} ${y}) rotate(${rot + a})"/>`;
  const petals = list => list.map(([x, y, r, rot]) => [0, 72, 144, 216, 288].map(a => petal(x, y, r, rot, a)).join('')).join('');
  const flowers = list => `<g fill="url(#${g}pet)" stroke="${mix('#f6efdc', t.line, t.pale ? .7 : .45)}" stroke-width="${t.pale ? .9 : .7}">${petals(list)}</g>` + list.map(([x, y, r, rot]) => `<g transform="translate(${x} ${y}) rotate(${rot})"><circle r="${r1(r * .24)}" fill="#d9b262" stroke="#9a7430" stroke-width=".7"/>${[0, 72, 144, 216, 288].map(a => `<path d="M0 0V${r1(-r * .5)}" transform="rotate(${a + 36})" stroke="#c9a04e" stroke-width=".8"/>`).join('')}</g>`).join('');
  const stream = (x, y, w) => { const s = `M${x} ${y}c${r1(w * .2)}-12 ${r1(w * .4)} 12 ${r1(w * .6)} 0s${r1(w * .3)}-10 ${r1(w * .4)} 2`; return `<path d="${s}" stroke="${t.gd}" stroke-width="3.2" fill="none" opacity=".45" transform="translate(-.8 1.2)"/><path d="${s}" stroke="${c.band}" stroke-width="2" fill="none" opacity=".8"/>`; };
  // Wrap overlap: the outer front panel (viewer-right) lies over the under panel along E. The under panel is re-laid with its weave
  // and stream shifted, so the print breaks at the edge like two layers of cloth; beside the edge it gets a constant-width cast
  // shadow and occlusion core that start at the obi, and the outer panel's edge gets a lit lip and hairline that start below the hand.
  const E = 'Q302.2 684 319 900';
  const under = `<clipPath id="${g}cs-u"><path d="M190 430H299.3${E}H190Z"/></clipPath><g clip-path="url(#${g}cs-u)"><path d="${skirt}" fill="url(#${g}k)"/><rect x="150" y="420" width="260" height="500" transform="translate(9 7)" fill="url(#${u}-fab)"/>${stream(214, 796, 110)}</g>`;
  const skirtP = piece(skirt, 'cs', {
    S: ['M200 438Q296 426 400 438V462Q296 452 200 476Z', cres(348, 440, 328, 600, 338, 734, 16), cres(214, 748, 204, 830, 222, 902, -10)],
    K: [cres(258, 470, 274, 610, 266, 748, -4), 'M200 440Q296 428 400 440V450Q296 442 200 458Z'],
    R: [cres(380, 440, 407, 640, 386, 900, 3)],
    folds: [[352, 470, 360, 690, 348, 900, 10], [374, 720, 382, 810, 376, 900, 7], [268, 745, 270, 822, 277, 900, 8], [280, 470, 274, 600, 282, 742, 6]],
    deco: `${stream(222, 780, 110)}${stream(318, 840, 80)}${under}`,
    fl: [[276, 790, 13, 60], [350, 792, 19, 5], [252, 858, 23, 45], [368, 872, 13, 30]],
    lift: `M299.3 446${E}H400V440Z`,
    extra: `<path d="M289.3 446Q292.2 684 309 900H319Q302.2 684 299.3 446Z" fill="${t.sh}" opacity=".45"/><path d="M294.8 446Q297.7 684 314.5 900H319Q302.2 684 299.3 446Z" fill="${t.core}" opacity=".55"/>`
      + `<path d="M299.6 486${E}H320.6Q303.8 684 301.2 486Z" fill="${mix(t.hl, '#fff8e4', .45)}" opacity=".85"/><path d="M299.6 486${E}" stroke="${t.line}" stroke-width="1.6" fill="none"/>`
  });
  const torsoP = piece(torso, 'ct', {
    S: ['M200 236L262 242C246 290 238 340 246 396L196 396Z', cres(256, 248, 268, 305, 280, 362, 9)],
    K: [cres(256, 248, 268, 305, 280, 362, 3)],
    H: [cres(318, 246, 346, 256, 368, 284, 2.4)],
    lift: 'M300 236C298 300 300 350 304 396H392V236Z',
    folds: [[218, 314, 230, 352, 242, 392, 3.6], [374, 318, 364, 354, 356, 392, 3]]
  });
  const sleeveLP = piece(sleeveL, 'cl', {
    S: ['M150 280H204C188 340 176 420 178 520C179 600 176 680 180 790H150Z', cres(196, 446, 236, 486, 262, 472, 13)],
    K: [cres(200, 452, 236, 480, 260, 474, 5)],
    R: [cres(258, 470, 274, 610, 266, 748, 3), cres(208, 284, 222, 360, 226, 438, 2.2)],
    folds: [[240, 474, 212, 560, 204, 690, 9], [252, 500, 246, 620, 238, 752, 7]],
    deco: stream(170, 650, 90),
    fl: [[222, 596, 17, 20], [236, 672, 13, 60], [198, 712, 10, 5]],
    extra: `<path d="${cres(258, 471, 269, 515, 266, 562, -5)}" fill="${t.jub}"/><path d="${cres(258, 471, 269, 515, 266, 562, -2)}" fill="${t.core}"/>`
  });
  const foreLP = piece(foreL, 'cf', {
    S: ['M198 446C224 452 244 452 262 444V474H198Z'], K: [cres(204, 404, 206, 434, 204, 462, -3), cres(206, 463, 230, 469, 252, 462, 1.6)], H: [cres(206, 404.5, 232, 398, 254, 413, 2.2)],
    folds: [[214, 410, 228, 432, 246, 452, 5]]
  }) + `<ellipse cx="257" cy="439" rx="6.5" ry="21" transform="rotate(-6 257 439)" fill="${t.jub}" stroke="${t.line}" stroke-width="1.2"/><ellipse cx="258.6" cy="440" rx="3.8" ry="17" transform="rotate(-6 258 440)" fill="${t.core}"/>`;
  const upperRP = piece(upperR, 'cu', { S: [cres(366, 292, 392, 340, 398, 404, -9)], K: [cres(366, 292, 392, 340, 398, 404, -3)], H: [cres(374, 284, 398, 290, 412, 322, 4)], R: [cres(380, 278, 416, 306, 422, 398, 3)] });
  const drapeRP = piece(drapeR, 'cr', {
    S: [cres(350, 318, 380, 380, 424, 404, 14), 'M320 330H356C366 430 362 560 358 740H320Z'],
    K: [cres(352, 318, 384, 372, 424, 402, 5)],
    R: [cres(420, 400, 437, 560, 430, 708, 3)],
    folds: [[372, 404, 362, 560, 360, 720, 9], [410, 440, 419, 570, 416, 712, 7]],
    deco: stream(340, 590, 90),
    fl: [[392, 560, 18, 15], [376, 632, 12, 50], [408, 660, 9, 80]],
    extra: `<path d="${cres(356, 318, 342, 390, 340, 470, -6)}" fill="${t.jub}"/><path d="${cres(356, 318, 342, 390, 340, 470, -2.5)}" fill="${t.core}"/>`
  });
  const foreRP = piece(foreR, 'cw', { S: [cres(342, 316, 364, 366, 396, 410, -8)], K: [cres(342, 316, 364, 366, 396, 410, -2.5)], R: [cres(378, 296, 408, 340, 434, 388, 3)] })
    + `<ellipse cx="360" cy="306" rx="21" ry="7.5" transform="rotate(-29 360 306)" fill="${t.jub}" stroke="${t.line}" stroke-width="1.2"/><ellipse cx="358.6" cy="304.6" rx="17" ry="4.4" transform="rotate(-29 358 305)" fill="${t.core}"/>`;
  const obiD = 'M208 390Q296 378 382 390L386 452Q296 440 206 452Z', cord = 'M206 424Q296 412 386 424';
  const dk = mix(t.gd, '#1a0f02', .45), hr = handR(c, t);
  const obi = `<path d="M212 386C234 378 258 382 280 377Q292 374 304 377C326 381 352 378 378 384L382 393Q296 381 208 393Z" fill="url(#${g}oa)" stroke="${t.line}" stroke-width="1.2"/><path d="${cres(222, 389, 250, 382, 282, 386, 1.8)}${cres(302, 384, 334, 381, 368, 389, 1.6)}" fill="${t.jubS}" opacity=".65"/><path d="${cres(236, 382, 260, 379, 282, 379, -1)}${cres(306, 379, 330, 380, 356, 382, -.9)}" fill="#fff" opacity=".5"/>
<path d="${obiD}" fill="url(#${g}obi)"/><path d="${obiD}" fill="url(#${g}ow)"/>
<g fill="none" stroke="${t.gd}" stroke-width="1.3" opacity=".75">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${226 + i * 28} 406l8 8-8 8-8-8z"/>`).join('')}</g><g fill="none" stroke="${t.gl}" stroke-width=".8" opacity=".6">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${226 + i * 28} 409l5 5-5 5"/>`).join('')}</g>
<path d="${cres(208, 403, 296, 391, 383, 403, 2.4)}${cres(206, 451, 296, 439, 386, 451, -4)}${cres(360, 392, 368, 420, 372, 450, 4)}${cres(236, 393, 230, 420, 234, 450, -3)}" fill="${dk}" opacity=".5"/>
<path d="${cres(210, 391, 296, 379, 381, 391, 1.8)}${cres(208, 401.5, 296, 389.5, 383, 401.5, -1)}" fill="#fff6d6" opacity=".7"/>
<path d="${cord}" stroke="${dk}" stroke-width="4" fill="none" opacity=".35" transform="translate(-1 3)"/><path d="${cord}" stroke="#0f5a41" stroke-width="6" fill="none"/><path d="${cord}" stroke="#4fa07e" stroke-width="4.4" fill="none" stroke-dasharray="2.2 2.4"/><path d="${cord}" stroke="#c8f2de" stroke-width="1" fill="none" opacity=".55" transform="translate(0 -1.6)"/>
<ellipse cx="294" cy="420" rx="12" ry="10" fill="${dk}" opacity=".35"/><ellipse cx="296" cy="417" rx="12" ry="10" fill="url(#${g}au)" stroke="${t.gd}" stroke-width="1"/><ellipse cx="296" cy="417" rx="8.4" ry="6.8" fill="url(#${u}-jade)"/><path d="${cres(288.5, 419, 290, 424, 298, 424, 1.6)}" fill="#0a3d2b" opacity=".6"/><ellipse cx="299" cy="414" rx="3" ry="1.8" fill="#effff8" opacity=".85" transform="rotate(-25 299 414)"/>`;
  return `<svg viewBox="0 -30 600 930" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}立繪"><defs>${p.defs}
${grad(`${g}k`, [[0, c.kimono[0]], [.55, mix(c.kimono[0], c.kimono[1], .5)], [1, mix(c.kimono[0], c.kimono[1], .85)]])}
${grad(`${g}lit`, [[0, t.core, .2], [.42, t.core, 0], [.78, '#ffe8bf', 0], [1, '#ffe8bf', .16]], 1, 0)}
${grad(`${g}obi`, [[0, t.gl], [.2, c.band], [.75, mix(c.band, t.gd, .35)], [1, t.gd]])}
${grad(`${g}ow`, [[0, dk, .5], [.28, dk, 0], [.7, '#fff4d0', .28], [.86, '#fff4d0', 0], [1, dk, .3]], 1, 0)}
${grad(`${g}oa`, [[0, mix(c.collar, '#fff8e6', .3)], [.6, c.collar], [1, mix(c.collar, t.jubS, .6)]])}
${grad(`${g}lin`, [[0, mix(c.collar, '#ffffff', .2)], [.55, c.collar], [1, t.jubS]])}
${grad(`${g}pet`, [[0, '#fffaf0'], [1, '#dccfa9']])}
${grad(`${g}tile`, [[0, '#fffdf1'], [1, '#e7e2cc']])}
${grad(`${g}vol`, [[0, t.vol, t.pale ? .62 : .55], [.18, t.vol, .26], [.42, t.vol, 0], [.66, '#fff3d6', t.pale ? .2 : .1], [.84, t.vol, .04], [1, t.vol, t.pale ? .4 : .34]], 1, 0)}${grad(`${g}volV`, [[0, t.vol, .22], [.25, t.vol, 0], [.8, t.vol, 0], [1, t.vol, .28]])}
</defs>
<g transform="${head}">${p.back}</g>
${skirtP}
${torsoP}
<clipPath id="${g}cc"><path d="M150 150H450V392H150Z"/></clipPath><g clip-path="url(#${g}cc)"><g transform="matrix(1.55 0 0 2.6 137 -159.8)">${collar(c, u, t, 2.4)}</g></g>
<g transform="${head}">${p.neck}</g>
${obi}
${sleeveLP}${fuki(168, 740, 214, 768, 266, 746, 9)}
${foreLP}
${handL(c, t)}
<g transform="${head}">${p.front}</g>
${upperRP}${drapeRP}${fuki(336, 714, 384, 736, 430, 706, 9)}
${foreRP}
<g transform="rotate(-12 328 262)">${hr.back}<rect x="306" y="228" width="44" height="60" rx="6" fill="url(#${g}tile)" stroke="#cfc8ad" stroke-width="1.2"/><rect x="306" y="280" width="44" height="10" rx="4" fill="#14704d"/>
<path d="M318 266C320 254 330 248 340 252C334 256 332 262 334 270C328 272 322 270 318 266Z" fill="#12613f"/><path d="M334 270L340 278M328 271L330 280" stroke="#b52027" stroke-width="2" stroke-linecap="round"/><circle cx="336" cy="256" r="1.6" fill="#b52027"/><path d="M340 252l6-2-4 5z" fill="#c9a04e"/>
${hr.front}</g>
</svg>`;
}

// Hands, drawn as skin with a warm line, a rose shadow half on the side away from the light, knuckle creases and nail tips.
// A finger segment is a capsule from a to b; half() is the same capsule's half on one side (s = ±1), used for its shadow side.
const cap = (ax, ay, bx, by, r) => {
  const l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l * r, ny = (bx - ax) / l * r;
  return `M${P(ax + nx, ay + ny)}L${P(bx + nx, by + ny)}A${r1(r)} ${r1(r)} 0 0 0 ${P(bx - nx, by - ny)}L${P(ax - nx, ay - ny)}A${r1(r)} ${r1(r)} 0 0 0 ${P(ax + nx, ay + ny)}Z`;
};
const half = (ax, ay, bx, by, r, s) => {
  const l = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / l * r, dy = (by - ay) / l * r, nx = -dy * s, ny = dx * s, f = s > 0 ? 1 : 0;
  return `M${P(ax, ay)}L${P(bx, by)}L${P(bx + dx, by + dy)}A${r1(r)} ${r1(r)} 0 0 ${f} ${P(bx + nx, by + ny)}L${P(ax + nx, ay + ny)}A${r1(r)} ${r1(r)} 0 0 ${f} ${P(ax - dx, ay - dy)}Z`;
};
// One finger: a proximal and a distal segment bending by `bend` degrees, shaded on side s, with a nail on the distal back.
function finger(t, ln, x, y, r, l1, l2, a, bend, s, nail = true) {
  const rad = d => d * Math.PI / 180, x1 = x + l1 * Math.cos(rad(a)), y1 = y + l1 * Math.sin(rad(a)), x2 = x1 + l2 * Math.cos(rad(a + bend)), y2 = y1 + l2 * Math.sin(rad(a + bend));
  const segs = [[x, y, x1, y1, r], [x1, y1, x2, y2, r * .92]];
  return segs.map(([p, q, u, v, rr]) => `<path d="${cap(p, q, u, v, rr)}" fill="${t.skin}"/><path d="${half(p, q, u, v, rr, s)}" fill="${t.skinS}"/><path d="${cap(p, q, u, v, rr)}" fill="none" stroke="${ln}" stroke-width=".8"/>`).join('')
    + (nail ? `<ellipse cx="${r1(x1 + (x2 - x1) * .72)}" cy="${r1(y1 + (y2 - y1) * .72)}" rx="${r1(r * .5)}" ry="${r1(r * .36)}" transform="rotate(${r1(a + bend)} ${r1(x1 + (x2 - x1) * .72)} ${r1(y1 + (y2 - y1) * .72)})" fill="${mix(t.skin, '#fff3ea', .55)}"/>` : '')
    + `<path d="${cres(x1 - (y2 - y1) * .08, y1 - r * .7, x1 + (x2 - x1) * .1, y1 + (y2 - y1) * .1 - r * .4, x1 + r * .5, y1 + r * .5, .5)}" fill="${t.skinC}" opacity=".35"/>`;
}
// Left hand, back to the viewer, resting on the obi: a relaxed hand. The back tapers from the wrist in the cuff to a rounded
// knuckle arc; the four fingers lie together, curling over the obi's lower edge a little more from index to little finger, the
// thumb tucked along the top behind the index. One cel shadow plane on the lower side, one lit edge along the upper-right knuckles.
function handL(c, t) {
  const ln = mix(c.skin[2], '#6b3328', .45);
  const back = 'M-2-5C3-5.6 9-8.4 15.6-9.8C20.6-10.8 24.4-9.6 25.8-6.6C27-3.6 27.2-.4 26.6 2.6C26 6 24.2 9 21.2 10.4C15.4 12.2 8 10-2 6.4Z';
  const thumb = 'M4-7.6C9-10.6 14.4-12.2 19.6-12.4C22.6-12.4 23.8-10.4 22.2-8.8C18-8 13-7 9-5.4Z';
  // [x, y, r, proximal, distal, angle, bend], little finger first so each finger above overlaps the one below it.
  const F = [[20.6, 6.4, 3.05, 8.4, 5, 16, 70], [22.8, 2.4, 3.3, 9.4, 5.8, 13, 66], [23.4, -1.6, 3.4, 9.8, 6.2, 10, 62], [22.6, -5.6, 3.3, 9.2, 5.8, 8, 58]];
  const sil = `<path d="${back}${thumb}"/>` + F.map(([x, y, r, a, b, ang]) => `<path d="${cap(x, y, x + a * Math.cos(ang * Math.PI / 180), y + a * Math.sin(ang * Math.PI / 180), r)}"/>`).join('');
  // Knuckle shading: a small shadow below each knuckle bump, where the back turns down into the next finger.
  const knuckles = F.map(([x, y, r], i) => i < 3 ? `<path d="${cres(x - 4.4, y + r * .95, x - .4, y + r * 1.25, x + 3, y + r * .9, .45)}" fill="${t.skinC}" opacity=".6"/>` : '').join('');
  return `<g transform="translate(258 434) rotate(4) scale(1.3)"><g fill="#3a2408" opacity=".34" transform="translate(-2.4 3.4)">${sil}</g>
<path d="${thumb}" fill="${t.skin}" stroke="${ln}" stroke-width=".9" stroke-linejoin="round"/><path d="M10-6.6C15-8.6 19-9.2 22.2-8.8C18-8 13-7 9-5.4Z" fill="${t.skinS}"/><ellipse cx="20.6" cy="-11" rx="1.2" ry=".85" transform="rotate(-8 20.6 -11)" fill="${mix(t.skin, '#fff3ea', .55)}"/>
${F.map(([x, y, r, a, b, ang, bend]) => finger(t, ln, x, y, r, a, b, ang, bend, 1)).join('')}
<path d="${cres(25.8, -6.6, 29.4, 2, 21.2, 10.4, -1.6)}" fill="${t.skinC}" opacity=".45"/>
<path d="${back}" fill="${t.skin}" stroke="${ln}" stroke-width=".9" stroke-linejoin="round"/><path d="M-2 1.6C7 3.2 16 3.8 26.9 1C26.2 6 24.2 9 21.2 10.4C15.4 12.2 8 10-2 6.4Z" fill="${t.skinS}"/>
${knuckles}<path d="${cres(15.6, -9.8, 26.4, -9.8, 26.8, -.4, .75)}" fill="${mix(t.skin, '#fff8ec', .7)}" opacity=".9"/>
<path d="M-2-5C3-5.6 9-8.4 15.6-9.8" fill="none" stroke="${ln}" stroke-width=".9"/>
</g>`;
}
// Right hand holding the tile up from below: ring and little finger stand behind the tile's right edge (drawn before it),
// the back of the hand and the thumb are in front, the thumb pressing the tile face. In the tile group's rotated frame.
function handR(c, t) {
  const ln = mix(c.skin[2], '#6b3328', .45);
  const back = finger(t, ln, 361.2, 292, 3.5, 10, 8.6, -90, -64, -1, false) + finger(t, ln, 355.4, 291, 3.8, 12, 9.6, -95, -60, -1, false);
  const palm = 'M342.4 317C340 309.6 337.6 300 338.4 291.6C342.6 287.4 351.6 285.8 360.2 286.8C365.2 287.6 367.8 290.8 367 295.4C365.6 302.4 361.6 308.4 357.8 313.6Z';
  const thumb = 'M342.6 307C337.8 301 331.4 293 325.8 286.2C320.6 280.8 317.8 274 320.8 270.4C323.4 267.8 328 269.4 331 273.4C335.4 279 340.6 285.6 346 292Z';
  const front = `<path d="${cres(320, 272, 318, 288, 342, 304, 3.4)}" fill="#6f7a64" opacity=".32"/>
<path d="${palm}" fill="${t.skin}" stroke="${ln}" stroke-width="1.1" stroke-linejoin="round"/><path d="M342.4 317C340 309.6 337.6 300 338.4 291.6C341 289 345 287.6 349 287C345.4 296 346.4 307 349.4 316.4Z" fill="${t.skinS}"/>
<path d="M341 290.4Q344.6 287.6 349.6 287.4M351.8 287Q356.4 286 361 287.4" stroke="${t.skinC}" stroke-width="1" fill="none" opacity=".7"/><path d="M352 288.6Q356.6 287.8 360.4 289" stroke="#fff" stroke-width="1" fill="none" opacity=".5"/>
<path d="${cres(361, 288, 367.4, 298, 358, 313.4, -1.3)}" fill="${t.rim}" opacity=".6"/>
<path d="${thumb}" fill="${t.skin}" stroke="${ln}" stroke-width="1.1" stroke-linejoin="round"/><path d="M342.6 307C337.8 301 331.4 293 325.8 286.2C323.6 283.8 322 281.2 321.2 278.6C326 285 334 291 344.4 298.6Z" fill="${t.skinS}"/>
<path d="M321 273.4Q321.2 269.6 324.6 270L327.4 273.8Q324 276.2 321 273.4Z" fill="#fff3ea" stroke="${ln}" stroke-width=".5"/><path d="M328.6 280.6Q331.6 280.4 333.4 282.6" stroke="${t.skinC}" stroke-width="1" fill="none" opacity=".7"/><path d="M329.4 273.6C333.4 278.4 338 284 342.6 289.4" stroke="#fff" stroke-width=".9" fill="none" opacity=".45"/>`;
  return { back, front };
}
