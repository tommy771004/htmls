// 青雀 art · face: skin and its shading, eyes, brows, nose, mouth, blush, the neck, and the hair's cast shadows on the skin.
// Layers are SVG strings in the portrait's 200×240 space; u is the per-portrait id prefix, c an entry of CAST.
// Light: one warm key from the viewer's upper right, so every shadow shape sits on the viewer's left and under each form,
// and a thin warm rim runs down the right contour. Shadows are cel shapes (a crisp, barely softened edge) in warm rose tones
// derived from the character's own skin, with a darker core where two forms touch (fringe on brow, chin on neck).
import { grad, r1 } from './common.mjs';
import { HAIR } from './hair.mjs';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const B = hex(b); return '#' + hex(a).map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

// The character's skin ramp: 1st shadow (a soft rose-mauve, cooler and greyer than the skin so it never reads sunburnt),
// core (deeper, toward plum, where forms touch), contour line, lit tone.
function tones(c) {
  const s2 = c.skin[2];
  return {
    sh: mix(s2, '#b8809a', .5), core: mix(s2, '#6e4460', .52), line: mix(s2, '#64384a', .52),
    lit: mix(c.skin[0], '#ffffff', .65), rim: '#ffe8bf', blush: mix(s2, '#f0766f', .6), nb: mix(c.skin[1], s2, .7),
    glow: Math.max(0, Math.min(1, (255 - hex(c.skin[1]).reduce((a, v) => a + v, 0) / 3 - 22) / 18))
  };
}

// Iris fibres: short spokes between pupil and rim, drawn as one path in the eye's local frame (iris centre 81.5,103).
const FIBRES = Array.from({ length: 16 }, (_, i) => {
  const a = (i + .5) / 16 * Math.PI * 2, k = i % 2 ? .78 : .9;
  return `M${r1(81.5 + Math.cos(a) * 4.4)} ${r1(103 + Math.sin(a) * 5.8)}L${r1(81.5 + Math.cos(a) * 9.6 * k)} ${r1(103 + Math.sin(a) * 11.4 * k)}`;
}).join('');

// One eye in the viewer-left frame; the right eye is the same drawing mirrored. s is 1 for the left eye and -1 inside the mirror,
// so the highlights can stay on the key-light side (upper right in the picture) for both eyes and the socket shade is deeper
// on the shadow side. lids lowers the upper lid (calmer, sleepier); tilt turns the eye so the outer corner rises or falls.
function eye(u, c, t, s) {
  const d = c.lids * 7, top = 86 + d, y = v => r1(v + d), yo = r1(98 + d * .6), yi = r1(95 + d * .4);
  const hx = 81.5 + s * 4.3;
  return `<g transform="rotate(${-(c.tilt || 0)} 82 100)"><ellipse cx="80" cy="${y(90)}" rx="16" ry="6.5" fill="url(#${u}-f-sock)" opacity="${s > 0 ? .95 : .55}"/>
<path d="M67 ${yo}Q80 ${r1(top)} 95 ${yi}Q93 110 81 112.5Q70 111 67 ${yo}Z" fill="url(#${u}-white)"/>
<g clip-path="url(#${u}-eyeclip)"><ellipse cx="81.5" cy="102" rx="9.5" ry="11.6" fill="url(#${u}-irisR)"/><path d="${FIBRES}" stroke="${c.eye[2]}" stroke-width=".45" opacity=".3"/>
<ellipse cx="81.5" cy="102" rx="9.5" ry="11.6" fill="url(#${u}-iris)"/><ellipse cx="81.5" cy="102" rx="9.5" ry="11.6" fill="none" stroke="${c.eye[0]}" stroke-width="1.6" opacity=".85"/>
<ellipse cx="81.5" cy="103" rx="7.2" ry="8.8" fill="none" stroke="${mix(c.eye[0], c.eye[1], .4)}" stroke-width=".55" opacity=".5"/><ellipse cx="81.5" cy="109" rx="8.5" ry="5" fill="url(#${u}-f-bnc)"/>
<ellipse cx="81.5" cy="102.5" rx="3.5" ry="5.5" fill="${mix(c.eye[0], '#000000', .35)}"/><path d="M73 107Q81.5 115.6 90 107Q81.5 111.8 73 107Z" fill="${c.eye[2]}" opacity=".85"/>
<path d="M60 ${y(88.5)}Q80 ${y(82.5)} 100 ${y(90.5)}V${y(96)}Q80 ${y(94.4)} 60 ${y(99.6)}Z" fill="${mix(c.eye[0], '#6a6c8c', .55)}" opacity=".45" filter="url(#${u}-f-cel)"/></g>
<ellipse cx="${r1(hx)}" cy="${y(97.2 - d * .6)}" rx="3" ry="3.9" transform="rotate(${s * 22} ${r1(hx)} ${y(97.2 - d * .6)})" fill="#fff"/><circle cx="${r1(81.5 - s * 4.8)}" cy="107.4" r="1.45" fill="#fff" opacity=".95"/><circle cx="${r1(81.5 + s * 5.6)}" cy="108.6" r=".6" fill="#fff" opacity=".8"/>
<path d="M64 ${r1(99.5 + d * .6)}Q71 ${r1(top - 2.2)} 82 ${r1(top - 1.6)}Q91.5 ${r1(top - 1)} 97.5 ${r1(94 + d * .4)}Q90.5 ${r1(top + 1.2)} 81 ${r1(top + 2.4)}Q71 ${r1(top + 4)} 64 ${r1(99.5 + d * .6)}Z" fill="url(#${u}-lash)"/>
<path d="M65.6 ${r1(99 + d * .6)}Q63.2 ${r1(97.2 + d * .5)} 61.6 ${r1(93.4 + d * .5)}Q64 ${r1(95.2 + d * .5)} 67.2 ${r1(96 + d * .5)}Z" fill="${c.line}"/>
<path d="M66.4 ${r1(95.2 + d * .5)}Q64.6 ${r1(92.4 + d * .5)} 63 ${r1(91 + d * .5)}M68.9 ${r1(92.4 + d * .6)}Q67.8 ${r1(89.6 + d * .6)} 66.8 ${r1(88.2 + d * .6)}" stroke="${c.line}" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".9"/>
<path d="M68.5 ${y(90.2)}Q80 ${y(81.2)} 93.5 ${y(87.6)}Q80 ${y(83)} 68.5 ${y(90.2)}Z" fill="${t.core}" opacity=".32"/>
<path d="M72.5 111.4Q81 115.6 89.5 111Q81 114.2 72.5 111.4Z" fill="${t.core}"/><path d="M75.5 114Q81 116 86.5 113.5" stroke="${t.lit}" stroke-width=".6" fill="none" opacity=".45"/>
<path d="M75 111.9Q70.6 110.9 68.4 106.4Q71.2 109.5 74.8 110.7Z" fill="${c.line}" opacity=".75"/><path d="M76 112.4l-.7 1.7M79.6 113.2l-.3 1.7M83.4 113.1l.1 1.5" stroke="${t.core}" stroke-width=".55" opacity=".75" stroke-linecap="round"/></g>`;
}

// Mouths: a lip line in a deep rose, the lower lip's soft shadow on the chin below it, and a tiny lit spot on the lower lip.
function mouth(c, t) {
  const lip = mix(t.core, '#9a3c3a', .45), under = (x, y) => `<path d="M${x - 3.2} ${y}Q${x} ${y + 1.9} ${x + 3.2} ${y}Q${x} ${y + .9} ${x - 3.2} ${y}Z" fill="${t.sh}" opacity=".55"/>`;
  const shine = (x, y) => `<path d="M${x - .9} ${y}h1.8" stroke="#fff" stroke-width=".6" stroke-linecap="round" opacity=".55"/>`;
  switch (c.mouth) {
    case 'open': return `<path d="M95 126Q100 132.4 105 126Q100 127.6 95 126Z" fill="${mix(lip, '#3a1418', .35)}"/><path d="M97.2 129Q100 131 102.8 129Q100 129.5 97.2 129Z" fill="#e58d88"/><path d="M94.2 125.9Q100 127.4 105.8 125.9" stroke="${lip}" stroke-width="1" fill="none" stroke-linecap="round"/>${under(100, 132.6)}${shine(100.6, 131.2)}`;
    case 'smile': return `<path d="M93 127Q100 132.5 107 127" stroke="${lip}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M96 129.3Q100 131 104 129.3" stroke="#e79b92" stroke-width="1.1" fill="none" opacity=".6"/>${under(100, 132.8)}${shine(100.8, 131.4)}`;
    case 'calm': return `<path d="M95 128Q100 130 105 128" stroke="${lip}" stroke-width="1.3" fill="none" stroke-linecap="round"/>${under(100, 132)}${shine(100.6, 130.9)}`;
    default: return `<path d="M94 128Q100 129.5 107 125.5" stroke="${lip}" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M106.6 125.2l.9-.9" stroke="${lip}" stroke-width=".8" stroke-linecap="round"/>${under(101, 131.6)}${shine(101.4, 130.5)}`;
  }
}

export function faceLayers(c, u) {
  const h = HAIR[c.style], t = tones(c);
  const face = 'M58 84C57 104 63 121 80 134Q92 144 100 146Q108 144 120 134C137 121 143 104 142 84C142 56 58 56 58 84Z';
  const neckD = 'M90.6 128Q92.2 139 90.8 145.5Q89.6 150.4 87.4 153.4H112.6Q110.4 150.4 109.2 145.5Q107.8 139 109.4 128Z';
  const eyeD = `M67 ${r1(98 + c.lids * 4.2)}Q80 ${r1(86 + c.lids * 7)} 95 ${r1(95 + c.lids * 2.8)}Q93 110 81 112.5Q70 111 67 ${r1(98 + c.lids * 4.2)}Z`;
  const defs = `
${grad(`${u}-skin`, [[0, c.skin[0]], [1, c.skin[1]]])}
${grad(`${u}-f-skinF`, [[0, c.skin[0]], [.4, c.skin[0]], [1, c.skin[1]]])}
${grad(`${u}-iris`, [[0, c.eye[0], .85], [.42, c.eye[0], .2], [.6, c.eye[0], 0]])}
<filter id="${u}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter><filter id="${u}-soft3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="${u}-f-cel" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".45"/></filter>
<radialGradient id="${u}-irisR" cx=".5" cy=".7" r=".62"><stop offset="0" stop-color="${c.eye[2]}"/><stop offset=".45" stop-color="${c.eye[1]}"/><stop offset=".8" stop-color="${mix(c.eye[1], c.eye[0], .55)}"/><stop offset="1" stop-color="${c.eye[0]}"/></radialGradient>
<radialGradient id="${u}-f-bnc"><stop offset="0" stop-color="${c.eye[2]}" stop-opacity=".7"/><stop offset="1" stop-color="${c.eye[2]}" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}-f-sock"><stop offset="0" stop-color="${t.sh}" stop-opacity=".55"/><stop offset="1" stop-color="${t.sh}" stop-opacity="0"/></radialGradient>
<linearGradient id="${u}-f-nsh" x1="0" y1="104.4" x2="0" y2="117.6" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.sh}" stop-opacity="0"/><stop offset="1" stop-color="${t.sh}" stop-opacity=".8"/></linearGradient>
<linearGradient id="${u}-f-nb" x1="0" y1="149.6" x2="0" y2="153.4" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.nb}" stop-opacity="0"/><stop offset=".85" stop-color="${t.nb}"/></linearGradient>
${grad(`${u}-f-ol`, [[0, t.line], [.5, t.line], [.72, mix(t.line, c.skin[1], .4), .85], [1, mix(t.line, c.skin[1], .55), .7]], 1, 0)}
<radialGradient id="${u}-f-glow"><stop offset="0" stop-color="#fffaf0" stop-opacity=".75"/><stop offset="1" stop-color="#fffaf0" stop-opacity="0"/></radialGradient>
${grad(`${u}-lash`, [[0, mix(c.line, '#6a3a30', .6)], [.35, c.line], [1, c.line]], 1, 0)}
<radialGradient id="${u}-blush"><stop offset="0" stop-color="${t.blush}" stop-opacity=".55"/><stop offset="1" stop-color="${t.blush}" stop-opacity="0"/></radialGradient>
<clipPath id="${u}-eyeclip"><path d="${eyeD}"/></clipPath><clipPath id="${u}-f-clip"><path d="${face}"/></clipPath><clipPath id="${u}-f-nclip"><path d="${neckD}"/></clipPath>
${grad(`${u}-white`, [[0, '#dcd9e2'], [.45, '#fbfaf8'], [1, '#ffffff']])}
`;
  // Neck: the collar's occlusion darkens its base a little, the viewer-left side plane turns away from the key and stays in a
  // crisp shade down its whole length (deepening softly at the very edge), and the head casts a crisp crescent under the jaw,
  // wider and lower on the shadow side, with a darker core right against the chin. The lit right edge keeps its warm rim,
  // and a faint notch between the collarbones sits just above the collar. Everything stays inside the neck's own clip.
  const neck = `<path d="${neckD}" fill="url(#${u}-skin)"/><g clip-path="url(#${u}-f-nclip)">
<path d="M86 124H114V139.4Q108.6 146.6 101.4 148.6Q97.6 149.6 96.4 152Q95.6 153.8 95.4 156H86Z" fill="${t.sh}" opacity=".85" filter="url(#${u}-f-cel)"/>
<path d="M86 128H92Q91.2 141 91.6 147Q91.4 151.4 90.4 156H86Z" fill="${t.core}" opacity=".22" filter="url(#${u}-soft)"/>
<path d="M86 124H114V133.4Q106.4 143.4 100.4 145.2Q95.4 146 91.6 144.2Q88.8 142.8 86 142.4Z" fill="${t.core}" opacity=".7" filter="url(#${u}-f-cel)"/>
<path d="M109.6 131Q108.2 139 109.3 145.3Q110.4 150.2 112.9 153.6" stroke="${t.rim}" stroke-width="1.3" fill="none" opacity=".55"/>
<ellipse cx="100.2" cy="152.4" rx="2.2" ry="1.3" fill="${t.sh}" opacity=".35" filter="url(#${u}-soft)"/><path d="M86 149H114V154H86Z" fill="url(#${u}-f-nb)"/></g>`;
  const brow = `M91.2 79.4Q81.4 73.6 68.6 79.4Q81.2 75.4 91 80.6Z`;
  const brows = `<g fill="${mix(c.hair[2], c.skin[2], .45)}" opacity=".72"><path d="${brow}"/><path d="${brow}" transform="translate(200 0) scale(-1 1)"/></g>`;
  // Nose: a small wedge-shaped form. The viewer-left plane of the bridge turns away from the key, so it takes a narrow soft shade
  // that widens into a crisp cel wedge down the side of the tip; the tip's underside and its cast shadow fall down-left; the right
  // ridge of the bridge catches a thin lit line ending in a tiny specular on the tip. Only a short, thin line marks the tip itself.
  const nose = `<path d="M101 104.4Q100.4 110.6 98.4 116.8L99.8 117.6Q100.8 110.8 101.3 104.4Z" fill="url(#${u}-f-nsh)"/>
<path d="M100.6 109.2Q99 114.6 97.4 118.4Q98.2 120.2 100.4 120.5L100.9 119.2Q100.4 114.6 100.6 109.2Z" fill="${t.sh}" opacity=".95" filter="url(#${u}-f-cel)"/>
<path d="M98 119.8Q99.2 121.4 101.6 121.1Q102.4 120.8 102.4 120.2Q100.4 120.8 98 119.8Z" fill="${t.core}" opacity=".45" filter="url(#${u}-f-cel)"/>
<path d="M98.6 118.9Q99.4 120.1 100.9 120.2" stroke="${t.line}" stroke-width=".6" fill="none" stroke-linecap="round" opacity=".8"/>
<path d="M101.5 108.2Q101.4 112.4 101.1 115.9" stroke="#fffdf8" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".75"/><circle cx="101.5" cy="118.2" r=".75" fill="#fff" opacity=".85"/>`;
  const [sideL, sideR] = h.side;
  // Skin: flat base, a broad soft turn on the shadow side, then the crisp cel band down the left contour and round the jaw;
  // the fringe drops its tips as a shadow down-left onto the brow (with a darker core right under them), the right side lock
  // shades the lit cheek, and the right contour carries the warm rim.
  const skin = `<path d="${face}" fill="url(#${u}-f-skinF)"/>
<g clip-path="url(#${u}-f-clip)"><path d="M56 80C55 104 62 124 84 138L88 130C74 120 67 104 68 84Z" fill="${t.sh}" opacity=".35" filter="url(#${u}-soft3)"/>
<path d="M56 70V84C55.5 104 62 121 79.5 134.5Q92 144.5 100.5 147.5L102.6 145.8Q94 142.4 86 134.5Q79 127 76.5 121.5Q70 118.5 67.6 110C66 102 65.4 90 64 70Z" fill="${t.sh}" opacity=".78" filter="url(#${u}-f-cel)"/>
<path d="M56 84C55.5 104 62 121 79.5 134.5Q92 144.5 100.5 147.5L100.5 146.2Q91 143.4 81 134.6C65 121 59 106 58.2 84Z" fill="${t.core}" opacity=".2"/>
<path d="${h.fringe}" fill="${t.sh}" opacity=".9" transform="translate(-3.2 6.6)" filter="url(#${u}-f-cel)"/><path d="${h.fringe}" fill="${t.sh}" opacity=".35" transform="translate(-2 11)" filter="url(#${u}-soft3)"/><path d="${h.fringe}" fill="${t.core}" opacity=".45" transform="translate(-1.1 2)" filter="url(#${u}-f-cel)"/>
<path d="${sideR}" fill="${t.sh}" opacity=".8" transform="translate(-3.6 2.6)" filter="url(#${u}-f-cel)"/><path d="${sideL}" fill="${t.core}" opacity=".28" transform="translate(1.4 1)" filter="url(#${u}-f-cel)"/>
<ellipse cx="121.5" cy="121.5" rx="9" ry="3.6" transform="rotate(-24 121.5 121.5)" fill="url(#${u}-f-glow)" opacity="${r1(t.glow)}"/>
<path d="M142.6 86C143 104 137.6 120 121 133.4Q111 141.4 103 145" stroke="${t.rim}" stroke-width="2.2" fill="none" opacity=".75"/></g>
<path d="${face}" fill="none" stroke="url(#${u}-f-ol)" stroke-width=".55"/>
<ellipse cx="74" cy="118" rx="11" ry="5.5" fill="url(#${u}-blush)"/><ellipse cx="126" cy="118" rx="11" ry="5.5" fill="url(#${u}-blush)"/><g stroke="${mix(t.blush, '#b8504c', .35)}" stroke-width=".6" opacity=".55" stroke-linecap="round"><path d="M68.2 117.4l2-3.2M71.6 117.8l2-3.2M75 118.2l2-3.2M78.4 118.2l1.6-2.6"/><path d="M122 118l1.6-2.6M124.6 117.8l2-3.2M128 117.6l2-3.2M131.4 117.2l2-3.2"/></g>
${eye(u, c, t, 1)}<g transform="translate(200 0) scale(-1 1)">${eye(u, c, t, -1)}</g>
${brows}
${nose}${c.mole ? '<circle cx="125" cy="116" r=".95" fill="#5a3a34"/>' : ''}
${mouth(c, t)}`;
  return { defs, neck, face: skin };
}
