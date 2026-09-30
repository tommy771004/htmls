// 手繪美術：SIDEWINDER 字標（多邊形字形＋蛇鱗紋）、菱形背紋鏈、夾板木紋、小圖示。

// 字形：字高 100 的多邊形（外框＋可選的字腔），外角切 45° 斜角，呼應菱形背紋
const GLYPHS = {
  S: { w: 58, p: [[[8, 0], [58, 0], [58, 19], [22, 19], [22, 40], [50, 40], [58, 48], [58, 92], [50, 100], [0, 100], [0, 81], [36, 81], [36, 60], [8, 60], [0, 52], [0, 8]]] },
  I: { w: 24, p: [[[6, 0], [18, 0], [24, 6], [24, 94], [18, 100], [6, 100], [0, 94], [0, 6]]] },
  D: { w: 60, p: [[[6, 0], [44, 0], [60, 16], [60, 84], [44, 100], [6, 100], [0, 94], [0, 6]], [[22, 19], [34, 19], [38, 23], [38, 77], [34, 81], [22, 81]]] },
  E: { w: 50, p: [[[6, 0], [50, 0], [50, 19], [22, 19], [22, 40], [44, 40], [44, 59], [22, 59], [22, 81], [50, 81], [50, 100], [6, 100], [0, 94], [0, 6]]] },
  W: { w: 94, p: [[[0, 0], [22, 0], [22, 79], [36, 79], [36, 26], [58, 26], [58, 79], [72, 79], [72, 0], [94, 0], [94, 90], [84, 100], [10, 100], [0, 90]]] },
  N: { w: 62, p: [[[6, 0], [24, 0], [38, 46], [38, 0], [62, 0], [62, 94], [56, 100], [38, 100], [24, 54], [24, 100], [6, 100], [0, 94], [0, 6]]] },
  R: { w: 60, p: [[[6, 0], [46, 0], [60, 14], [60, 46], [50, 58], [62, 100], [39, 100], [29, 66], [22, 66], [22, 100], [0, 100], [0, 6]], [[22, 19], [36, 19], [38, 21], [38, 45], [36, 47], [22, 47]]] },
};

function glyphPath(ch, x0) {
  const g = GLYPHS[ch];
  return g.p.map((poly) => 'M' + poly.map(([x, y]) => (x + x0) + ' ' + y).join('L') + 'Z').join('');
}

// 字標 SVG 字串。uid 讓同頁多個實例的 id 不衝突
export function wordmark(uid = 'wm', { tracks = true, label = 'SIDEWINDER' } = {}) {
  const word = 'SIDEWINDER';
  const gap = 7;
  let x = 0;
  let d = '';
  for (const ch of word) {
    d += glyphPath(ch, x);
    x += GLYPHS[ch].w + gap;
  }
  const w = x - gap;
  const skew = -12;
  const slant = Math.tan((-skew * Math.PI) / 180) * 100;
  const vbW = Math.ceil(w + slant + 14);
  const vbH = tracks ? 146 : 112;
  // 響尾蛇側行留下的 J 形足跡，一列斜斜排開
  let marks = '';
  if (tracks) {
    for (let i = 0; i < 22; i++) {
      const mx = 20 + i * 28;
      marks += `<path d="M${mx} 138 l9 -15 q2 -3.4 5.2 -1.6"/>`;
    }
  }
  // 字身中線的一排小菱形切口（背紋的「鑽石切」）
  let cuts = '';
  for (let cx = 5; cx < w; cx += 13) cuts += `<path d="M${cx} 45.5l4 4-4 4-4-4z"/>`;
  return `<svg class="wordmark" viewBox="-4 -4 ${vbW} ${vbH}" role="img" aria-label="${label}">
<defs>
<pattern id="${uid}-sc" width="12" height="9" patternUnits="userSpaceOnUse" patternTransform="skewX(${skew})">
<rect width="12" height="9" fill="#d9a62c"/>
<path d="M6 0.6L11.4 4.5L6 8.4L0.6 4.5Z" fill="#e7bb4a"/>
<path d="M6 2.2L9.2 4.5L6 6.8L2.8 4.5Z" fill="#b57b1d"/>
</pattern>
<clipPath id="${uid}-cl"><path d="${d}"/></clipPath>
</defs>
<g transform="translate(${slant.toFixed(2)} 0) skewX(${skew})">
<path d="${d}" transform="translate(6 7)" fill="#6e2618" fill-rule="evenodd"/>
<path d="${d}" fill="url(#${uid}-sc)" fill-rule="evenodd" stroke="#1d110a" stroke-width="3.2" stroke-linejoin="miter" paint-order="stroke"/>
<g clip-path="url(#${uid}-cl)" fill="#1d110a">${cuts}</g>
</g>
${tracks ? `<g class="wm-tracks" fill="none" stroke="#eadfc8" stroke-width="3" stroke-linecap="round" opacity=".55">${marks}</g>` : ''}
</svg>`;
}

// 菱形背紋鏈：n 顆，done 顆填滿，part 為目前那顆的填充比例（0..1）
export function diamondChain(n, done, part = 0, { size = 18, cls = 'chain', label = '' } = {}) {
  const s = size;
  const step = s * 0.92;
  const w = step * (n - 1) + s + 2;
  let out = `<svg class="${cls}" viewBox="-1 -1 ${w.toFixed(1)} ${s + 2}" width="${w.toFixed(1)}" height="${s + 2}"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}>`;
  // 鏈身：一條連接各菱形中心的細帶
  out += `<path d="M${s / 2} ${s / 2}H${(step * (n - 1) + s / 2).toFixed(1)}" class="ch-link"/>`;
  for (let i = 0; i < n; i++) {
    const cx = i * step + s / 2;
    const cy = s / 2;
    const r = s / 2;
    const dPath = `M${cx} ${cy - r}L${cx + r * 0.78} ${cy}L${cx} ${cy + r}L${cx - r * 0.78} ${cy}Z`;
    const inner = `M${cx} ${cy - r * 0.46}L${cx + r * 0.36} ${cy}L${cx} ${cy + r * 0.46}L${cx - r * 0.36} ${cy}Z`;
    if (i < done) {
      out += `<path d="${dPath}" class="ch-on"/><path d="${inner}" class="ch-core"/>`;
    } else if (i === done && part > 0) {
      const f = Math.max(0, Math.min(1, part));
      const y = cy + r - 2 * r * f;
      out += `<path d="${dPath}" class="ch-off"/><clipPath id="cp${cls.length}${i}${n}"><rect x="${cx - r}" y="${y.toFixed(2)}" width="${2 * r}" height="${(2 * r * f).toFixed(2)}"/></clipPath>`;
      out += `<path d="${dPath}" class="ch-on ch-part" clip-path="url(#cp${cls.length}${i}${n})"/><path d="${dPath}" class="ch-cur"/>`;
    } else {
      out += `<path d="${dPath}" class="ch-off"/>`;
    }
  }
  return out + '</svg>';
}

// 單顆菱形（車色標記）
export function diamond(color, size = 14, stroke = '#1d110a') {
  const r = size / 2;
  return `<svg class="dia" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><path d="M${r} 0.8L${size - 1.5} ${r}L${r} ${size - 0.8}L1.5 ${r}Z" fill="${color}" stroke="${stroke}" stroke-width="1.4"/></svg>`;
}

// 夾板木紋：程序產生的半透明紋理（疊在面板底色上）
export function plywoodTexture(w = 512, h = 256, seed = 7) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return '';
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  // 年輪：沿 x 方向的波動細線，深淺交錯
  const lines = 90;
  for (let i = 0; i < lines; i++) {
    const y0 = (i / lines) * h + rnd() * 3;
    const amp = 1 + rnd() * 3.5;
    const freq = 0.004 + rnd() * 0.01;
    const ph = rnd() * 6.28;
    const dark = rnd() < 0.62;
    g.strokeStyle = dark ? `rgba(20,10,4,${0.05 + rnd() * 0.16})` : `rgba(255,236,200,${0.02 + rnd() * 0.05})`;
    g.lineWidth = 0.6 + rnd() * 1.8;
    g.beginPath();
    for (let x = -4; x <= w + 4; x += 6) {
      const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * 0.25;
      if (x < 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  // 兩個節疤：同心橢圓，年輪繞過去
  for (let k = 0; k < 2; k++) {
    const kx = rnd() * w;
    const ky = rnd() * h;
    for (let r = 2; r < 16; r += 2.2) {
      g.strokeStyle = `rgba(20,10,4,${0.2 - r * 0.009})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(kx, ky, r * 2.6, r * 0.9, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // 細顆粒
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = rnd();
    if (n < 0.35) {
      d[i] = 20; d[i + 1] = 10; d[i + 2] = 4;
      d[i + 3] = Math.max(d[i + 3], (n * 40) | 0);
    }
  }
  g.putImageData(img, 0, 0);
  try {
    return c.toDataURL('image/png');
  } catch (e) {
    return '';
  }
}

// 自繪小圖示（線寬 2、方頭斜角；統一在 24 格）
const ICON = {
  key: '<path d="M3 6.5h18v11H3z"/><path d="M6.5 10h1.5M10 10h1.5M13.5 10h1.5M17 10h.5M7 14h10"/>',
  pad: '<path d="M7.5 7h9l3.5 3 1.5 6.5-2 1.5-3.5-3.5h-8L4.5 18 2.5 16.5 4 10z"/><path d="M8 9.5v3M6.5 11h3"/><path d="M16 10.5l1 1M14.5 12l1 1"/>',
  spin: '<path d="M12 3.5a8.5 8.5 0 1 1-6 2.5"/><path d="M12 12l4.5-4.5"/><path d="M3.5 4v4h4"/>',
  touch: '<path d="M9 12.5V5.5a1.5 1.5 0 0 1 3 0v6"/><path d="M12 10.5a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1 3 0v3.5c0 3-2 5-5 5h-1c-2.4 0-3.6-1.2-5-3.5L5 15.5a1.5 1.5 0 0 1 2.5-1.6L9 15.5"/>',
  can: '<path d="M9 3.5h6M10 3.5v2.5M14 3.5v2.5M8 6h8l1 2v12.5H7V8z"/><path d="M10 11l2 2.5L14 11"/>',
};
export function icon(name, cls = 'ico') {
  return `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
}

// 氮氣瓶（HUD 用的實心小罐）
export function nitroCan(on = true, burning = false) {
  return `<svg class="can${on ? ' on' : ''}${burning ? ' burn' : ''}" viewBox="0 0 12 22" width="12" height="22" aria-hidden="true"><path d="M4 0.8h4v2.4H4z"/><path d="M2.2 4.4h7.6l1.2 2V21H1V6.4z"/><path class="can-band" d="M1 11h10v3H1z"/></svg>`;
}
