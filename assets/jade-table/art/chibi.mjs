// 青雀 art · chibi: the Q 版 sticker heads raised over a seat (../emotes.mjs lists the moods). A 120×120 sticker: a big round head
// on a small kimono torso, the character's own hair shape, colours and ornament, and one exaggerated expression with its manga marks
// (anger cross, tear streams, gloom lines, sweat drop, sparkles). A white die-cut rim keeps it legible over the table.
// Ids use the `${u}-c-` zone; light comes from the upper right like the portraits.
import { grad } from './common.mjs';

const INK = '#3a2418';
// Back hair (behind the face) and the fringe and side locks over it, per hair style.
const BACK = {
  bob: 'M19 60C16 26 38 11 60 11S104 26 101 60C101 78 97 89 91 94H29C23 89 19 78 19 60Z',
  long: 'M19 58C16 24 38 10 60 10S104 24 101 58L108 118C90 122 30 122 12 118Z',
  ponytail: 'M21 60C18 27 39 12 60 12S102 27 99 60C99 74 96 84 92 88H28C24 84 21 74 21 60Z',
  wave: 'M19 58C16 24 38 10 60 10S104 24 101 58C105 72 100 84 107 97C97 102 93 93 88 99H32C27 93 23 102 13 97C20 84 15 72 19 58Z'
};
const LOCKS = {
  bob: 'M25 46C20 62 22 78 30 90C33 76 33 62 35 50ZM95 46C100 62 98 78 90 90C87 76 87 62 85 50Z',
  long: 'M25 46C19 66 20 90 26 106C31 88 32 66 35 50ZM95 46C101 66 100 90 94 106C89 88 88 66 85 50Z',
  ponytail: 'M26 46C22 58 23 70 28 80C31 70 32 58 35 50ZM94 46C98 58 97 70 92 80C89 70 88 58 85 50Z',
  wave: 'M25 46C19 60 25 72 21 86C29 82 33 66 35 50ZM95 46C101 60 95 72 99 86C91 82 87 66 85 50Z'
};
// The fringe dips between strands; `part` moves the parting so each style falls differently.
function fringe(part) {
  const p = part;
  return `M23 56C20 30 39 15 60 15S100 30 97 56C94 48 90 41 ${86 + p} 36C${84 + p} 45 ${78 + p} 50 ${72 + p} 52C${73 + p} 43 ${69 + p} 36 ${64 + p} 31C${60 + p} 42 ${52 + p} 49 ${44 + p} 52C${46 + p} 45 ${46 + p} 40 ${43 + p} 35C37 43 29 48 23 56Z`;
}
const PART = { bob: 0, long: 6, ponytail: -4, wave: 3 };

function ornament(c, u) {
  if (c.acc === 'sparrow') return `<g transform="translate(29 22) rotate(-18)"><path d="M-10 2C-14 6-17 4-19 8-14 9-11 7-8 6Z" fill="${c.kimono[1]}"/><ellipse rx="10" ry="7" fill="${c.kimono[0]}" stroke="${INK}" stroke-width="1.4"/><path d="M-3 3C1 7 7 6 9 2 5 4 0 4-3 3Z" fill="${c.collar}"/><circle cx="5" cy="-2" r="1.6" fill="${INK}"/><path d="M9-1L14 0 9 2Z" fill="#e2b04d"/></g>`;
  if (c.acc === 'moon') return `<path d="M83 13A11 11 0 1 0 98 30 9 9 0 1 1 83 13Z" fill="url(#${u}-c-gold)" stroke="#8a6225" stroke-width="1.2"/><circle cx="96" cy="17" r="1.6" fill="#fff6d8"/>`;
  if (c.acc === 'mask') return `<g transform="translate(96 32) rotate(20)"><path d="M-10-6L-8-17-2-9ZM10-6L8-17 2-9Z" fill="#fbf6e8" stroke="${INK}" stroke-width="1.3"/><path d="M-11-6C-11-12 11-12 11-6 11 6 4 13 0 14-4 13-11 6-11-6Z" fill="#fbf6e8" stroke="${INK}" stroke-width="1.4"/><path d="M-7-3L-2-1M7-3L2-1" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/><path d="M-6-11L-3-6M6-11L3-6" stroke="#c0392b" stroke-width="1.4"/><circle cy="9" r="1.4" fill="${INK}"/></g>`;
  return `<path d="M76 12L104 34" stroke="url(#${u}-c-gold)" stroke-width="2.4" stroke-linecap="round"/><circle cx="78" cy="14" r="5" fill="url(#${u}-c-jade)" stroke="#0d4a34" stroke-width="1.2"/><circle cx="76.6" cy="12.4" r="1.4" fill="#e6fff2"/><path d="M102 34l3 8" stroke="#d9b262" stroke-width="1.4"/><circle cx="105.4" cy="43" r="1.8" fill="#b52027"/>`;
}

// One open anime eye: white, iris ramp, pupil, two highlights and a heavy upper lash.
const openEye = (u, x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse rx="7.6" ry="9.2" fill="#fff"/><ellipse cy="1" rx="6.2" ry="7.8" fill="url(#${u}-c-iris)"/><ellipse cy="2" rx="2.6" ry="3.4" fill="${INK}" opacity=".85"/><circle cx="2.4" cy="-2.6" r="2.3" fill="#fff"/><circle cx="-2.4" cy="4" r="1" fill="#fff" opacity=".85"/><path d="M-8.6-4C-6-10.6 6-10.6 8.6-4" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
const blush = (o = .55) => `<ellipse cx="38" cy="77" rx="7" ry="4" fill="#f4867c" opacity="${o}"/><ellipse cx="82" cy="77" rx="7" ry="4" fill="#f4867c" opacity="${o}"/>`;
const sparkle = (x, y, r, fill = '#ffd76a') => `<path d="M${x} ${y - r}Q${x + r * .18} ${y - r * .18} ${x + r} ${y}Q${x + r * .18} ${y + r * .18} ${x} ${y + r}Q${x - r * .18} ${y + r * .18} ${x - r} ${y}Q${x - r * .18} ${y - r * .18} ${x} ${y - r}Z" fill="${fill}" stroke="#8a6225" stroke-width=".8"/>`;
const label = (x, y, text, size, fill, rot = 0) => `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" text-anchor="middle" font-family="'BiauKai','Kaiti TC','DFKai-SB','Noto Serif TC','Songti TC',serif" font-size="${size}" font-weight="900" fill="${fill}" stroke="#fff" stroke-width="3" paint-order="stroke">${text}</text>`;

// Each mood: brows, eyes, mouth, cheeks and the marks around the head. Coordinates are in the sticker's 120×120 space.
function expression(u, c, mood) {
  const L = INK, brow = (d, w = 2.4) => `<path d="${d}" stroke="${c.hair[2]}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  switch (mood) {
    case 'smug': return brow('M36 55Q44 51 52 55M68 53Q76 48 84 52') +
      // Half-lidded: the lid is a flat skin band with the lash drawn straight across.
      `${openEye(u, 44, 67)}${openEye(u, 76, 67)}<path d="M34 56H54V66H34ZM66 56H86V66H66Z" fill="url(#${u}-c-skin)"/><path d="M35 66Q44 63 54 66M66 66Q76 63 85 66" stroke="${L}" stroke-width="2.8" fill="none" stroke-linecap="round"/>` +
      `<path d="M52 80Q56 84 60 80Q64 84 68 80" stroke="${L}" stroke-width="2" fill="none" stroke-linecap="round"/>${blush(.6)}` +
      // A sleeve-covered hand at the mouth: お-ほほ.
      `<path d="M66 98C70 88 78 82 88 84 94 88 92 100 84 104Z" fill="${c.kimono[0]}" stroke="${L}" stroke-width="1.4"/><ellipse cx="72" cy="85" rx="6.4" ry="5" fill="${c.skin[0]}" stroke="${L}" stroke-width="1.3"/>` +
      label(100, 22, '呵', 16, '#b52027', 12) + label(108, 40, '呵', 12, '#b52027', 18) + sparkle(16, 30, 6) + sparkle(106, 60, 4);
    case 'cheer': return brow('M36 52Q44 47 52 51M68 51Q76 47 84 52') +
      `<path d="M37 69Q44 58 51 69M69 69Q76 58 83 69" stroke="${L}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<path d="M49 76Q60 94 71 76Z" fill="#7a2330" stroke="${L}" stroke-width="1.8" stroke-linejoin="round"/><path d="M54 84Q60 80 66 84Q63 89 60 89 57 89 54 84Z" fill="#ef8a8a"/><path d="M50 76H70" stroke="#fff" stroke-width="2"/>${blush(.7)}` +
      // Thumbs up from a jade sleeve: a fist with four curled fingers stacked on its front and the thumb raised off its top edge.
      `<path d="M74 120C76 108 82 101 92 101L100 120Z" fill="${c.kimono[0]}" stroke="${L}" stroke-width="1.4"/><path d="M84 84C84 78 88 72 90 72 94 72 94 77 92 84Z" fill="${c.skin[0]}" stroke="${L}" stroke-width="1.3" stroke-linejoin="round"/><rect x="82" y="83" width="14" height="19" rx="4" fill="${c.skin[0]}" stroke="${L}" stroke-width="1.3"/>${[87, 91.5, 96].map(y => `<path d="M96 ${y - 2.2}H101A2.2 2.2 0 0 1 101 ${y + 2.2}H96" fill="${c.skin[0]}" stroke="${L}" stroke-width="1.2"/>`).join('')}<path d="M96 81H100A2.2 2.2 0 0 1 100 85.4H96" fill="${c.skin[0]}" stroke="${L}" stroke-width="1.2"/>` +
      sparkle(16, 26, 7) + sparkle(104, 18, 6) + sparkle(12, 60, 4, '#fff3c0') + `<path d="M98 50l3-8 2 7" stroke="#b52027" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 'shock': return brow('M36 50Q44 44 52 49M68 49Q76 44 84 50') +
      `<circle cx="44" cy="66" r="9" fill="#fff" stroke="${L}" stroke-width="2.2"/><circle cx="76" cy="66" r="9" fill="#fff" stroke="${L}" stroke-width="2.2"/><circle cx="44" cy="67" r="2" fill="${L}"/><circle cx="76" cy="67" r="2" fill="${L}"/>` +
      `<ellipse cx="60" cy="82" rx="4.4" ry="5.6" fill="#7a2330" stroke="${L}" stroke-width="1.8"/>` +
      // Gloom lines drop from the hairline over the upper face.
      `<g clip-path="url(#${u}-c-face)" stroke="#4d6fae" stroke-width="2" opacity=".7">${[38, 45, 52, 59, 66, 73, 80].map(x => `<path d="M${x} 30V${44 + (x % 3) * 4}"/>`).join('')}</g>` +
      label(104, 30, '!?', 22, '#b52027', 10) + `<path d="M12 44l8 4M10 56h9M14 68l7-3" stroke="${L}" stroke-width="2" stroke-linecap="round"/>`;
    case 'sweat': return brow('M36 57Q44 55 52 58M68 58Q76 55 84 57') +
      `<path d="M37 67H51M69 67H83" stroke="${L}" stroke-width="3" stroke-linecap="round"/><path d="M50 81Q53 78 56 81T62 81T68 81" stroke="${L}" stroke-width="2" fill="none" stroke-linecap="round"/>${blush(.35)}` +
      // A big sweat drop on the temple with its highlight.
      `<path d="M98 36C104 46 108 54 102 60 96 64 90 58 92 52 93 46 96 42 98 36Z" fill="#9fd4f2" stroke="#3f7fa8" stroke-width="1.6"/><path d="M96 52C95 55 96 57 98 58" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
      `<circle cx="14" cy="96" r="2.4" fill="${L}"/><circle cx="22" cy="96" r="2.4" fill="${L}"/><circle cx="30" cy="96" r="2.4" fill="${L}"/>`;
    case 'cry': return brow('M36 56Q44 50 52 52M68 52Q76 50 84 56') +
      `<path d="M37 66Q44 72 51 66M69 66Q76 72 83 66" stroke="${L}" stroke-width="2.8" fill="none" stroke-linecap="round"/>` +
      // Tear streams run from both eyes off the chin; loose drops fly outward.
      `<path d="M40 70C38 84 36 98 34 116H44C44 100 44 84 46 70Z" fill="#9fd4f2" opacity=".92" stroke="#3f7fa8" stroke-width="1.2"/><path d="M74 70C76 84 76 100 76 116H86C84 98 82 84 80 70Z" fill="#9fd4f2" opacity=".92" stroke="#3f7fa8" stroke-width="1.2"/>` +
      `<path d="M50 82Q55 76 60 81Q65 76 70 82Q66 90 60 88Q54 90 50 82Z" fill="#7a2330" stroke="${L}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M18 58c-3 4-2 7 1 7s4-3 1-7z" fill="#9fd4f2" stroke="#3f7fa8"/><path d="M102 60c-3 4-2 7 1 7s4-3 1-7z" fill="#9fd4f2" stroke="#3f7fa8"/>`;
    default: return brow('M35 52L52 60M85 52L68 60', 3.4) +
      // Rage: sharp slanted lids, gritted teeth, the red cross of a popped vein and steam off the head.
      `${openEye(u, 44, 68, .92)}${openEye(u, 76, 68, .92)}<path d="M33 54L55 62V56H33ZM87 54L65 62V56H87Z" fill="url(#${u}-c-skin)"/><path d="M35 58L54 64M85 58L66 64" stroke="${L}" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="48" y="77" width="24" height="10" rx="3" fill="#fff" stroke="${L}" stroke-width="2"/><path d="M48 82H72M54 77V87M60 77V87M66 77V87" stroke="${L}" stroke-width="1.2"/>` +
      `<ellipse cx="38" cy="77" rx="7" ry="3.4" fill="#e0453a" opacity=".45"/><ellipse cx="82" cy="77" rx="7" ry="3.4" fill="#e0453a" opacity=".45"/>` +
      `<g transform="translate(100 22)" stroke="#d62d20" stroke-width="3.2" fill="none" stroke-linecap="round"><path d="M-9-3Q-3-3-3-9M3-9Q3-3 9-3M9 3Q3 3 3 9M-3 9Q-3 3-9 3"/></g>` +
      `<g fill="#f3f1ea" stroke="#9aa3a0" stroke-width="1.2"><path d="M10 24c-4-2-2-8 3-6 1-5 8-4 8 1 5 0 5 7 0 7z"/><path d="M100 64c-4-2-2-8 3-6 1-5 8-4 8 1 5 0 5 7 0 7z"/></g>`;
  }
}

export function chibiSvg(c, u, mood) {
  const defs = `${grad(`${u}-c-hair`, [[0, c.hair[0]], [.55, c.hair[1]], [1, c.hair[2]]])}<linearGradient id="${u}-c-skin" gradientUnits="userSpaceOnUse" x1="0" y1="27" x2="0" y2="89"><stop offset="0" stop-color="${c.skin[0]}"/><stop offset="1" stop-color="${c.skin[1]}"/></linearGradient>
${grad(`${u}-c-iris`, [[0, c.eye[0]], [.6, c.eye[1]], [1, c.eye[2]]])}${grad(`${u}-c-kimono`, [[0, c.kimono[0]], [1, c.kimono[1]]], 1, 1)}
${grad(`${u}-c-gold`, [[0, '#fff0c0'], [.5, '#d9b262'], [1, '#8a6225']], 1, 1)}${grad(`${u}-c-jade`, [[0, '#9fe0c4'], [1, '#146a4c']], 1, 1)}
<clipPath id="${u}-c-face"><path d="M27 58C27 37 42 27 60 27S93 37 93 58C93 76 80 89 60 89S27 76 27 58Z"/></clipPath>
<filter id="${u}-c-cut" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.6" result="grow"/><feFlood flood-color="#fffdf4"/><feComposite in2="grow" operator="in" result="rim"/><feDropShadow in="rim" dx="0" dy="2" stdDeviation="1.6" flood-color="#021109" flood-opacity=".55" result="lift"/><feMerge><feMergeNode in="lift"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const tail = c.style === 'ponytail' ? `<path d="M84 18C106 12 118 34 113 62 111 78 104 90 97 98 101 80 100 58 88 42Z" fill="url(#${u}-c-hair)" stroke="${c.line}" stroke-width="1.6"/><path d="M82 20C88 16 92 22 88 26Z" fill="#b52027"/>` : '';
  const lines = c.style === 'wave' ? `<path d="M33 30Q46 22 58 26M66 24Q80 22 90 32" stroke="${c.sheen}" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>` : `<path d="M34 32Q48 22 62 24" stroke="${c.sheen}" stroke-width="2.4" fill="none" opacity=".55" stroke-linecap="round"/>`;
  const body = `<path d="M28 120C30 102 43 92 60 92S90 102 92 120Z" fill="url(#${u}-c-kimono)" stroke="${INK}" stroke-width="1.6"/><path d="M49 92L60 110 71 92" stroke="${c.collar}" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="M31 113H89" stroke="${c.band}" stroke-width="5"/>`;
  const face = `<path d="M27 58C27 37 42 27 60 27S93 37 93 58C93 76 80 89 60 89S27 76 27 58Z" fill="url(#${u}-c-skin)" stroke="${INK}" stroke-width="1.6"/><path d="M27 58C27 76 40 89 60 89 44 84 33 74 31 60Z" fill="${c.skin[2]}" opacity=".35"/>`;
  const hairFront = `<path d="${LOCKS[c.style] ?? LOCKS.bob}" fill="url(#${u}-c-hair)" stroke="${c.line}" stroke-width="1.4"/><path d="${fringe(PART[c.style] ?? 0)}" fill="url(#${u}-c-hair)" stroke="${c.line}" stroke-width="1.6" stroke-linejoin="round"/>${lines}`;
  const ahoge = c.ahoge ? `<path d="M58 16C52 2 66-2 72 4 64 4 60 9 62 16Z" fill="url(#${u}-c-hair)" stroke="${c.line}" stroke-width="1.4"/>` : '';
  const mole = c.mole ? '<circle cx="83" cy="80" r="1.2" fill="#5a3a2a"/>' : '';
  return `<svg viewBox="-6 -6 132 132" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}"><defs>${defs}</defs><g filter="url(#${u}-c-cut)"><path d="${BACK[c.style] ?? BACK.bob}" fill="url(#${u}-c-hair)" stroke="${c.line}" stroke-width="1.6"/>${tail}${body}${face}${hairFront}${ahoge}${ornament(c, u)}${mole}${expression(u, c, mood)}</g></svg>`;
}
