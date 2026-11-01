// 六器鏢行 — 介面自繪圖示（全部原創 inline SVG）
// 房規：兵器剪影一律直立、刃朝上，viewBox 0 0 32 96；每一件兵器都繫一縷朱紅穗子（本作圖示的共通記號）。
// 填色走 class：.m 金屬（麻紙白）、.g 刃上血槽、.h 木柄、.b 黃銅、.bs 黃銅描邊、.t 朱穗、.ms 金屬描邊、.st 弓弦。
// 顏色由 index.html 的 .ico 規則統一給，冷卻與封匣狀態只要換 CSS 變數。

const NS = 'xmlns="http://www.w3.org/2000/svg"';

const WEAPON_BODY = {
  BLADE: `
    <path class="m" d="M13 63 L13 13 Q13.5 6 17 3 L22.5 8 Q25 30 21.5 63 Z"/>
    <path class="g" d="M15 59 L15.2 14"/>
    <path class="b" d="M8 63 h16 a1.6 1.6 0 0 1 0 3.2 h-16 a1.6 1.6 0 0 1 0 -3.2 Z"/>
    <rect class="h" x="14" y="66.2" width="4" height="19" rx="1"/>
    <rect class="b" x="13.6" y="70" width="4.8" height="1.3"/><rect class="b" x="13.6" y="75" width="4.8" height="1.3"/><rect class="b" x="13.6" y="80" width="4.8" height="1.3"/>
    <circle class="bs" cx="16" cy="88.2" r="2.6"/>
    <path class="t" d="M16 90.8 C17.2 92.6 19.6 93.4 21.6 95.6 L19.8 96 C18.2 94.6 16.2 93.8 15.2 91.6 Z"/>`,
  SWORD: `
    <path class="m" d="M16 2.5 L18.8 9 L18.8 63 L13.2 63 L13.2 9 Z"/>
    <path class="g" d="M16 8.5 L16 61"/>
    <path class="b" d="M8.5 62.5 Q16 60.5 23.5 62.5 L22 66 Q16 64.6 10 66 Z"/>
    <rect class="h" x="14.5" y="66" width="3" height="17" rx="1"/>
    <rect class="b" x="14" y="70" width="4" height="1.2"/><rect class="b" x="14" y="75" width="4" height="1.2"/>
    <path class="b" d="M16 82.6 L18.6 85.8 L16 89 L13.4 85.8 Z"/>
    <path class="t" d="M16 89 C16.6 91.8 18.2 93 19.8 95.8 L18 96 C16.6 93.8 15.4 92.6 15.2 89.6 Z"/>`,
  SPEAR: `
    <path class="m" d="M16 2 Q19.6 9 18.6 17.5 L13.4 17.5 Q12.4 9 16 2 Z"/>
    <path class="g" d="M16 5.5 L16 16"/>
    <rect class="b" x="13.6" y="17.4" width="4.8" height="2.8" rx="0.8"/>
    <path class="t" d="M14 20.2 Q9 26 10.4 33.4 Q12.8 28.4 14.6 24.6 Q15 30.4 16 34.6 Q17 30.4 17.4 24.6 Q19.2 28.4 21.6 33.4 Q23 26 18 20.2 Z"/>
    <rect class="h" x="15" y="20.2" width="2" height="72" rx="1"/>
    <rect class="b" x="14.5" y="91.6" width="3" height="3.6" rx="0.8"/>`,
  FIST: `
    <path class="m" fill-rule="evenodd" d="M16 18 a7.2 7.2 0 0 1 7.2 7.2 v43.6 a7.2 7.2 0 0 1 -14.4 0 v-43.6 a7.2 7.2 0 0 1 7.2 -7.2 Z
      M11.6 26 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0 Z M11.6 40 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0 Z
      M11.6 54 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0 Z M11.6 68 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0 Z"/>
    <path class="h" d="M23 30 h2.6 a2.2 2.2 0 0 1 2.2 2.2 v31.6 a2.2 2.2 0 0 1 -2.2 2.2 h-2.6 Z"/>
    <circle class="b" cx="8.4" cy="33" r="1.5"/><circle class="b" cx="8.4" cy="47" r="1.5"/><circle class="b" cx="8.4" cy="61" r="1.5"/>
    <path class="t" d="M16 76 C16.6 82 19 86 20.6 92.6 L18.7 93 C17.4 87.4 15.6 83 15.1 76.4 Z"/>`,
  BOW: `
    <path class="ms" d="M19 4 Q23 7 19.5 11 Q7 28 8.5 48 Q7 68 19.5 85 Q23 89 19 92"/>
    <path class="st" d="M19.4 5 L19.4 91"/>
    <rect class="h" x="6.1" y="42" width="4.8" height="12" rx="1.6"/>
    <rect class="b" x="5.8" y="44.6" width="5.4" height="1.2"/><rect class="b" x="5.8" y="50.2" width="5.4" height="1.2"/>
    <path class="t" d="M8.6 54 C9.2 60 11.2 63 12.8 68.4 L11 69 C9.6 64.4 7.9 60.2 7.7 54.4 Z"/>`,
  THROWN: `
    <g transform="rotate(-15 16 74)"><path class="m" d="M16 10 Q17.5 42 16 74 Q14.5 42 16 10 Z"/></g>
    <g transform="rotate(15 16 74)"><path class="m" d="M16 10 Q17.5 42 16 74 Q14.5 42 16 10 Z"/></g>
    <path class="m" d="M16 4 Q17.9 40 16 74 Q14.1 40 16 4 Z"/>
    <circle class="b" cx="16" cy="74.6" r="2"/>
    <path class="t" d="M16 76.4 C17.4 82 15 86.6 16.8 93.6 L15 93.8 C13.4 86.8 15.6 82 15 76.6 Z"/>`,
};

export function weaponSvg(type, cls = '') {
  const body = WEAPON_BODY[type] || WEAPON_BODY.SPEAR;
  return `<svg ${NS} class="ico wsil ${cls}" viewBox="0 0 32 96" aria-hidden="true">${body}</svg>`;
}

// 內功、偃甲專屬技、藥與功能鍵：viewBox 0 0 40 40
const GLYPH = {
  701: `
    <path class="m" d="M12.5 35 Q9 27 10 20.5 L10 12.5 Q10 10.4 12 10.4 Q14 10.4 14 12.5 L14 19 L15 8.4 Q15.2 6.3 17.2 6.4 Q19.1 6.5 19 8.6 L18.8 18 L20.2 7.2 Q20.5 5.2 22.4 5.4 Q24.3 5.7 24 7.7 L23.2 18.4 L25.5 10.4 Q26.1 8.5 28 9 Q29.7 9.6 29.3 11.5 L27.4 22.4 Q30.4 19.4 32.6 20.4 Q34.4 21.4 33.4 23.4 Q28.8 30.4 25.6 35 Z"/>
    <circle class="t" cx="31.6" cy="8.2" r="1.7"/><circle class="t" cx="35" cy="13.6" r="1.1"/><circle class="t" cx="6.6" cy="8.6" r="1.3"/>`,
  702: `
    <g class="ms"><path d="M20 4 V20 M13.1 8 L26.9 16 M13.1 16 L26.9 8"/><path d="M17.6 5.6 L20 8 L22.4 5.6 M17.6 18.4 L20 16 L22.4 18.4"/></g>
    <path class="ms" d="M4 27 q4 -4 8 0 t8 0 t8 0 t8 0"/><path class="ms" d="M7 34 q3.25 -3.4 6.5 0 t6.5 0 t6.5 0 t6.5 0"/>`,
  704: `
    <rect class="m" x="11" y="21" width="17" height="15" rx="5"/>
    <rect class="m" x="15.4" y="5" width="5.4" height="20" rx="2.7"/>
    <path class="bsk" d="M27 4 L31.4 10.6 L26.6 12.4 L32.4 20"/>`,
  9001: `
    <rect class="b" x="7" y="5" width="26" height="13" rx="2.4"/>
    <rect class="m" x="5" y="7.4" width="3" height="8.2" rx="1"/><rect class="m" x="32" y="7.4" width="3" height="8.2" rx="1"/>
    <rect class="h" x="18" y="18" width="4" height="19" rx="1.2"/>
    <circle class="h" cx="13" cy="11.5" r="1.4"/><circle class="h" cx="20" cy="11.5" r="1.4"/><circle class="h" cx="27" cy="11.5" r="1.4"/>`,
  9002: `
    <path class="ms" d="M5 16 Q20 6 35 16"/>
    <rect class="h" x="17.6" y="10" width="4.8" height="26" rx="1.6"/>
    <path class="m" d="M13 4 L14.4 8 L13.6 22 L12.4 22 L11.6 8 Z"/><path class="m" d="M20 2 L21.4 6 L20.6 20 L19.4 20 L18.6 6 Z"/><path class="m" d="M27 4 L28.4 8 L27.6 22 L26.4 22 L25.6 8 Z"/>
    <rect class="b" x="16" y="24" width="8" height="3" rx="1"/>`,
  hp: `
    <rect class="h" x="17.8" y="3" width="4.4" height="5" rx="1.2"/>
    <path class="t" d="M20 7.6 C25 7.6 26.4 12 24.6 15.6 C23.6 17.4 23.6 18.2 25 19.2 C31 22.6 31.6 31 27 34.6 C23.6 37.4 16.4 37.4 13 34.6 C8.4 31 9 22.6 15 19.2 C16.4 18.2 16.4 17.4 15.4 15.6 C13.6 12 15 7.6 20 7.6 Z"/>
    <path class="b" d="M15.2 17.6 Q20 19.6 24.8 17.6 L24.8 19.4 Q20 21.4 15.2 19.4 Z"/>`,
  shield: `
    <path class="m" d="M7 13 L20 6 L33 13 L33 34 L7 34 Z"/>
    <path class="g" d="M7 13 L20 20 L33 13 M20 20 L20 34"/>
    <path class="b" d="M5.6 22.4 H34.4 V25 H5.6 Z"/>`,
  cleanse: `
    <rect class="h" x="17" y="3" width="6" height="5.4" rx="1.4"/>
    <path class="i" d="M16.4 8.4 H23.6 V13 Q29 16 29 23 V31 Q29 36 24 36 H16 Q11 36 11 31 V23 Q11 16 16.4 13 Z"/>
    <path class="m" d="M14.4 25 Q20 22.4 25.6 25 V30 Q20 32.4 14.4 30 Z" opacity=".45"/>`,
  dash: `
    <path class="ms" d="M4 30 q5 -6 10 0 t10 0 t10 0"/>
    <path class="ms" d="M10 21 q4 -5 8 0 t8 0"/>
    <path class="bsk" d="M27 6 L35 10 L27 14"/><path class="bsk" d="M19 8 L29 10"/>`,
  hunt: `
    <circle class="ms" cx="18" cy="22" r="12"/><circle class="ms" cx="18" cy="22" r="6.4"/><circle class="t" cx="18" cy="22" r="2.2"/>
    <path class="bsk" d="M19 21 L34 6 M28 5.4 L34 6 L34.6 12"/>`,
  frenzy: `
    <path class="t" d="M20 3 L23.2 14.2 L34.8 11 L26.6 19.6 L35.4 27.6 L23.8 26.6 L22 38 L17.4 27.4 L6.4 31.6 L13 22 L4.6 13.6 L16.2 15 Z"/>
    <circle class="m" cx="20" cy="21" r="4.6"/>`,
  mech: (() => {
    // 樞輪：十齒齒輪，中央一枚鉚釘孔
    const teeth = 10;
    const pts = [];
    for (let i = 0; i < teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
      const r = (i % 4 === 1 || i % 4 === 2) ? 17 : 13.4;
      pts.push(`${(20 + Math.cos(a) * r).toFixed(2)} ${(20 + Math.sin(a) * r).toFixed(2)}`);
    }
    return `<path class="b" fill-rule="evenodd" d="M${pts.join(' L')} Z M14.6 20 a5.4 5.4 0 1 0 10.8 0 a5.4 5.4 0 1 0 -10.8 0 Z"/>
      <path class="h" d="M20 8.6 V31.4 M8.6 20 H31.4" stroke-width="2.2"/><circle class="m" cx="20" cy="20" r="2.2"/>`;
  })(),
  sound: `
    <path class="m" d="M6 15 H12 L21 7 V33 L12 25 H6 Z"/>
    <path class="ms" d="M25.4 14 Q29 20 25.4 26"/><path class="ms sw" d="M29.6 10 Q36 20 29.6 30"/>`,
  mute: `
    <path class="m" d="M6 15 H12 L21 7 V33 L12 25 H6 Z"/>
    <path class="bsk" d="M26 14 L35 26 M35 14 L26 26"/>`,
};

export function glyphSvg(key, cls = '') {
  return `<svg ${NS} class="ico glyph ${cls}" viewBox="0 0 40 40" aria-hidden="true">${GLYPH[key] || GLYPH.mech}</svg>`;
}

export function skillGlyph(sid, weaponType) {
  if (weaponType) return weaponSvg(weaponType);
  return glyphSvg(GLYPH[sid] ? sid : 'mech');
}

// 鏢旗：旗桿在左，三角旗面朝右；旗面外緣一圈朱紅火焰牙邊（齒尖朝外），旗面本身是靛藍素布。chars 直排寫在靠旗桿處。
export function flagPath(w, h, teeth = 6, amp = 4) {
  const px = 4.6;
  const tip = [w - amp * 1.3 - 0.5, h * 0.46];
  const a = [px, 1 + amp * 1.2];
  const c = [px, h - 1 - amp * 1.2];
  const edge = (p0, p1) => {
    // 每一齒是一道被風往旗尖吹的火舌：兩段二次曲線，齒根在邊上、齒尖往外
    const out = [];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy);
    const nx = dy / len, ny = -dx / len;
    const at = (t, k) => `${(p0[0] + dx * t + nx * k).toFixed(1)} ${(p0[1] + dy * t + ny * k).toFixed(1)}`;
    for (let i = 0; i < teeth; i++) {
      const t0 = i / teeth, t1 = (i + 1) / teeth, d = t1 - t0;
      out.push(`Q${at(t0 + d * 0.15, amp * 0.9)} ${at(t0 + d * 0.78, amp * 1.25)}`);
      out.push(`Q${at(t0 + d * 0.62, amp * 0.25)} ${at(t1, 0)}`);
    }
    return out;
  };
  const top = edge(a, tip);
  const bot = edge(tip, c);
  return `M${a[0]} ${a[1]} ${top.join(' ')} ${bot.join(' ')} Z`;
}

export function flagSvg(chars, { w = 40, h = 58 } = {}) {
  const amp = Math.max(2.4, w * 0.075);
  const fire = flagPath(w, h, 4, amp);
  const px = 4.6;
  const tipX = w - amp * 1.3 - 0.5;
  const cloth = `M${px} ${(1 + amp * 1.2 + 2.4).toFixed(1)} L${(tipX - 4.2).toFixed(1)} ${(h * 0.46).toFixed(1)} L${px} ${(h - 1 - amp * 1.2 - 2.4).toFixed(1)} Z`;
  const list = [...chars];
  const fs = list.length > 1 ? Math.round(h * 0.22) : Math.round(h * 0.3);
  const cy0 = h * 0.46 - ((list.length - 1) * (fs + 1)) / 2;
  const tx = px + fs * 0.62;
  const txt = list.map((ch, i) => `<text x="${tx.toFixed(1)}" y="${(cy0 + i * (fs + 1)).toFixed(1)}" font-size="${fs}">${ch}</text>`).join('');
  return `<svg ${NS} class="flag-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <path class="fire" d="${fire}"/>
    <path class="cloth" d="${cloth}"/>
    <rect class="pole" x="1" y="0" width="3.6" height="${h}" rx="1.6"/>
    <circle class="pole" cx="2.8" cy="1.8" r="2.4"/>
    ${txt}
  </svg>`;
}

// 朱文方印（陽刻）：兩字直排或四字兩欄（右欄先讀）
export function stampSvg(text, { size = 40, cls = '' } = {}) {
  const ch = [...text];
  let body = '';
  if (ch.length <= 2) {
    const fs = ch.length === 1 ? size * 0.62 : size * 0.38;
    body = ch.map((c, i) => `<text x="${size / 2}" y="${(ch.length === 1 ? size / 2 : size * (0.3 + i * 0.4)).toFixed(1)}" font-size="${fs.toFixed(1)}">${c}</text>`).join('');
  } else {
    const fs = size * 0.36;
    const pos = [[0.71, 0.3], [0.71, 0.7], [0.29, 0.3], [0.29, 0.7]];
    body = ch.slice(0, 4).map((c, i) => `<text x="${(size * pos[i][0]).toFixed(1)}" y="${(size * pos[i][1]).toFixed(1)}" font-size="${fs.toFixed(1)}">${c}</text>`).join('');
  }
  return `<svg ${NS} class="stamp-svg ${cls}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <rect x="1.6" y="1.6" width="${size - 3.2}" height="${size - 3.2}" rx="2.2" class="stamp-rim"/>
    <rect x="4.2" y="4.2" width="${size - 8.4}" height="${size - 8.4}" rx="1" class="stamp-rim2"/>
    ${body}
  </svg>`;
}

// 羅盤刻度環（靜態）：72 刻、每 30° 長刻，四正位寫字，北位一枚朱色缺口
export function compassRingSvg(size = 168) {
  const c = size / 2;
  const rOut = c - 2;
  const rTick = c - 9;
  let ticks = '';
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const r0 = long ? rTick - 6 : rTick - 3;
    const x0 = c + Math.sin(a) * r0, y0 = c - Math.cos(a) * r0;
    const x1 = c + Math.sin(a) * rTick, y1 = c - Math.cos(a) * rTick;
    ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${long ? 'tk-l' : 'tk'}"/>`;
  }
  const lab = [['北', 0], ['東', 90], ['南', 180], ['西', 270]].map(([t, deg]) => {
    const a = (deg * Math.PI) / 180;
    const r = rTick - 15;
    const x = (c + Math.sin(a) * r).toFixed(1), y = (c - Math.cos(a) * r).toFixed(1);
    // 字底墊一枚漆木圓，雷達點畫到字底下時字仍讀得到
    return `<circle cx="${x}" cy="${y}" r="8.2" class="cd-bg"/><text x="${x}" y="${y}" class="${t === '北' ? 'cd-n' : 'cd'}">${t}</text>`;
  }).join('');
  return `<svg ${NS} class="compass-ring" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${rOut - 3}" class="ring-band"/>
    <circle cx="${c}" cy="${c}" r="${rOut}" class="ring-lip"/>
    <circle cx="${c}" cy="${c}" r="${rTick + 0.5}" class="ring-in"/>
    ${ticks}
    <path d="M${c - 5} 2.5 L${c + 5} 2.5 L${c} 11 Z" class="north-notch"/>
    ${lab}
  </svg>`;
}
