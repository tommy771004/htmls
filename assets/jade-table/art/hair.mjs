// 青雀 art · hair: the back mass, side locks, fringe with its partings and shine, flyaways and the hair ornament.
// Layers are SVG strings in the portrait's 200×240 space; u is the per-portrait id prefix, c an entry of CAST.
// Lighting follows the table's key light from the viewer's upper right: each lock is a cel-shaded clump (base tone, a first shadow
// along its left and underside, a darker core where it meets the next lock), the shine is a row of per-lock highlights that follow
// the skull and brighten to the right, and a thin warm rim runs down the right silhouettes. The back mass sits a step darker.
import { grad, r1 } from './common.mjs';

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const B = rgb(b); return '#' + rgb(a).map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const lum = h => { const [r, g, b] = rgb(h); return (.2126 * r + .7152 * g + .0722 * b) / 255; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
// Mirror an absolute M/L/Q/C/S path across the head's centre line (x → 200 - x).
const mirror = d => { let i = 0; return d.replace(/-?\d*\.?\d+/g, n => (i++ % 2 ? n : r1(200 - n))); };
// A lens along p1→p2, w wide at the middle, bowed by b; used for strand highlights and shadow slivers.
const lens = ([x1, y1], [x2, y2], w, b = 0) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
  return `M${r1(x1)} ${r1(y1)}Q${r1(mx + nx * (w + b))} ${r1(my + ny * (w + b))} ${r1(x2)} ${r1(y2)}Q${r1(mx - nx * (w - b))} ${r1(my - ny * (w - b))} ${r1(x1)} ${r1(y1)}Z`;
};
// Quadratic Bézier helpers: a point at t, and the sub-curve t0..t1 as an M…Q string (optionally shifted by dx).
const qp = ([a, b, c], t) => [0, 1].map(k => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * b[k] + t * t * c[k]);
const qsub = (P, t0, t1, dx = 0) => {
  const s = qp(P, t0), e = qp(P, t1), k = [0, 1].map(i => s[i] + (t1 - t0) * ((1 - t0) * (P[1][i] - P[0][i]) + t0 * (P[2][i] - P[1][i])));
  return `M${r1(s[0] + dx)} ${r1(s[1])}Q${r1(k[0] + dx)} ${r1(k[1])} ${r1(e[0] + dx)} ${r1(e[1])}`;
};
// Catmull-Rom through pts as cubic segments (the current point is pts[0]).
const R = Math.round;
const crv = pts => pts.slice(1).map((p, i) => { const a = pts[i - 1] ?? pts[i], b = pts[i], d = pts[i + 2] ?? p;
  return `C${R(b[0] + (p[0] - a[0]) / 6)} ${R(b[1] + (p[1] - a[1]) / 6)} ${R(p[0] - (d[0] - b[0]) / 6)} ${R(p[1] - (d[1] - b[1]) / 6)} ${R(p[0])} ${R(p[1])}`; }).join('');

// Hair: the fringe is one mass whose lower edge alternates tips and shallow valleys; from each valley a parting line runs up
// towards the crown, which is what makes it read as separate locks. Side locks frame the cheeks; the back mass sits behind.
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
  const valleys = pts.filter(p => p.valley);
  const partings = valleys.map(p => `M${r1(p.x)} ${r1(p.y)}Q${r1(p.x + (p.x - 100) * .08)} ${r1(p.y - 18)} ${r1(100 + (p.x - 100) * .55)} ${r1(p.y - 34)}`);
  const glints = tips.filter((_, i) => i % 2 && i < tips.length - 1).map(([x, y, bend]) => `M${r1(x - bend * .6 + (100 - x) * .06)} ${r1(y - 30)}Q${r1(x - bend * .3)} ${r1(y - 24)} ${r1(x - bend * .1)} ${r1(y - 17)}`);
  return { fringe: d, partings, glints, valleys };
}
// The lower edge of a short back mass as tapered clump ends. seg lists the right half from the outer side inwards as
// [cx, cy, x, y] quadratic segments (tips and valleys alternate); the left half is its mirror, walked the other way.
function hem(top, side, seg) {
  const V = [[side[4], side[5]], ...seg.map(s => [s[2], s[3]])], m = x => r1(200 - x), [ex, ey] = top.split(' ').slice(-2).map(Number);
  let d = `${top}C${side.join(' ')}${seg.map(s => `Q${s.join(' ')}`).join('')}L${m(V.at(-1)[0])} ${V.at(-1)[1]}`;
  for (let k = seg.length; k > 0; k--) d += `Q${m(seg[k - 1][0])} ${seg[k - 1][1]} ${m(V[k - 1][0])} ${V[k - 1][1]}`;
  return `${d}C${m(side[2])} ${side[3]} ${m(side[0])} ${side[1]} ${m(ex)} ${ey}Z`;
}
// A wavy long lock drawn round a sine centre line: 70% wide at the temple, full at the first crest, tapering to a point.
function waveLock(off, phase, wS, yEnd) {
  const cx = y => { const e = clamp((y - 100) / 34), w = 52.5 + off + 6.5 * (.5 + .5 * e) * Math.sin(2 * Math.PI * (y - 122 - phase) / 74) + 3 * (1 - e), k = clamp((y - 84) / 24); return 61 + off * .3 + (w - 61 - off * .3) * k * k * (3 - 2 * k); };
  const wd = y => y < 112 ? wS * (.7 + .3 * (y - 84) / 28) : 2 + (wS - 2) * (1 - ((y - 112) / (yEnd - 112)) ** 1.6);
  const ys = []; for (let y = 84; y < yEnd - 6; y += 12) ys.push(y); ys.push(yEnd - 2);
  const Lp = ys.map(y => [cx(y) - wd(y) / 2, y]), Rp = ys.map(y => [cx(y) + wd(y) / 2, y]).reverse();
  const tip = [cx(yEnd) + 1.5, yEnd + 4];
  const crest = y => [cx(y) + wd(y) / 2, y];
  // A parting strand down the lock, a little left of centre, so each lock splits into two clumps.
  const sy = [112, 134, 156, 178, 200, 222, yEnd - 14], sp = sy.map(y => [cx(y) - wd(y) * .12, y]);
  return { d: `M${R(Lp[0][0])} ${Lp[0][1]}${crv(Lp)}L${R(tip[0])} ${R(tip[1])}L${R(Rp[0][0])} ${Rp[0][1]}${crv(Rp)}Z`, strand: `M${R(sp[0][0])} ${sp[0][1]}${crv(sp)}`, crest, cx, wd };
}
const WL = waveLock(2.4, 0, 12.5, 246), WX = waveLock(-5.5, 7, 12, 234);
const crestY = [140.5, 214.5], troughY = [103.5, 177.5];
const bobHem = hem('M42 100C34 50 66 22 100 22S166 50 158 100', [162, 128, 162, 150, 155, 172],
  [[153, 163, 150, 156], [151, 164, 144, 168], [141, 161, 138, 155], [137, 161, 131, 165], [128, 159, 125, 154], [124, 159, 119, 161], [115, 157, 111, 153]]);
const ponyHem = hem('M46 98C40 52 68 26 100 26S160 52 154 98', [156, 118, 156, 136, 151, 154],
  [[149, 146, 146, 140], [147, 147, 141, 151], [139, 145, 135, 139], [135, 146, 128, 149], [126, 143, 123, 138], [122, 144, 116, 146], [114, 142, 112, 139]]);
const hemV = v => [...v, ...v.map(([x, y]) => [200 - x, y])];

// back: the mass behind the head; side: [left, right] locks framing the cheeks; extra: outer clumps drawn behind the side locks;
// clumps: partings inside the back mass; shine: [p1, p2, w] strand highlights on the side locks, right of each lock's centre;
// ends: the valleys between the clump ends of a short back mass (a dark core wedge sits in each).
export const HAIR = {
  bob: {
    back: bobHem,
    ends: hemV([[150, 156], [138, 155], [125, 154]]),
    tips: [[54, 104, -6], [66, 96, -5], [79, 92, -4], [92, 88, -2], [104, 90, 3], [117, 93, 5], [130, 96, 6], [146, 104, 7]],
    side: ['M58 80C44 108 46 140 60 164Q58 142 66 124Q61 104 64 86Z', 'M142 80C156 108 154 140 140 164Q142 142 134 124Q139 104 136 86Z'],
    extra: ['M50 104C42 124 44 148 52 168Q54 150 58 136Q54 120 56 108Z'],
    clumps: ['M47 110Q42 138 48 168', 'M153 110Q158 138 152 168'],
    shine: [[[58, 98], [55, 132], 1.4], [[146, 100], [148, 134], 1.6]]
  },
  long: {
    back: 'M40 100C32 50 66 22 100 22S168 50 160 100C166 150 174 200 182 240L18 240C26 200 34 150 40 100Z',
    tips: [[53, 108, -7], [65, 99, -6], [78, 93, -4], [91, 90, -2], [101, 96, 1], [112, 91, 3], [125, 95, 5], [138, 100, 7], [148, 110, 8]],
    side: ['M58 80C42 124 46 180 50 236Q60 186 62 138Q60 104 64 86Z', 'M142 80C158 124 154 180 150 236Q140 186 138 138Q140 104 136 86Z'],
    extra: ['M52 112C40 150 36 196 28 246C38 236 42 226 44 212C46 190 50 156 58 124Z'],
    clumps: ['M44 110Q36 170 30 236', 'M156 110Q164 170 170 236', 'M160 150Q168 200 176 238'],
    shine: [[[57, 98], [53, 176], 1.5], [[146, 98], [149, 176], 1.8]]
  },
  ponytail: {
    back: ponyHem,
    ends: hemV([[146, 140], [135, 139], [123, 138]]),
    tail: 'M130 36C160 20 186 42 182 80C180 120 186 170 198 214C178 192 166 152 162 112C160 82 152 58 130 52Z',
    tailLocks: ['M146 40C164 40 176 60 174 90C172 128 178 164 190 204C174 184 168 150 168 118C168 88 162 60 146 50Z', 'M138 44C152 46 160 64 160 90C160 120 166 150 176 180C164 166 158 140 158 112C158 84 150 62 138 52Z'],
    tips: [[55, 100, -6], [68, 92, -5], [82, 87, -3], [97, 85, 2], [111, 88, 4], [125, 92, 6], [140, 98, 7], [148, 106, 7]],
    side: ['M60 80C50 102 52 126 60 146Q60 128 66 114Q62 100 64 86Z', 'M140 80C150 102 148 126 140 146Q140 128 134 114Q138 100 136 86Z'],
    extra: [],
    clumps: ['M49 104Q46 126 52 144', 'M151 104Q154 126 148 144'],
    shine: [[[60, 96], [58, 124], 1.2], [[145, 96], [147, 126], 1.4]]
  },
  wave: {
    back: 'M38 100C30 50 66 22 100 22S170 50 162 100C174 134 164 160 176 196C184 214 180 230 184 240L16 240C20 230 16 214 24 196C36 160 26 134 38 100Z',
    tips: [[52, 106, -8], [66, 96, -7], [82, 88, -5], [96, 84, 2], [112, 88, 7], [128, 94, 9], [146, 104, 10]],
    side: [WL.d, mirror(WL.d)],
    strand: [WL.strand, mirror(WL.strand)],
    extra: [WX.d],
    clumps: ['M40 108Q30 134 36 160Q42 184 28 210Q22 226 26 238', 'M160 108Q170 134 164 160Q158 184 172 210Q178 226 174 238'],
    // Crest highlights: short arcs only where a lock's edge bulges towards the light (right), bowed with the bulge.
    shine: [...crestY.map(y => { const [x] = WL.crest(y); return [[x - 2.6, y - 8], [x - 2.6, y + 7], .9 - (y - 140) / 200, -1.2]; }),
      ...troughY.map(y => { const x = 200 - (WL.cx(y) - WL.wd(y) / 2); return [[x - 2.6, y - 8], [x - 2.6, y + 7], 1.2 - (y - 104) / 200, -1.4]; })],
    xshine: [[], troughY.slice(1).map(y => { const x = 200 - (WX.cx(y + 7) - WX.wd(y + 7) / 2); return [[x - 2.4, y - 1], [x - 2.4, y + 13], 1, -1.2]; })]
  }
};
for (const h of Object.values(HAIR)) Object.assign(h, fringe(h.tips));

// A small round bead lit from the upper right: base, a core shadow crescent on the lower left, a highlight and a hairline outline.
const bead = (x, y, r, fill, shade, rim) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${rim}" stroke-width=".35"/><path d="M${r1(x - r * .92)} ${r1(y - r * .2)}A${r} ${r} 0 0 0 ${r1(x + r * .3)} ${r1(y + r * .95)}A${r1(r * 1.1)} ${r1(r * 1.1)} 0 0 1 ${r1(x - r * .92)} ${r1(y - r * .2)}Z" fill="${shade}" opacity=".55"/><circle cx="${r1(x + r * .35)}" cy="${r1(y - r * .38)}" r="${r1(r * .32)}" fill="#fff" opacity=".9"/>`;

// Hair ornaments: each is a small crafted object with its own light, pinned at the right temple, casting a soft-edged shadow down-left.
function accessory(u, c, core) {
  const G = `url(#${u}-h-gold)`, J = `url(#${u}-h-jade)`, P = `url(#${u}-h-pearl)`, cast = `fill="${core}" opacity=".4"`;
  switch (c.acc) {
    case 'sparrow': {
      const body = 'M0 0C6-10 20-12 28-4C22-3 18 0 16 5C12 3 6 3 0 0Z', wing = 'M16 5C18 10 16 16 10 18C12 12 10 8 6 6Z';
      return `<g transform="translate(138 52) rotate(18)"><path d="${body}" transform="translate(-1.5 3)" ${cast}/><path d="${body}" fill="${G}" stroke="#5e4015" stroke-width=".6"/><path d="M1 .6C7 1.6 12 2.6 16 5C18 1 22-2 27-3.4C20-2.4 16-.6 14 1.6C9 .6 5 .4 1 .6Z" fill="#8a6225" opacity=".6"/><path d="M9-6.5Q17-11 25-6.4" stroke="#fff6d8" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".85"/><path d="${wing}" fill="#a67a32" stroke="#5e4015" stroke-width=".6"/><path d="M15 7Q15 12 11 16M12 7Q12 11 9.5 13" stroke="#6b4a1a" stroke-width=".5" fill="none"/><path d="M17 6.5Q17.5 11 14 15.5" stroke="#f1d58e" stroke-width=".6" fill="none" opacity=".8"/><circle cx="21" cy="-5" r="1.4" fill="#2a1a0c"/><circle cx="21.5" cy="-5.5" r=".45" fill="#fff"/><path d="M28-4l5 1-5 2z" fill="#9c6e28" stroke="#5e4015" stroke-width=".3"/></g>`
        + `<g stroke="#8a6225" stroke-width="1.1"><path d="M145.6 60V86M150.6 58V80M140.6 62V78"/></g><g stroke="#f1d58e" stroke-width=".45"><path d="M146.3 60V86M151.3 58V80M141.3 62V78"/></g>${bead(146, 88, 2.6, J, '#0a3d2b', '#0a3d2b')}${bead(151, 82, 2.2, J, '#0a3d2b', '#0a3d2b')}${bead(141, 80, 2, J, '#0a3d2b', '#0a3d2b')}`;
    }
    case 'moon': {
      const m = 'M0 0A14 14 0 1 0 14 18 11 11 0 1 1 0 0Z';
      return `<g transform="translate(142 46)"><path d="${m}" transform="translate(-2 3)" ${cast}/><clipPath id="${u}-h-moonclip"><path d="${m}"/></clipPath><path d="${m}" fill="#9a7230"/><g clip-path="url(#${u}-h-moonclip)"><path d="${m}" fill="${G}" transform="translate(1.6 -1.4)"/><path d="M14 18A11 11 0 1 1 0 0" fill="none" stroke="#fff4d0" stroke-width="1.6" opacity=".75"/></g><path d="${m}" fill="none" stroke="#5e4015" stroke-width=".6"/><circle cx="16" cy="4" r="2" fill="#fff8e0"/><circle cx="16.5" cy="3.4" r=".7" fill="#fff"/></g>`
        + `<g stroke="#a88a52" stroke-width=".9"><path d="M149.6 68V96M154.6 66V88"/></g><g stroke="#fff0c8" stroke-width=".4"><path d="M150.2 68V96M155.2 66V88"/></g>${bead(150, 98, 2.4, P, '#9c917a', '#8a8068')}${bead(155, 90, 2, P, '#9c917a', '#8a8068')}`;
    }
    case 'mask': {
      const m = 'M0 12C0 0 8-6 14-4L18-14 22-2C28-2 34 4 34 14C34 26 26 34 17 34S0 26 0 12Z';
      return `<g transform="translate(134 30) rotate(24)"><path d="${m}" transform="translate(-1 4)" ${cast}/><clipPath id="${u}-h-maskclip"><path d="${m}"/></clipPath><path d="${m}" fill="#cfc2a4"/><g clip-path="url(#${u}-h-maskclip)"><path d="${m}" fill="#e6dcc6" transform="translate(1.4 -1.8)"/><path d="${m}" fill="#fbf7ec" transform="translate(3.6 -3.4)"/><ellipse cx="25" cy="8" rx="4" ry="2.6" fill="#fff" opacity=".9" transform="rotate(-30 25 8)"/></g><path d="${m}" fill="none" stroke="#8a7c5e" stroke-width=".8"/><path d="M6 14Q10 10 13 14M21 14Q24 10 28 14" stroke="#b8322b" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M15 24Q17 27 19 24" stroke="#1c1c1c" stroke-width="1" fill="none"/><path d="M14-4L18-11 21-3" fill="#c9766c" fill-opacity=".7"/><path d="M4 20Q8 22 10 19M30 20Q26 22 24 19" stroke="#b8322b" stroke-width="1.2" fill="none"/></g><path d="M126 50C132 44 138 44 142 48" stroke="#7d1f1a" stroke-width="2.6" fill="none"/><path d="M126.4 49.2C132 43.6 138 43.4 141.6 47" stroke="#d2483f" stroke-width="1" fill="none"/>`;
    }
    case 'jade': return `<path d="M127 42L159 72" stroke="${core}" stroke-width="2.4" stroke-linecap="round" opacity=".4"/><path d="M128 40L160 70" stroke="#6b4a1a" stroke-width="3" stroke-linecap="round"/><path d="M128 40L160 70" stroke="${G}" stroke-width="2.2" stroke-linecap="round"/><path d="M130 40.6L159.4 68.2" stroke="#fff3cf" stroke-width=".6" stroke-linecap="round" opacity=".9"/>${bead(128, 40, 5, J, '#0a3d2b', '#0a3d2b')}<path d="M154 64l6 12M158 62l7 9" stroke="#a88346" stroke-width=".8"/>${bead(160, 77, 2, J, '#0a3d2b', '#0a3d2b')}${bead(165, 72, 1.7, J, '#0a3d2b', '#0a3d2b')}`;
  }
  return '';
}

// Where the angel ring sits on the skull, the lower-left jaw line (for the occlusion on the back hair behind it), and the bust's
// shoulder silhouette (so the side locks only cast onto cloth, never onto the backdrop).
const ringY = x => 53 + ((x - 100) / 48) ** 2 * 15;
const JAW = 'M60 108C63 120 69 128 80 134Q92 144 100 146';
const SHOULDERS = 'M4 240C8 198 34 174 70 164Q80 160 88 154L112 154Q120 160 130 164C166 174 192 198 196 240Z';

export function hairLayers(c, u) {
  const h = HAIR[c.style];
  // Light hair (月白) takes a pale cool grey-blue for its shadows and much gentler occlusion, so it stays moon-white.
  const lt = lum(c.hair[0]) > .7, cool = lt ? '#8a9fa3' : '#123c3a', warm = '#ffe3ad';
  // 月白's first shadow sits a clear step below its white (cool grey-jade), so the locks separate without going muddy.
  const sh1 = lt ? mix(mix(c.hair[1], c.hair[2], .72), cool, .3) : mix(mix(c.hair[1], c.hair[2], .6), cool, .14);
  const core = mix(mix(c.hair[2], c.line, lt ? .38 : .5), cool, lt ? .18 : .1);
  const rimC = lt ? warm : mix('#ffd48a', c.sheen, .05), jadeB = mix(mix('#3e9c78', c.kimono[0], .35), c.hair[0], .3);
  // The jade bounce is light returned by the kimono below, so it is strongest for the saturated greens and faint for grey cloth.
  const kr = rgb(c.kimono[0]), bS = clamp(.3 + 2 * (Math.max(...kr) - Math.min(...kr)) / 255);
  const ring = mix(c.sheen, '#fff3d6', .3), ol = mix(c.hair[2], c.line, .55);
  // Dark hair's lower values are pulled a step towards the jade room tone, more for the greener heads, so they hold off the backdrop.
  const lift = clamp(.12 + 1.2 * lum(c.hair[1]), 0, .4), jl = mix(cool, c.sheen, .35);
  const backMid = lt ? mix(c.hair[0], c.hair[1], .6) : mix(c.hair[1], c.hair[2], .45);
  // Dark hair: the back mass is lifted a step off black towards its mid tone so the silhouette holds against a dark room.
  const backStops = lt ? [[0, backMid], [.5, mix(c.hair[1], c.hair[2], .2)], [1, mix(c.hair[1], c.hair[2], .55)]]
    : [[0, backMid], [.5, mix(mix(c.hair[1], c.hair[2], .4), cool, .14)], [1, mix(mix(c.hair[1], c.hair[2], .4), jl, lift)]];
  const occ = lt ? .55 : 1;
  const sides = h.side, extras = [...h.extra, ...h.extra.map(mirror)];
  // One cel-shaded clump: base gradient, then inside its own clip the first shadow and the core as slivers along the left and
  // underside (left by shifting the lit base up and right), strand shine, and a warm rim stroke that only shows on the right.
  const clips = [], U = (id, a = '') => `<use href="#${id}" ${a}/>`;
  const shape = (id, d) => (clips.push(`<path id="${id}" d="${d}"/>`), id);
  const OL = `url(#${u}-h-ol)`;
  // Rim and bounce are slivers inside a shape: the shape minus a copy of itself nudged away from the light (a mask), blurred
  // by one filter and then clipped by the shape, so the silhouette edge stays crisp and the sliver fades inwards, never outside.
  const sliver = (p, id, dx, dy, paint) => (clips.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="300"><g filter="url(#${u}-h-rimblur)">${U(p, 'fill="#fff"')}${U(p, `fill="#000" transform="translate(${dx} ${dy})"`)}</g></mask>`),
    `<rect x="-20" y="-20" width="240" height="300" fill="url(#${u}-h-${paint})" mask="url(#${id})"/>`);
  const rim = (p, id, w = 1.5) => sliver(p, id + 'rm', -w, r1(w * .4), 'rimG');
  const bounce = (p, id, w = 2.6) => lt ? '' : sliver(p, id + 'bm', w, -w * .5, 'bnc');
  const clump = (d, id, s, fill = `url(#${u}-hair)`, extra = '', stroke = .7) => {
    const p = shape(id + 'p', d);
    clips.push(`<clipPath id="${id}">${U(p)}</clipPath>`);
    return `${U(p, `fill="${core}"`)}<g clip-path="url(#${id})">${U(p, `fill="${sh1}" transform="translate(${r1(s * .3)} ${r1(-s * .15)})"`)}${U(p, `fill="${fill}" transform="translate(${s} ${r1(-s * .45)})"`)}${extra}${rim(p, id)}${id.includes('-s0') || id.includes('-x0') ? bounce(p, id) : ''}</g>${U(p, `fill="none" stroke="${OL}" stroke-width="${stroke}"`)}`;
  };
  const shine = (list, a = .55) => list.map(([p, q, w, b = 0]) => `<path d="${lens(p, q, w, b)}" fill="${ring}" opacity="${r1(a * (p[0] > 100 ? 1.25 : .7))}"/>`).join('');

  // Broken angel ring: one short highlight per lock, laid between that lock's partings along the skull curve, tapered at both
  // ends and dipping a small tooth down the lock. Only faint on the shadow side; widest and brightest from about x110 rightwards.
  const partX = (p, y) => { const P = [[p.x, p.y], [p.x + (p.x - 100) * .08, p.y - 18], [100 + (p.x - 100) * .55, p.y - 34]];
    let best = P[0], e = 1e9; for (let t = 0; t <= 1; t += .05) { const q = qp(P, t), d = Math.abs(q[1] - y); if (d < e) { e = d; best = q; } } return best[0]; };
  const vx = h.valleys.map(p => partX(p, ringY(p.x)));
  let ringD = '', specD = '', ringLo = '';
  h.tips.forEach(([x, y], i) => {
    const xa = i ? vx[i - 1] + 1.3 : x - 4, xb = i < vx.length ? vx[i] - 1.3 : x + 3, xm = (xa + xb) / 2;
    const t = clamp((xm - 72) / 72), a = .88 * t ** 1.3;
    if (xm < 70 || xm > 152 || a < .05 || xb - xa < 3) return;
    const w = 1 + 2.4 * t, root = [100 + (x - 100) * .55, y - 44], L = Math.hypot(x - root[0], y - root[1]), dir = [(x - root[0]) / L, (y - root[1]) / L];
    const ym = ringY(xm) + w * .8;
    const pc = lens([xa, ringY(xa) + 1], [xb, ringY(xb) + 1], w, 1.1);
    if (lt) ringLo += pc;
    ringD += `<path d="${pc}${t > .5 ? lens([xm + 1.2 + dir[0] * 3, ym + 1.4 + dir[1] * 3], [xm + 1.2 + dir[0] * (7 + 4 * t), ym + 1.4 + dir[1] * (7 + 4 * t)], .45 + .4 * t) : ''}" fill="${ring}" opacity="${r1(a * 100) / 100}"/>`;
    if (xm > 114 && xm < 146) specD += lens([xm, ringY(xm) + .6], [xb - .8, ringY(xb - .8) + .6], .8, .2);
  });
  // Per lock: a shadow wedge on the right of each parting (the next lock's left side), a lit edge on its left (the previous lock's
  // right side), and strands down the lock's own centre line (dark on its left, light on the lit locks' right), never crossing a parting.
  const wedges = h.valleys.map(p => { const tx = 100 + (p.x - 100) * .55, ty = p.y - 34, cx = p.x + (p.x - 100) * .08, cy = p.y - 18;
    return `M${r1(p.x)} ${r1(p.y)}Q${r1(cx)} ${r1(cy)} ${r1(tx)} ${r1(ty)}Q${r1(cx + 3.4)} ${r1(cy + 1)} ${r1(p.x + 4)} ${r1(p.y + 2.5)}Z`; }).join('');
  const edges = h.valleys.filter(p => p.x > 90).map(p => `M${r1(p.x - 1.3)} ${r1(p.y - 1)}Q${r1(p.x - 1.3 + (p.x - 100) * .08)} ${r1(p.y - 18)} ${r1(100 + (p.x - 100) * .55 - 1.2)} ${r1(p.y - 33)}`).join('');
  const lockP = ([x, y, b]) => [[100 + (x - 100) * .55, y - 44], [x + (x - 100) * .06 - b * .2, y - 22], [x, y]];
  const dark = h.tips.map(tp => qsub(lockP(tp), .3, .86, -1.5)).join('');
  const lite = h.tips.filter(([x], i) => i % 2 && x > 96 && x < 142).map(tp => qsub(lockP(tp), .42, .72, 1.3)).join('');
  const strands = `<path d="${dark}" stroke="${sh1}" stroke-width=".6" fill="none" opacity=".6"/><path d="${lite}" stroke="${ring}" stroke-width=".55" fill="none" opacity=".4"/>`;

  const defs = `
${grad(`${u}-hair`, lt ? [[0, c.hair[0]], [.55, mix(c.hair[0], c.hair[1], .55)], [1, mix(c.hair[1], c.hair[2], .3)]] : [[0, c.hair[0]], [.45, c.hair[1]], [1, c.hair[2]]])}
${grad(`${u}-h-lock`, lt ? [[0, c.hair[0]], [.35, mix(c.hair[0], c.hair[1], .75)], [1, mix(c.hair[1], c.hair[2], .45)]] : [[0, c.hair[0]], [.5, mix(c.hair[0], c.hair[1], .6)], [1, mix(mix(c.hair[0], c.hair[1], .85), jl, lift)]])}
${grad(`${u}-h-back`, backStops)}
<clipPath id="${u}-fringeclip"><path d="${h.fringe}"/></clipPath><clipPath id="${u}-h-backclip"><use href="#${u}-h-bk"/></clipPath>
<clipPath id="${u}-h-sideclip">${[...sides.map((_, i) => `s${i}`), ...extras.map((_, i) => `x${i}`)].map(k => `<use href="#${u}-h-${k}p"/>`).join('')}</clipPath>
<clipPath id="${u}-h-low"><path d="${SHOULDERS}"/></clipPath><clipPath id="${u}-h-jaw"><rect y="118" width="104" height="40"/></clipPath>
<radialGradient id="${u}-h-rimG" gradientUnits="userSpaceOnUse" cx="176" cy="54" r="92" gradientTransform="matrix(1 0 0 1.35 0 -18.9)"><stop offset="0" stop-color="${rimC}" stop-opacity="${lt ? .6 : .95}"/><stop offset=".4" stop-color="${rimC}" stop-opacity="${lt ? .3 : .36}"/><stop offset="1" stop-color="${rimC}" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}-h-bnc" gradientUnits="userSpaceOnUse" cx="30" cy="200" r="90"><stop offset="0" stop-color="${jadeB}" stop-opacity="${r1(.7 * bS * 100) / 100}"/><stop offset=".5" stop-color="${jadeB}" stop-opacity="${r1(.38 * bS * 100) / 100}"/><stop offset="1" stop-color="${jadeB}" stop-opacity="0"/></radialGradient>
<filter id="${u}-h-rimblur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".6"/></filter>
<linearGradient id="${u}-h-ol" gradientUnits="userSpaceOnUse" x1="60" x2="170" y1="0" y2="0"><stop offset=".45" stop-color="${ol}"/><stop offset="1" stop-color="${mix(ol, c.hair[1], .45)}"/></linearGradient>
<linearGradient id="${u}-h-occ" gradientUnits="userSpaceOnUse" x1="58" x2="102" y1="0" y2="0"><stop offset="0" stop-color="${mix(c.hair[2], cool, .2)}"/><stop offset="1" stop-color="${mix(c.hair[2], cool, .2)}" stop-opacity="0"/></linearGradient>
${grad(`${u}-h-dim`, [[0, cool, lt ? .2 : .38], [.5, cool, 0], [1, cool, 0]], 1, 0)}
${grad(`${u}-h-tip`, [[0, c.skin[1], 0], [.78, c.skin[1], 0], [1, c.skin[1], .22]])}
<radialGradient id="${u}-h-nape" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="${core}" stop-opacity="${r1(.85 * occ * 100) / 100}"/><stop offset=".6" stop-color="${core}" stop-opacity="${r1(.45 * occ * 100) / 100}"/><stop offset="1" stop-color="${core}" stop-opacity="0"/></radialGradient>
<linearGradient id="${u}-h-gold" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c0"/><stop offset=".45" stop-color="#d9b262"/><stop offset="1" stop-color="#8a6225"/></linearGradient>
<radialGradient id="${u}-h-jade" cx=".66" cy=".32" r=".8"><stop offset="0" stop-color="#c9f5df"/><stop offset=".4" stop-color="#43b088"/><stop offset="1" stop-color="#0e5a40"/></radialGradient>
<radialGradient id="${u}-h-pearl" cx=".66" cy=".32" r=".8"><stop offset="0" stop-color="#fffefa"/><stop offset=".5" stop-color="#f1ecdc"/><stop offset="1" stop-color="#c2b89c"/></radialGradient>
`;

  // Back: tail first (behind the head), then the mass in its darker occluded tone, its clump partings, dark core wedges between
  // the clump ends, the shadow the side locks cast onto it, the occlusion behind the neck and under the jaw (viewer-left only),
  // and a rim down the right silhouette.
  const tail = h.tail ? `${clump(h.tail, `${u}-h-tail`, 6, `url(#${u}-hair)`, `${h.tailLocks.map(d => `<path d="${d}" fill="${sh1}" opacity=".75"/><path d="${d}" fill="url(#${u}-hair)" transform="translate(3 -1.5)"/>`).join('')}<path d="M150 50C166 60 170 90 170 120C170 150 176 176 186 200M140 52C152 62 156 88 156 112" stroke="${core}" stroke-width="1" fill="none" opacity=".8"/>${shine([[[166, 50], [176, 96], 1.8], [[172, 110], [182, 170], 1.4], [[154, 58], [162, 100], 1.2]], .6)}<path d="M126 44Q140 36 158 44" stroke="${core}" stroke-width="7" fill="none" opacity=".45"/>`)}
<path d="M127 38.5Q134 31 142.5 36.5" stroke="#6e1712" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M127 38Q134 31 142 36" stroke="#b8322b" stroke-width="4.2" stroke-linecap="round" fill="none"/><path d="M129.5 35Q134 32 139.5 34" stroke="#ec7a6e" stroke-width="1" stroke-linecap="round" fill="none" opacity=".85"/><path d="M131 34.4l.6 4.6M135 33.2l.4 4.8M139 33.6l-.2 4.6" stroke="#6e1712" stroke-width=".6"/>${bead(143.5, 38, 2, `url(#${u}-h-gold)`, '#5e4015', '#5e4015')}` : '';
  const bk = shape(`${u}-h-bk`, h.back), ids = [...sides.map((_, i) => `${u}-h-s${i}p`), ...extras.map((_, i) => `${u}-h-x${i}p`)];
  const ends = (h.ends ?? []).map(([x, y]) => { const s = x > 100 ? -1 : 1;
    return `M${r1(x - 1.8)} ${y + 1}Q${r1(x + s * .6)} ${y - 5} ${r1(x + s * 1.2)} ${y - 11}Q${r1(x + s * .6 + .6)} ${y - 4} ${r1(x + 1.8)} ${y + 1}Z`; }).join('');
  const endParts = (h.ends ?? []).map(([x, y]) => `M${x} ${y}Q${r1(x + (x - 100) * .04)} ${y - 10} ${r1(x + (x - 100) * .02)} ${y - 22}`);
  const back = `${tail}
${U(bk, `fill="url(#${u}-h-back)" stroke="${OL}" stroke-width=".8"`)}<g clip-path="url(#${u}-h-backclip)">${U(bk, `fill="url(#${u}-h-dim)"`)}
${[...h.clumps, ...endParts].map(d => `<path d="${d}" stroke="${core}" stroke-width="1.1" fill="none" opacity="${lt ? .5 : .8}"/><path d="${d}" stroke="${c.hair[1]}" stroke-width=".9" fill="none" opacity=".6" transform="translate(2.2 -.6)"/>`).join('')}
${ends ? `<path d="${ends}" fill="${core}" opacity=".75"/>` : ''}
<g fill="${core}" opacity="${lt ? .3 : .34}">${ids.map(id => U(id, 'transform="translate(-3.5 4)"')).join('')}</g>
<ellipse cx="100" cy="150" rx="${lt ? 33 : 25}" ry="30" fill="url(#${u}-h-nape)"/><path d="${JAW}" fill="none" stroke="url(#${u}-h-occ)" stroke-width="4.5" opacity="${lt ? .15 : .28}" transform="translate(-2 3)" clip-path="url(#${u}-h-jaw)"/>
${rim(bk, `${u}-h-bk`, 1.4)}${bounce(bk, `${u}-h-bk`, 3.2)}</g>`;

  // Front: the side locks' cast shadow on the shoulders (the face module draws their shadow on the cheeks), the outer clumps,
  // the side locks, the ahoge, then the fringe with its ring, partings and strands, the fringe's own shadow on the side locks,
  // and the ornament.
  const locks = [...extras.map((d, i) => clump(d, `${u}-h-x${i}`, 3, `url(#${u}-h-back)`, shine(h.xshine?.[i] ?? [], .4), .6)),
    ...sides.map((d, i) => clump(d, `${u}-h-s${i}`, 3.2, `url(#${u}-h-lock)`, (h.strand ? `<path d="${h.strand[i]}" stroke="${core}" stroke-width=".8" fill="none" opacity=".75"/><path d="${h.strand[i]}" stroke="${c.hair[0]}" stroke-width=".6" fill="none" opacity=".35" transform="translate(1.2 -.4)"/>` : '') + shine(h.shine.filter(([p]) => (p[0] > 100) === (i === 1)))))].join('');
  const ahoge = c.ahoge ? clump('M99.5 26C97 13 106 5 116 7C108.5 9 102.5 14 102 26Z', `${u}-h-ah`, 1.6, `url(#${u}-hair)`, `<path d="M103 16Q107 10 113 8" stroke="${ring}" stroke-width=".8" fill="none" opacity=".7"/>`, .6) : '';
  const sideShadow = `<g clip-path="url(#${u}-h-low)" fill="${mix(core, c.band, .25)}" opacity="${lt ? .2 : .3}">${ids.map(id => U(id, 'transform="translate(-3 3)"')).join('')}</g>`;
  const fr = shape(`${u}-h-fr`, h.fringe), F = a => U(fr, a);
  const front = `${sideShadow}
${locks}
<g clip-path="url(#${u}-h-sideclip)">${F(`fill="${core}" opacity="${lt ? .3 : .45}" transform="translate(-2 3.5)"`)}</g>
${ahoge}
${F(`fill="${core}"`)}<g clip-path="url(#${u}-fringeclip)">${F(`fill="${sh1}" transform="translate(1 -.6)"`)}${F(`fill="url(#${u}-hair)" transform="translate(3 -1.8)"`)}
${F(`fill="url(#${u}-h-dim)"`)}${F(`fill="url(#${u}-h-tip)"`)}
<path d="${wedges}" fill="${sh1}" opacity=".9"/><path d="${h.partings.join('')}" stroke="${core}" stroke-width="1" fill="none" opacity="${lt ? .6 : .85}"/><path d="${edges}" stroke="${ring}" stroke-width=".7" fill="none" opacity=".3"/>
${strands}${ringLo ? `<path d="${ringLo}" fill="${sh1}" opacity=".5" transform="translate(-.6 1.6)"/>` : ''}${ringD}<path d="${specD}" fill="#fffaf0" opacity=".6"/>
${rim(fr, `${u}-h-fr`, 1.4)}</g>${F(`fill="none" stroke="${OL}" stroke-width=".7"`)}
${accessory(u, c, core)}`;
  return { defs: defs + clips.join(''), back, front };
}
