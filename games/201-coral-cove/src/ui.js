// 介面：手繪風圓形圖示（紙色圓底＋粗細不均、略歪的墨線圈）、魚簍進度、魚餌、按鍵提示、張力條、蓄力環、咬鉤「！」、卡片。
import { rng } from './terrain.js';
import { FISH_INFO } from './fish.js';

const $ = (id) => document.getElementById(id);
const f1 = (v) => v.toFixed(1);

// 一筆畫的墨線：沿中心線兩側展開成填色多邊形，粗細沿筆畫變化、頭尾收尖
function brush(pts, w0, seed, taper = 0.18) {
  const r = rng(seed), n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const u = i / (n - 1);
    const env = Math.min(1, u / taper, (1 - u) / taper);
    const w = w0 * (0.55 + 0.45 * Math.sin(u * 7.3 + seed) * 0.5 + 0.5 * 0.9) * (0.35 + 0.65 * Math.max(0, env)) * (0.85 + r() * 0.3);
    L.push([pts[i][0] - ty * w / 2, pts[i][1] + tx * w / 2]); R.push([pts[i][0] + ty * w / 2, pts[i][1] - tx * w / 2]);
  }
  const all = L.concat(R.reverse());
  return 'M' + all.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
}
// 略歪、頭尾交疊的手繪圓
function wobblyCircle(cx, cy, rad, seed, over = 0.4) {
  const r = rng(seed), pts = [];
  const a0 = r() * 6.28, n = 54, k1 = r() * 6, k2 = r() * 6;
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = a0 + u * (Math.PI * 2 + over);
    const rr = rad * (1 + 0.035 * Math.sin(a * 2 + k1) + 0.02 * Math.sin(a * 3 + k2) + (u - 0.5) * 0.05);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.97]);
  }
  return pts;
}
export function discSVG(seed, inner = '') {
  const fill = wobblyCircle(50, 50, 45, seed + 3, 0).map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L');
  return `<svg class="ring" viewBox="0 0 100 100"><path class="fill" d="M${fill}Z"/><path class="ink" filter="url(#rough)" d="${brush(wobblyCircle(50, 50, 45.5, seed), 5.2, seed)}"/></svg>${inner}`;
}

// 墨線圖示（viewBox 0 0 100 100）
export const ICON = {
  bread: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="tint-crust" d="M14 52c-4-18 10-30 36-30s40 12 36 30c-1 6-6 6-8 6v20c0 4-3 6-7 6H29c-4 0-7-2-7-6V58c-3 0-7 0-8-6z"/><path class="tint-bread" d="M28 58c8-3 36-3 44 0v16c0 3-2 4-5 4H33c-3 0-5-1-5-4z"/><path class="ln" d="M14 52c-4-18 10-30 36-30s40 12 36 30c-1 6-6 6-8 6v20c0 4-3 6-7 6H29c-4 0-7-2-7-6V58c-3 0-7 0-8-6z"/><path class="ln thin" d="M36 40c2-3 5-4 8-4M58 37c3 0 6 2 7 5M42 66h4M56 70h3"/></svg>`,
  shrimp: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="tint-pink" d="M70 28c-22-6-46 6-48 28-1 12 8 20 18 20 6 0 9-4 9-8"/><path class="ln" d="M70 28c-22-6-46 6-48 28-1 12 8 20 18 20 6 0 9-4 9-8M70 28c6 2 10 7 8 12-2 6-12 6-22 9-12 3-18 9-16 18M38 40l6 10M52 33l2 12M28 54l10 2M72 30l14-14M74 34l16-6"/><circle class="ink" cx="70" cy="34" r="2.6"/></svg>`,
  worm: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="ln" style="stroke-width:13;stroke:#c99a86" d="M18 66c8-18 20-18 26-4s16 16 22-2 14-20 18-12"/><path class="ln" d="M18 66c8-18 20-18 26-4s16 16 22-2 14-20 18-12"/><path class="ln thin" d="M30 56l2 7M48 66l-2 7M62 52l5 4"/></svg>`,
  lure: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="tint-silver" d="M48 20c16 10 18 32 4 44-12-10-16-32-4-44z"/><path class="ln" d="M48 20c16 10 18 32 4 44-12-10-16-32-4-44zM48 12v8M52 64v10c0 8-10 10-12 2M40 76l-3-4"/><circle class="ln thin" cx="48" cy="9" r="4"/></svg>`,
  lock: `<svg viewBox="0 0 100 100" filter="url(#rough)"><rect x="18" y="44" width="64" height="46" rx="9" fill="#fbf3e2"/><path class="ln" style="stroke-width:7" d="M30 46V32c0-12 8-20 20-20s20 8 20 20v14M18 50c0-4 3-6 6-6h52c4 0 6 2 6 6v34c0 4-3 6-6 6H24c-4 0-6-2-6-6zM50 62v12"/></svg>`,
  creel: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="tint-straw" d="M22 36h56l-8 50H30z"/><path class="ln" d="M22 36h56l-8 50H30zM25 52h50M28 68h44M38 36l2 50M50 36v50M62 36l-2 50M20 36c4-12 54-12 60 0M30 26c6-10 34-10 40 0"/></svg>`,
  // 關閉：兩筆略歪、粗細不均的交叉
  close: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="ink" d="${brush([[27, 25], [40, 37], [52, 50], [63, 62], [75, 76]], 12, 71)}"/><path class="ink" d="${brush([[74, 26], [62, 39], [50, 51], [38, 63], [26, 75]], 11, 72)}"/></svg>`,
  pause: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="ink" d="${brush([[37, 24], [36, 42], [37, 60], [36, 77]], 15, 81, 0.12)}"/><path class="ink" d="${brush([[64, 23], [65, 41], [63, 59], [64, 76]], 15, 82, 0.12)}"/></svg>`,
  play: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="tint-straw" d="M34 22L78 50L34 78Z"/><path class="ln" style="stroke-width:7" d="M34 22L78 50L34 78Z"/></svg>`,
  sound: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="tint-straw" d="M16 40h14l20-16v52L30 60H16z"/><path class="ln" style="stroke-width:6" d="M16 40h14l20-16v52L30 60H16z"/><path class="ln" style="stroke-width:6" d="M62 36q8 14 0 28M72 26q15 24 0 48"/></svg>`,
  mute: `<svg class="ico" viewBox="0 0 100 100" filter="url(#rough)"><path class="tint-straw" d="M16 40h14l20-16v52L30 60H16z"/><path class="ln" style="stroke-width:6" d="M16 40h14l20-16v52L30 60H16z"/><path class="ln" style="stroke-width:7;stroke:#c4543f" d="M62 38l22 24M84 38L62 62"/></svg>`,
};

function fishPath(w, h, id) {
  // 側面小魚：身體＋尾巴，粗略照魚種比例
  const tall = { tang: 1.25, puffer: 1.3, parrot: 1.05, snapper: 0.95, clown: 1.0 }[id] || 1;
  const hh = h * tall * 0.42, cx = w * 0.44, cy = h / 2;
  return {
    body: `M${f1(w * 0.06)} ${f1(cy)}C${f1(w * 0.18)} ${f1(cy - hh * 1.2)} ${f1(w * 0.58)} ${f1(cy - hh * 1.15)} ${f1(w * 0.76)} ${f1(cy)}C${f1(w * 0.58)} ${f1(cy + hh * 1.15)} ${f1(w * 0.18)} ${f1(cy + hh * 1.2)} ${f1(w * 0.06)} ${f1(cy)}Z`,
    tail: `M${f1(w * 0.74)} ${f1(cy)}L${f1(w * 0.96)} ${f1(cy - hh * 0.9)}L${f1(w * 0.92)} ${f1(cy)}L${f1(w * 0.96)} ${f1(cy + hh * 0.9)}Z`,
    eye: [w * 0.18, cy - hh * 0.2], cx,
  };
}
const FISH_FILL = { clown: '#f7b07a', tang: '#9dbde0', snapper: '#f4a99f', puffer: '#f4e0a4', parrot: '#a9dcc4', sardine: '#c8d4dc' };
function fishArt(id, shadow = false) {
  const p = fishPath(170, 74, id);
  if (shadow) return `<svg class="fishart shadow" viewBox="0 0 170 74" filter="url(#rough)"><path d="${p.tail}" fill="#3b3732" fill-opacity=".72"/><path d="${p.body}" fill="#3b3732" fill-opacity=".72"/></svg>`;
  let extra = '';
  if (id === 'clown') extra = `<path class="ln" style="stroke:#fbf3e2;stroke-width:7" d="M40 18v38M78 16v42"/>`;
  if (id === 'tang') extra = `<path class="ln thin" d="M50 30c20-6 40 0 60 12"/><path d="M126 37l36-22-4 22 4 22z" fill="#f2cf63"/>`;
  if (id === 'puffer') extra = `<g class="ink"><circle cx="70" cy="28" r="3"/><circle cx="92" cy="40" r="3"/><circle cx="58" cy="46" r="2.6"/><circle cx="104" cy="26" r="2.4"/></g>`;
  if (id === 'parrot') extra = `<path class="ln thin" style="stroke:#e98f88" d="M50 30q6 6 0 12M68 26q6 8 0 18M86 28q6 8 0 16"/>`;
  return `<svg class="fishart" viewBox="0 0 170 74" filter="url(#rough)"><path d="${p.tail}" fill="${FISH_FILL[id]}" class="ln"/><path d="${p.body}" fill="${FISH_FILL[id]}"/>${extra}<path class="ln" d="${p.body}"/><path class="ln" d="${p.tail}"/><circle class="ink" cx="${f1(p.eye[0])}" cy="${f1(p.eye[1])}" r="4.2"/><path class="ln thin" d="M46 26c4 8 4 16 0 22"/></svg>`;
}
export { FISH_FILL };
const SLOT = (i) => `<svg viewBox="0 0 24 24"><path class="c" d="M${wobblyCircle(12, 12, 9.5, 60 + i, 0.25).map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L')}"/><path class="b" d="M5 12C8 7.5 13 7.5 16 12C13 16.5 8 16.5 5 12ZM15.5 12L20 8.5V15.5Z"/></svg>`;

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'creelBox', 'creelText', 'creelSlots', 'creelIcon', 'baitIcon', 'baitName', 'baitBtn', 'btnMain', 'btnStow', 'mainKey', 'mainAct', 'tension', 'tensionSvg', 'tensionWord', 'ring', 'ringSvg', 'bang', 'toast', 'intro', 'card', 'full', 'baitMenu', 'creelPanel', 'pauseCard', 'btnPause', 'btnMute', 'stick', 'stickSvg', 'knob', 'loading', 'heroSvg']) this.el[id] = $(id);
    const e = this.el;
    e.creelIcon.innerHTML = discSVG(5, ICON.creel);
    e.btnPause.innerHTML = `<div class="disc">${discSVG(91, ICON.pause)}</div>`;
    this.setMuted(false);
    e.baitIcon.innerHTML = discSVG(11, ICON.bread);
    document.querySelectorAll('.kbtn .disc').forEach((d) => { d.innerHTML = discSVG(+d.dataset.seed); });
    e.creelSlots.innerHTML = Array.from({ length: 8 }, (_, i) => `<span class="slot">${SLOT(i)}</span>`).join('');
    e.stickSvg.innerHTML = `<path fill="rgba(251,243,226,.55)" d="M${wobblyCircle(66, 66, 58, 9, 0).map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L')}Z"/><path class="ink" filter="url(#rough)" style="fill:var(--ink)" d="${brush(wobblyCircle(66, 66, 59, 9), 4, 9)}"/><path class="ln thin" d="M66 16l-6 8h12zM66 116l-6-8h12zM16 66l8-6v12zM116 66l-8-6v12z" style="fill:var(--ink)"/>`;
    e.knob.innerHTML = `<div class="disc" style="width:100%;height:100%">${discSVG(14)}</div>`;
    e.knob.firstChild.style.transform = 'rotate(8deg)';
    e.heroSvg.innerHTML = this.hero();
    e.bang.innerHTML = `<svg viewBox="0 0 62 74" filter="url(#rough)"><path fill="#fbf3e2" d="M31 3C14 3 4 14 4 30s10 26 20 28l7 13 6-13c12-3 21-13 21-28S48 3 31 3z"/><path class="ink" style="fill:var(--ink)" d="${brush([[31, 3], [14, 4], [4, 18], [5, 38], [16, 54], [25, 58], [31, 70], [37, 58], [50, 53], [58, 34], [56, 14], [44, 4], [30, 3.5]], 4.6, 22, 0.05)}"/><path style="fill:#e05a44" d="M27 14c3-2 9-2 10 1l-2 26c-1 3-5 3-6 0z"/><path class="ln thin" d="M27 14c3-2 9-2 10 1l-2 26c-1 3-5 3-6 0z"/><circle style="fill:#e05a44;stroke:var(--ink);stroke-width:3" cx="32" cy="50" r="4.4"/></svg>`;
    this.toastT = 0;
    this.drawTension(0);
  }
  hero() {
    // 標題插圖：斗笠、浪、小魚
    return `<g filter="url(#rough)"><path d="M70 40L105 14L140 40Z" fill="#e8c983"/><path class="ln" d="M70 40L105 14L140 40Q105 47 70 40ZM105 14v-6M82 40q-2 10 6 14M128 40q2 10-6 14"/><path class="ln thin" d="M84 32l42 0M92 25l26 0"/><path class="ln" style="stroke:#58c3c0;stroke-width:5" d="M10 70q15-12 30 0t30 0 30 0 30 0 30 0 30 0 30 0"/><path class="ln thin" style="stroke:#8fe0d2" d="M24 84q12-8 24 0t24 0M126 84q12-8 24 0t24 0"/><path d="M160 54c6-8 18-8 24 0-6 8-18 8-24 0zM184 54l8-6v12z" fill="#f7b07a"/><path class="ln thin" d="M160 54c6-8 18-8 24 0-6 8-18 8-24 0zM184 54l8-6v12z"/><circle class="ink" cx="165" cy="53" r="1.8"/><path d="M28 50c5-6 14-6 18 0-4 6-13 6-18 0zM46 50l6-4v8z" fill="#9dbde0"/><path class="ln thin" d="M28 50c5-6 14-6 18 0-4 6-13 6-18 0zM46 50l6-4v8z"/></g>`;
  }
  show(id, on = true) {
    const el = this.el[id];
    if (!on && el.contains(document.activeElement)) document.activeElement.blur();   // 藏起來的面板不留焦點
    el.classList.toggle('hidden', !on);
  }
  isOpen(id) { return !this.el[id].classList.contains('hidden'); }
  // 魚簍進度：每格依魚種上色（list 是 [{id, len}]）
  setCreel(list, max, bump = false) {
    const n = list.length;
    this.el.creelText.textContent = `魚簍 ${n}/${max}`;
    [...this.el.creelSlots.children].forEach((s, i) => {
      s.classList.toggle('on', i < n);
      if (i < n) { s.style.setProperty('--fc', FISH_FILL[list[i].id] || '#e9967a'); s.dataset.id = list[i].id; } else { s.style.removeProperty('--fc'); delete s.dataset.id; }
    });
    this.el.creelBox.setAttribute('aria-label', `魚簍 ${n}/${max}${n ? '：' + list.map((f) => `${FISH_INFO[f.id].name} ${f.len} 公分`).join('、') : ''}（按 C 打開）`);
    if (bump) this.bumpCreel();
  }
  bumpCreel() { const b = this.el.creelBox; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  setMuted(m) {
    this.el.btnMute.innerHTML = `<div class="disc">${discSVG(93, m ? ICON.mute : ICON.sound)}</div>`;
    this.el.btnMute.setAttribute('aria-label', m ? '開啟聲音（M）' : '靜音（M）');
    this.el.btnMute.setAttribute('aria-pressed', m ? 'true' : 'false');
  }
  setHint(key, act, pulse = false, dim = false, warn = false) {
    if (this.el.mainKey.textContent !== key) this.el.mainKey.textContent = key;
    if (this.el.mainAct.textContent !== act) this.el.mainAct.textContent = act;
    this.el.btnMain.classList.toggle('pulse', pulse);
    this.el.btnMain.classList.toggle('dim', dim);
    this.el.btnMain.classList.toggle('warn', warn);
  }
  setStowDim(dim) { this.el.btnStow.classList.toggle('dim', dim); }
  toast(msg, sec = 2.6) { this.el.toast.textContent = msg; this.el.toast.classList.remove('off'); this.toastT = sec; }
  clearToast() { this.toastT = 0; this.el.toast.classList.add('off'); this.el.toast.textContent = ''; }
  tick(dt) { if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.classList.add('off'); } }
  drawTension(v) {
    const W = 320, H = 34, r = rng(3);
    const box = [[6, 8], [80, 6], [160, 9], [240, 6], [314, 8], [315, 18], [313, 28], [240, 29], [160, 27], [80, 30], [6, 28], [5, 18], [7, 8.5]];
    const fillW = 10 + (W - 20) * Math.max(0, Math.min(1, v));
    const col = v > 0.85 ? '#e9765f' : v > 0.6 ? '#f4a196' : '#8fe0d2';
    let hatch = '';
    for (let x = 14; x < fillW; x += 9) hatch += `M${f1(x)} 26L${f1(x + 7 + r() * 2)} 10`;
    this.el.tensionSvg.innerHTML = `<g filter="url(#rough)"><path fill="#fbf3e2" d="M6 8L314 8L314 28L6 28Z"/><path fill="${col}" d="M9 11L${f1(fillW)} 10L${f1(fillW + 1)} 26L9 26Z"/><path class="ln thin" style="stroke-width:1.6;opacity:.45" d="${hatch}"/><path class="ln" style="stroke:#c4543f;stroke-width:2.4;stroke-dasharray:4 4" d="M${W * 0.86} 4V31"/><path style="fill:var(--ink)" d="${brush(box, 3.6, 5, 0.04)}"/></g>`;
    this.el.tensionWord.textContent = v > 0.86 ? '要斷了！' : v > 0.6 ? '很緊' : v < 0.08 ? '太鬆' : '剛好';
    this.el.tension.classList.toggle('hot', v > 0.86);
  }
  drawRing(p) {
    const pts = wobblyCircle(43, 43, 34, 6, 0);
    const n = Math.max(2, Math.round(pts.length * p));
    const col = p > 0.8 ? '#e9765f' : '#3b3732';
    this.el.ringSvg.innerHTML = `<path fill="rgba(251,243,226,.45)" d="M${pts.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L')}Z"/><path style="fill:${col}" filter="url(#rough)" d="${brush(pts.slice(0, n), 7, 6, 0.06)}"/><text x="43" y="49" text-anchor="middle" font-size="17" font-weight="700" fill="#3b3732">${Math.round(3 + p * 9)}m</text>`;
  }
  place(el, x, y) { el.style.left = x.toFixed(0) + 'px'; el.style.top = y.toFixed(0) + 'px'; }
  showCatch(id, len, note, isBest, tag = '') {
    const info = FISH_INFO[id];
    const badges = (tag === 'new' ? '<span class="rec new">新魚種！</span>' : tag === 'record' ? '<span class="rec">新紀錄</span>' : '') + (isBest ? '<span class="rec">這簍最大</span>' : '');
    this.el.card.innerHTML = `<div class="got">釣到了！</div><h2>${info.name}</h2>${fishArt(id)}<div class="len">${len}<small>cm</small></div>${badges}<div class="note">${note}</div><div class="habit">${info.habit || ''}</div><div class="tap">${document.body.classList.contains('touch') ? '點一下繼續' : '點一下或按空白鍵繼續'}</div>`;
    this.show('card', true);
  }
  // 魚簍面板：這一簍的魚與長度，加上圖鑑（各魚種釣過幾條、最大幾公分；沒釣過的是墨色剪影）
  showCreel(list, max, log) {
    const total = Object.values(log).reduce((a, r) => a + r.n, 0);
    const ids = Object.keys(log);
    const got = ids.filter((id) => log[id].n > 0).length;
    const rows = list.length
      ? `<ol class="now">${list.map((f) => `<li><i class="dot" style="background:${FISH_FILL[f.id]}"></i><span>${FISH_INFO[f.id].name}</span><b>${f.len} cm</b></li>`).join('')}</ol>`
      : '<p class="empty">魚簍還是空的，去釣第一條吧。</p>';
    const dex = ids.map((id) => {
      const r = log[id], seen = r.n > 0, info = FISH_INFO[id];
      return `<li class="${seen ? 'seen' : 'unseen'}">${fishArt(id, !seen)}<div><b>${seen ? info.name : '？？？'}</b>${seen ? `<span>${r.n} 條 · 最大 ${r.max} cm</span><small>${info.habit}</small>` : '<span>還沒釣過</span>'}</div></li>`;
    }).join('');
    this.el.creelPanel.innerHTML = `<h2>魚簍 ${list.length}/${max}</h2><div class="sub">CREEL</div><button class="close" id="creelClose" aria-label="關閉魚簍"><div class="disc">${discSVG(57, ICON.close)}</div></button>${rows}<h3>圖鑑 <small>${got}/${ids.length} 種 · 總共釣過 ${total} 條</small></h3><ul class="dex">${dex}</ul>`;
    this.show('creelPanel', true);
    $('creelClose').focus({ preventScroll: true });
  }
  showPause(on, why = '') {
    if (on) {
      this.el.pauseCard.innerHTML = `<h2>休息一下</h2><div class="sub">PAUSED</div><p class="why">${why || '海浪會等你回來。'}</p><button class="btn" id="resumeBtn">繼續釣魚</button><div class="keyhint">${document.body.classList.contains('touch') ? '點按鈕繼續' : 'P、Esc、空白鍵或 Enter 繼續'}</div>`;
      this.show('pauseCard', true);
      $('resumeBtn').focus({ preventScroll: true });
    } else this.show('pauseCard', false);
  }
  showFull(list) {
    const best = list.reduce((a, b) => (b.len > a.len ? b : a), list[0]);
    this.el.full.innerHTML = `<h2>魚簍滿了！</h2><div class="sub">8 / 8 · 今天的收穫</div><ol>${list.map((f) => `<li><span>${FISH_INFO[f.id].name}</span><b>${f.len} cm</b></li>`).join('')}</ol><div class="best">最大的一條：<b>${FISH_INFO[best.id].name} ${best.len} cm</b></div><button class="btn" id="releaseBtn">放回大海，再釣一簍</button>`;
    this.show('full', true);
    const b = $('releaseBtn'); if (b) b.focus({ preventScroll: true });
  }
  showBaitMenu(cur) {
    const opts = [['bread', '麵包', ICON.bread, false], ['shrimp', '蝦', ICON.shrimp, true], ['worm', '沙蠶', ICON.worm, true], ['lure', '亮片', ICON.lure, true]];
    this.el.baitMenu.innerHTML = `<h2>選魚餌</h2><div class="sub">BAIT</div><button class="close" id="baitClose" aria-label="關閉魚餌選單"><div class="disc">${discSVG(57, ICON.close)}</div></button><div class="grid">${opts.map(([k, n, ic, lk], i) => `<button class="opt${lk ? ' locked' : ''}${k === cur ? ' sel' : ''}" data-bait="${k}" ${lk ? 'aria-disabled="true"' : ''}><div class="disc">${discSVG(40 + i * 7, ic)}</div>${lk ? `<span class="lock">${ICON.lock}</span>` : ''}<span>${n}${lk ? '<small>之後開放</small>' : k === cur ? '<small>使用中</small>' : ''}</span></button>`).join('')}</div>`;
    this.show('baitMenu', true);
    const sel = this.el.baitMenu.querySelector('.opt.sel') || this.el.baitMenu.querySelector('.opt');
    if (sel) sel.focus({ preventScroll: true });
  }
}
