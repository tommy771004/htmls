// 重做車內用的貼圖（SVG → PNG，blender/cab_*.py 與 tools/cab-swap.mjs 讀）：
//   node tools/cab-tex.mjs   → blender/out/cab_tex/{atlas,perf,carbon}.png
// atlas（1024²，不重複）：左上儀表（512×256）、右上中控螢幕（512×288）、左下方向盤中央徽章（256²）、旁邊方向盤按鍵（256×128）。
// perf、carbon（256²，重複貼）：打孔皮革、碳纖維。都是接近白色的底，實際顏色由頂點色（COLOR_0）乘上去。
// 不畫任何廠牌標誌與文字商標：徽章是抽象的盾形，螢幕只有圖示與數字。
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const sharp = (await import(pathToFileURL(req.resolve('sharp')).href)).default;
const OUT = resolve(root, 'blender/out/cab_tex');
mkdirSync(OUT, { recursive: true });
const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(resolve(OUT, file));
const F = 'font-family="Helvetica, Arial, sans-serif"';
const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

// ─── 儀表：中間大轉速表（0–8，6.5 起紅區），中間數字車速、檔位；兩側油溫水溫的弧條與資訊欄 ───
function cluster() {
  let s = '';
  const cx = 256, cy = 132, R = 112, a0 = Math.PI * .75, a1 = Math.PI * 2.25, A = (v) => a0 + (a1 - a0) * v / 8;
  s += `<circle cx="${cx}" cy="${cy}" r="${R + 8}" fill="#0b0b0d" stroke="#3a3a40" stroke-width="3"/>`;
  // 紅區
  const [rx0, ry0] = pol(cx, cy, R - 6, A(6.5)), [rx1, ry1] = pol(cx, cy, R - 6, A(8));
  s += `<path d="M${rx0} ${ry0} A${R - 6} ${R - 6} 0 0 1 ${rx1} ${ry1}" stroke="#e0211a" stroke-width="10" fill="none"/>`;
  for (let i = 0; i <= 80; i++) {
    const v = i / 10, big = i % 10 === 0, mid = i % 5 === 0, a = A(v);
    const [x0, y0] = pol(cx, cy, R - (big ? 22 : mid ? 16 : 11), a), [x1, y1] = pol(cx, cy, R - 2, a);
    s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${v >= 6.5 ? '#ff3b30' : '#f2f2f2'}" stroke-width="${big ? 4 : mid ? 2.5 : 1.4}"/>`;
    if (big) { const [tx, ty] = pol(cx, cy, R - 38, a); s += `<text x="${tx}" y="${ty + 8}" font-size="22" text-anchor="middle" fill="${v >= 7 ? '#ff3b30' : '#ffffff'}" ${F} font-weight="bold">${v}</text>`; }
  }
  // 指針（停在 0.9）與中間圓
  const [nx, ny] = pol(cx, cy, R - 8, A(.9)), [bx, by] = pol(cx, cy, 18, A(.9) + Math.PI);
  s += `<line x1="${bx}" y1="${by}" x2="${nx}" y2="${ny}" stroke="#ff2a1f" stroke-width="5" stroke-linecap="round"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="46" fill="#121216" stroke="#55555c" stroke-width="2"/>`;
  s += `<text x="${cx}" y="${cy + 6}" font-size="40" text-anchor="middle" fill="#fff" ${F} font-weight="bold">0</text>`;
  s += `<text x="${cx}" y="${cy + 28}" font-size="13" text-anchor="middle" fill="#9a9aa2" ${F}>km/h</text>`;
  s += `<rect x="${cx - 16}" y="${cy + 52}" width="32" height="30" rx="4" fill="#1a1a1e" stroke="#ff2a1f" stroke-width="2"/><text x="${cx}" y="${cy + 75}" font-size="24" text-anchor="middle" fill="#fff" ${F} font-weight="bold">N</text>`;
  s += `<text x="${cx}" y="${cy - 56}" font-size="11" text-anchor="middle" fill="#9a9aa2" ${F}>x1000 r/min</text>`;
  // 兩側弧條
  const side = (x, lbl, fill, flip) => {
    let o = `<rect x="${x}" y="22" width="104" height="212" rx="10" fill="#0d0d10" stroke="#2c2c32" stroke-width="2"/>`;
    for (let i = 0; i < 12; i++) o += `<rect x="${x + 14}" y="${200 - i * 14}" width="${46 + i * 2}" height="9" rx="2" fill="${i < fill ? (i > 9 ? '#ff3b30' : '#e8e8ec') : '#2a2a30'}"/>`;
    o += `<text x="${x + 52}" y="44" font-size="13" text-anchor="middle" fill="#bbb" ${F}>${lbl}</text>`;
    return o;
  };
  s += side(14, 'OIL °C', 7) + side(394, 'H2O °C', 6);
  // 底部里程列
  s += `<rect x="150" y="238" width="212" height="16" rx="3" fill="#121216"/><text x="256" y="251" font-size="12" text-anchor="middle" fill="#ddd" ${F}>ODO 004812   TRIP 128.4</text>`;
  return `<g>${s}</g>`;
}

// ─── 中控螢幕：上方狀態列、左邊 G 值圓、右邊三個儀表卡、底下一排圖示 ───
function screen() {
  let s = `<rect x="0" y="0" width="512" height="288" fill="#08080a"/>`;
  s += `<rect x="0" y="0" width="512" height="26" fill="#141418"/><text x="12" y="18" font-size="14" fill="#ddd" ${F}>21:47</text><text x="500" y="18" font-size="14" text-anchor="end" fill="#ddd" ${F}>18°C</text>`;
  s += `<rect x="200" y="7" width="112" height="12" rx="6" fill="#2a2a30"/><rect x="200" y="7" width="70" height="12" rx="6" fill="#d8231a"/>`;
  // G 值
  s += `<circle cx="110" cy="140" r="78" fill="#101014" stroke="#3a3a42" stroke-width="2"/><circle cx="110" cy="140" r="52" fill="none" stroke="#2c2c34" stroke-width="2"/><circle cx="110" cy="140" r="26" fill="none" stroke="#2c2c34" stroke-width="2"/>`;
  s += `<line x1="32" y1="140" x2="188" y2="140" stroke="#2c2c34" stroke-width="2"/><line x1="110" y1="62" x2="110" y2="218" stroke="#2c2c34" stroke-width="2"/><circle cx="128" cy="126" r="8" fill="#ff2a1f"/>`;
  s += `<text x="110" y="231" font-size="12" text-anchor="middle" fill="#aaa" ${F}>LAT 0.21 g</text>`;
  const card = (y, lbl, val, frac) => `<rect x="214" y="${y}" width="284" height="56" rx="6" fill="#121216" stroke="#2a2a32" stroke-width="2"/><text x="228" y="${y + 22}" font-size="13" fill="#9a9aa2" ${F}>${lbl}</text><text x="486" y="${y + 26}" font-size="22" text-anchor="end" fill="#fff" ${F} font-weight="bold">${val}</text><rect x="228" y="${y + 36}" width="256" height="8" rx="4" fill="#26262c"/><rect x="228" y="${y + 36}" width="${256 * frac}" height="8" rx="4" fill="#d8231a"/>`;
  s += card(36, 'OIL PRESSURE', '62 psi', .55) + card(98, 'OIL TEMP', '96 °C', .45) + card(160, 'BATTERY', '14.1 V', .7);
  // 底部圖示列
  s += `<rect x="0" y="236" width="512" height="52" fill="#141418"/>`;
  for (let i = 0; i < 6; i++) {
    const x = 42 + i * 86, on = i === 3;
    s += `<rect x="${x - 30}" y="242" width="60" height="40" rx="6" fill="${on ? '#3a1210' : '#1c1c22'}" stroke="${on ? '#d8231a' : '#30303a'}" stroke-width="2"/>`;
    s += [`<circle cx="${x}" cy="262" r="9" fill="none" stroke="#ddd" stroke-width="2"/>`, `<path d="M${x - 10} 270 L${x} 252 L${x + 10} 270 Z" fill="none" stroke="#ddd" stroke-width="2"/>`, `<rect x="${x - 10}" y="254" width="20" height="16" rx="2" fill="none" stroke="#ddd" stroke-width="2"/>`, `<path d="M${x - 12} 268 Q${x} 246 ${x + 12} 268" fill="none" stroke="#ff6a5f" stroke-width="3"/>`, `<path d="M${x - 9} 254 L${x + 9} 270 M${x + 9} 254 L${x - 9} 270" stroke="#ddd" stroke-width="2"/>`, `<circle cx="${x}" cy="262" r="3" fill="#ddd"/><circle cx="${x}" cy="262" r="11" fill="none" stroke="#ddd" stroke-width="2"/>`][i];
  }
  return s;
}

// ─── 方向盤中央徽章：抽象盾形（不是任何廠徽） ───
function badge() {
  return `<circle cx="128" cy="128" r="124" fill="#17171a"/><circle cx="128" cy="128" r="80" fill="none" stroke="#b9bcc2" stroke-width="7"/>` +
    `<path d="M128 70 L170 92 L162 150 L128 182 L94 150 L86 92 Z" fill="#2a2a2f" stroke="#c9ccd2" stroke-width="5"/>` +
    `<path d="M108 108 L128 98 L148 108 L140 140 L128 152 L116 140 Z" fill="#b5201a"/>`;
}
// 方向盤按鍵：2×4 個白色符號（音量、曲目、語音、電話、巡航）
function keys() {
  const g = ['M-8 0 H8 M0 -8 V8', 'M-8 0 H8', 'M-6 -7 L6 0 L-6 7 Z', 'M6 -7 L-6 0 L6 7 Z', 'M-7 4 Q0 -10 7 4', 'M-6 -6 L6 6 M6 -6 L-6 6', 'M-7 -3 H7 M-7 3 H7', 'M0 -8 A8 8 0 1 1 -0.1 -8'];
  let s = `<rect x="0" y="0" width="256" height="128" fill="#121214"/>`;
  g.forEach((d, i) => { const x = 32 + (i % 4) * 64, y = 32 + Math.floor(i / 4) * 64; s += `<rect x="${x - 26}" y="${y - 26}" width="52" height="52" rx="8" fill="#1c1c20"/><path transform="translate(${x} ${y}) scale(1.6)" d="${d}" stroke="#f4f4f4" stroke-width="2" fill="none" stroke-linecap="round"/>`; });
  return s;
}

const atlas = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#000"/>` +
  `<svg x="0" y="0" width="512" height="256">${cluster()}</svg>` +
  `<svg x="512" y="0" width="512" height="288">${screen()}</svg>` +
  `<svg x="0" y="512" width="256" height="256">${badge()}</svg>` +
  `<svg x="256" y="512" width="256" height="128">${keys()}</svg></svg>`;
await png(atlas, 'atlas.png');

// 打孔皮革：近白底、8×8 個深色小孔（貼圖重複，打孔間距約 6 mm）
let perf = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#f2f2f2"/>`;
for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) perf += `<circle cx="${16 + i * 32 + (j % 2) * 16}" cy="${16 + j * 32}" r="5" fill="#3a3a3a"/>`;
await png(perf + '</svg>', 'perf.png');

// 碳纖維：2×2 斜紋，交錯的亮暗條
let carb = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#2a2a2e"/>`;
for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
  const x = i * 32, y = j * 32, h = (i + j) % 2 === 0;
  carb += h ? `<rect x="${x + 1}" y="${y + 4}" width="30" height="24" rx="3" fill="#6a6a72"/><rect x="${x + 1}" y="${y + 8}" width="30" height="6" fill="#8a8a94"/>`
    : `<rect x="${x + 4}" y="${y + 1}" width="24" height="30" rx="3" fill="#4a4a52"/><rect x="${x + 8}" y="${y + 1}" width="6" height="30" fill="#5c5c66"/>`;
}
await png(carb + '</svg>', 'carbon.png');

// ─── 其他重複貼圖（256²，接近白色的底，顏色由頂點色乘上去；雜訊用 stitchTiles 才能無縫重複） ───
const SV = (body, bg = '#f0f0f0') => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${bg}"/>${body}</svg>`;
const noise = (id, freq, oct, lo, hi) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${hi - lo} ${lo}"/></filter>`;
// 菱格縫（r8 座椅）：每格約 4 cm，深色縫線、格子中間微亮
let q = '';
for (let i = -4; i <= 4; i++) q += `<line x1="${i * 64}" y1="0" x2="${i * 64 + 256}" y2="256" stroke="#5a5a5a" stroke-width="3"/><line x1="${i * 64 + 256}" y1="0" x2="${i * 64}" y2="256" stroke="#5a5a5a" stroke-width="3"/>`;
await png(SV(`<rect width="256" height="256" fill="#d8d8d8"/>${q}`), 'quilt.png');
// 六角縫（svj 座椅）
let hx = '';
const hr = 32, hw = hr * Math.sqrt(3);
for (let r = -1; r < 6; r++) for (let c = -1; c < 4; c++) {
  const cx = c * hw * 1 + (r % 2 ? hw / 2 : 0), cy = r * hr * 1.5;
  hx += `<path d="${[0, 1, 2, 3, 4, 5].map((k) => { const a = Math.PI / 3 * k + Math.PI / 6; return (k ? 'L' : 'M') + (cx + hr * Math.cos(a)).toFixed(1) + ' ' + (cy + hr * Math.sin(a)).toFixed(1); }).join(' ')} Z" fill="none" stroke="#4a4a4a" stroke-width="3"/>`;
}
// 六角格不是 256 的整數倍，改用 222×256 的格（hw*4=221.7）會有接縫：用 pattern 縮放到 256
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><pattern id="h" width="${hw * 2}" height="${hr * 3}" patternUnits="userSpaceOnUse" patternTransform="scale(${256 / (hw * 2) / 2} ${256 / (hr * 3) / 2})">` +
  `<rect width="${hw * 2}" height="${hr * 3}" fill="#dedede"/>` +
  [[hw / 2, 0], [hw * 1.5, 0], [0, hr * 1.5], [hw, hr * 1.5], [hw * 2, hr * 1.5], [hw / 2, hr * 3], [hw * 1.5, hr * 3]].map(([cx, cy]) => `<path d="${[0, 1, 2, 3, 4, 5].map((k) => { const a = Math.PI / 3 * k + Math.PI / 6; return (k ? 'L' : 'M') + (cx + hr * Math.cos(a)).toFixed(2) + ' ' + (cy + hr * Math.sin(a)).toFixed(2); }).join(' ')} Z" fill="none" stroke="#4a4a4a" stroke-width="4"/>`).join('') +
  `</pattern></defs><rect width="256" height="256" fill="url(#h)"/></svg>`, 'hex.png');
// 麂皮（Alcantara）：細雜訊
await png(SV(`<defs>${noise('n', .9, 3, .0, .22)}</defs><rect width="256" height="256" fill="#ffffff" filter="url(#n)" opacity="1"/>`, '#d6d6d6').replace('<rect width="256" height="256" fill="#ffffff" filter="url(#n)" opacity="1"/>', '<rect width="256" height="256" fill="#000" filter="url(#n)"/>'), 'alcantara.png');
// 皮革（cab-swap 的 FIX 換掉原檔低解析的座椅皮）：細顆粒紋，對比低
await png(SV(`<defs>${noise('n', .16, 2, 0, .16)}</defs><rect width="256" height="256" fill="#000" filter="url(#n)"/>`, '#e4e4e4'), 'leather.png');
// 毛氈（f40 儀表板）：更粗的雜訊
await png(SV(`<defs>${noise('n', .35, 4, 0, .3)}</defs><rect width="256" height="256" fill="#000" filter="url(#n)"/>`, '#dcdcdc'), 'felt.png');
// 鍛造碳（svj）：大塊的明暗大理石紋
await png(SV(`<defs>${noise('n', .022, 3, -.2, 1.3)}</defs><rect width="256" height="256" fill="#000" filter="url(#n)"/>`, '#9a9aa0'), 'forged.png');
// 布紋（f40 座椅）：細橫豎交錯
let cl = '';
for (let i = 0; i < 64; i++) cl += `<rect x="0" y="${i * 4}" width="256" height="2" fill="#000" opacity="${.12 + (i % 3) * .04}"/><rect x="${i * 4}" y="0" width="2" height="256" fill="#000" opacity="${.08 + (i % 2) * .05}"/>`;
await png(SV(cl, '#efefef'), 'cloth.png');
// 克維拉碳纖（f40 地板、門）：金黃與黑交錯的斜紋
let kv = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#3a3626"/>`;
for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
  const x = i * 32, y = j * 32, h = (i + j) % 2 === 0;
  kv += h ? `<rect x="${x + 1}" y="${y + 4}" width="30" height="24" rx="3" fill="#b8a24a"/><rect x="${x + 1}" y="${y + 9}" width="30" height="5" fill="#d8c060"/>` : `<rect x="${x + 4}" y="${y + 1}" width="24" height="30" rx="3" fill="#2a2a2c"/><rect x="${x + 9}" y="${y + 1}" width="5" height="30" fill="#44444a"/>`;
}
await png(kv + '</svg>', 'kevlar.png');

// ─── 各車的 atlas（1024²）：儀表、螢幕、方向盤徽章、按鍵 ───
const tick = (cx, cy, R, a, l, w, c) => { const [x0, y0] = pol(cx, cy, R - l, a), [x1, y1] = pol(cx, cy, R, a); return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${c}" stroke-width="${w}"/>`; };
// 圓形錶：max 最大值、step 大刻度、red 紅區起點、lbl 字、ink 刻度與數字顏色、face 底色
function dial(cx, cy, R, { max, step, sub = 5, red, lbl, ink = '#f4f4f4', face = '#0c0c0e', needle = .08, redc = '#ff3b30', font = 22, num = (v) => v }) {
  const a0 = Math.PI * .75, a1 = Math.PI * 2.25, A = (v) => a0 + (a1 - a0) * v / max;
  let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${face}" stroke="#3c3c42" stroke-width="${R * .05}"/>`;
  for (let k = 0; k <= Math.round(max / step * sub); k++) {
    const v = k * step / sub, big = k % sub === 0, c = red != null && v >= red ? redc : ink;
    s += tick(cx, cy, R * .93, A(v), big ? R * .16 : R * .08, big ? R * .035 : R * .015, c);
    if (big) { const [tx, ty] = pol(cx, cy, R * .64, A(v)); s += `<text x="${tx}" y="${ty + font * .36}" font-size="${font}" text-anchor="middle" fill="${c}" ${F} font-weight="bold">${num(v)}</text>`; }
  }
  if (lbl) s += `<text x="${cx}" y="${cy + R * .42}" font-size="${font * .55}" text-anchor="middle" fill="${ink}" ${F}>${lbl}</text>`;
  const [nx, ny] = pol(cx, cy, R * .86, A(max * needle)), [bx, by] = pol(cx, cy, R * .15, A(max * needle) + Math.PI);
  return s + `<line x1="${bx}" y1="${by}" x2="${nx}" y2="${ny}" stroke="#ff5a1f" stroke-width="${R * .045}" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="${R * .09}" fill="#202024" stroke="#555" stroke-width="2"/>`;
}
const wrap = (parts) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#000"/>${parts.map(([x, y, w, h, b]) => `<svg x="${x}" y="${y}" width="${w}" height="${h}">${b}</svg>`).join('')}</svg>`;
// r8：寬幅液晶（512×192）：左轉速、右車速、中間地圖；按鍵兩塊（駕駛模式、紅色啟動）
{
  let map = `<rect x="150" y="10" width="212" height="172" rx="8" fill="#0d1218"/>`;
  for (let i = 0; i < 9; i++) map += `<path d="M${150 + i * 26} 10 Q${170 + i * 20} 90 ${140 + i * 30} 182" stroke="#26313d" stroke-width="${i % 3 ? 2 : 5}" fill="none"/>`;
  map += `<path d="M160 160 L220 110 L300 120 L350 40" stroke="#3aa0ff" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M256 132 l-10 18 l10 -6 l10 6 Z" fill="#fff"/>`;
  const vc = `<rect width="512" height="192" fill="#050506"/>` + dial(76, 96, 86, { max: 9, step: 1, red: 8.5, lbl: '1/min x1000', font: 17, needle: .1 }) + dial(436, 96, 86, { max: 340, step: 40, sub: 4, lbl: 'km/h', font: 14, needle: 0 }) + map +
    `<text x="256" y="40" font-size="13" text-anchor="middle" fill="#ddd" ${F}>D1</text>`;
  const keysR8 = `<rect width="256" height="128" fill="#111"/>` + [0, 1].map((i) => `<rect x="${8 + i * 128}" y="8" width="112" height="112" rx="56" fill="${i ? '#b3150f' : '#1d1d20'}" stroke="#888" stroke-width="5"/><text x="${64 + i * 128}" y="74" font-size="${i ? 26 : 22}" text-anchor="middle" fill="#fff" ${F} font-weight="bold">${i ? 'START' : 'MODE'}</text>`).join('');
  await png(wrap([[0, 0, 512, 192, vc], [0, 512, 256, 256, badge()], [256, 512, 256, 128, keysR8], [256, 640, 256, 128, keys()]]), 'atlas_r8.png');
}
// svj：稜角液晶（512×256）：中間大轉速弧、數字車速、檔位；小螢幕（512×288）；徽章、按鍵
{
  let s = `<rect width="512" height="256" fill="#040405"/><path d="M40 210 L90 40 L422 40 L472 210 Z" fill="#0d0d10" stroke="#2c2c30" stroke-width="3"/>`;
  for (let i = 0; i <= 90; i++) { const a = Math.PI * (1.08 + .84 * i / 90), r0 = 104, r1 = i % 10 ? 116 : 128; const [x0, y0] = pol(256, 196, r0, a), [x1, y1] = pol(256, 196, r1, a); s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${i > 75 ? '#ff3b20' : i < 14 ? '#f2c500' : '#e8e8e8'}" stroke-width="${i % 10 ? 2 : 4}"/>`; if (i % 10 === 0) { const [tx, ty] = pol(256, 196, 146, a); s += `<text x="${tx}" y="${ty + 6}" font-size="17" text-anchor="middle" fill="#fff" ${F} font-weight="bold">${i / 10}</text>`; } }
  s += `<text x="256" y="182" font-size="58" text-anchor="middle" fill="#fff" ${F} font-weight="bold">0</text><text x="256" y="204" font-size="14" text-anchor="middle" fill="#999" ${F}>km/h</text>`;
  s += `<path d="M232 70 l24 -16 l24 16 v20 l-24 16 l-24 -16 Z" fill="#f2c500"/><text x="256" y="92" font-size="22" text-anchor="middle" fill="#000" ${F} font-weight="bold">N</text>`;
  s += `<text x="70" y="232" font-size="15" fill="#f2c500" ${F} font-weight="bold">CORSA</text><text x="442" y="232" font-size="15" text-anchor="end" fill="#ddd" ${F}>21°C  48 L</text>`;
  await png(wrap([[0, 0, 512, 256, s], [512, 0, 512, 288, screen()], [0, 512, 256, 256, badge()], [256, 512, 256, 128, keys()]]), 'atlas_svj.png');
}
// f40：類比錶（每個 256²）：轉速（0–10）、車速（0–360）、油壓、水溫、增壓；黑底橘白字
{
  const o = { ink: '#f0e6d2', face: '#0a0a0a', redc: '#ff5a20' };
  const tach = dial(128, 128, 120, { ...o, max: 10, step: 1, red: 7.75, lbl: 'RPM x1000', font: 26, needle: .09 });
  const spd = dial(128, 128, 120, { ...o, max: 360, step: 40, sub: 4, lbl: 'km/h', font: 20, needle: 0 });
  const small = (lbl, n) => dial(128, 128, 120, { ...o, max: 4, step: 1, lbl, font: 26, needle: n });
  const horn = `<circle cx="128" cy="128" r="124" fill="#141414"/><circle cx="128" cy="128" r="92" fill="#1e1e1e" stroke="#9a9a9a" stroke-width="6"/><circle cx="128" cy="128" r="44" fill="#c9a61a"/><path d="M128 96 L150 128 L128 160 L106 128 Z" fill="#1a1a1a"/>`;
  await png(wrap([[0, 0, 256, 256, tach], [256, 0, 256, 256, spd], [512, 0, 256, 256, small('OIL', .55)], [768, 0, 256, 256, small('H2O', .45)], [0, 256, 256, 256, small('BAR', .1)], [256, 256, 256, 256, small('FUEL', .7)], [0, 512, 256, 256, horn]]), 'atlas_f40.png');
}
// sf90：一整片寬幅曲面液晶（512×160）：中間大圓轉速（黃底）、左邊導航、右邊車況；不放廠牌字樣
{
  let s = `<rect width="512" height="160" fill="#030304"/>`;
  s += dial(256, 82, 74, { max: 10, step: 1, red: 8.5, lbl: 'x1000', font: 15, needle: .08, face: '#e8c000', ink: '#111111', redc: '#d4200f' });
  s += `<circle cx="256" cy="82" r="30" fill="#0b0b0d" stroke="#555" stroke-width="2"/><text x="256" y="90" font-size="24" text-anchor="middle" fill="#fff" ${F} font-weight="bold">0</text><text x="256" y="104" font-size="9" text-anchor="middle" fill="#aaa" ${F}>km/h</text>`;
  let map = `<rect x="14" y="14" width="150" height="132" rx="10" fill="#0c1116"/>`;
  for (let i = 0; i < 7; i++) map += `<path d="M${14 + i * 24} 14 Q${40 + i * 18} 80 ${10 + i * 26} 146" stroke="#26313d" stroke-width="${i % 3 ? 2 : 4}" fill="none"/>`;
  map += `<path d="M30 130 L70 96 L120 104 L150 40" stroke="#ffcc00" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M88 100 l-8 14 l8 -5 l8 5 Z" fill="#fff"/>`;
  let info = `<rect x="348" y="14" width="150" height="132" rx="10" fill="#0c0c0f"/>`;
  [['EV', '#29c46a'], ['HYBRID', '#ffcc00'], ['PERF', '#ff7a1a'], ['QUALIFY', '#e52a1a']].forEach(([t, c], i) => { info += `<rect x="360" y="${26 + i * 28}" width="126" height="22" rx="4" fill="${i === 1 ? c : '#17171b'}"/><text x="423" y="${42 + i * 28}" font-size="13" text-anchor="middle" fill="${i === 1 ? '#000' : c}" ${F} font-weight="bold">${t}</text>`; });
  s += map + info + `<rect x="200" y="6" width="112" height="3" rx="1.5" fill="#29c46a"/>`;
  await png(wrap([[0, 0, 512, 160, s]]), 'atlas_sf90.png');
}
console.log('寫好', OUT);
