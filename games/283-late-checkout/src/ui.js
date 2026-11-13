// DOM 介面：HUD、擊殺紀錄、暫停選單與計分板、槍匠、設定、結算。
// 原則：不加外框、不放非必要的字；尺寸全由 CSS 的 --u／--pad 隨視窗縮放。
import { PARTS, TEAMS, RULES, weaponStats } from './sim/game.js';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const GUN = c => `<svg class="${c}" viewBox="0 0 38 12" aria-hidden="true"><path d="M0 4h7l2-2h14V1h3v1h10v2h2v2H27l-1 2h-3l-2 4h-4l1-4h-6l-1-2H6l-3 5H0z"/></svg>`;
const SLOTS = [['optic', 'gsOptic'], ['barrel', 'gsBarrel'], ['mag', 'gsMag']];
// 槍匠按鈕上的短名（完整名稱放在 title 提示裡）
const SHORT = { optic: { iron: '機械照門', reflex: '紅點', holo: '全像', scope: '4× 鏡' }, barrel: { std: '標準', long: '重型', sup: '抑制器' }, mag: { std: '30 發', ext: '40 發', drum: '60 發彈鼓' } };

export class UI {
  constructor(h) {
    this.h = h; this.c = {}; this.di = 0; this.bannerT = 0; this.tipT = 0;
    for (const id of ['pv', 'pe']) $(id).innerHTML = '<i></i>'.repeat(RULES.teamSize);
    this.tags = Array.from({ length: 4 }, () => { const d = document.createElement('div'); d.className = 'tag'; $('tags').appendChild(d); return d; });
    for (const [slot, id] of SLOTS) $(id).innerHTML = PARTS[slot].map(p => `<button class="part" data-slot="${slot}" data-id="${p.id}" title="${esc(p.name)}：${esc(p.note)}">${esc(SHORT[slot][p.id] || p.name)}</button>`).join('');
    document.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) { if (e.target === $('pause')) h.act('resume'); return; }
      const d = b.dataset;
      if (d.act) h.act(d.act);
      else if (b.id === 'go') h.start(false);
      else if (b.id === 'watch') h.start(true);
      else if (b.id === 'menuBtn') h.act('menu');
      else if (d.team !== undefined) h.set('team', +d.team);
      else if (d.d) h.set('diff', d.d);
      else if (d.q) h.set('quality', d.q);
      else if (d.k) h.set(d.k, null);
      else if (d.slot) h.part(d.slot, d.id);
      if (d.act !== 'resume') h.sfx(d.slot ? 'key' : 'click');
      b.blur();
    });
    document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('button'); if (b && b !== this.hov) h.sfx('hover'); this.hov = b; });
    for (const [id, k] of [['sSens', 'sens'], ['sFov', 'fov'], ['sVol', 'vol']]) $(id).addEventListener('input', e => h.set(k, +e.target.value));
  }
  t(id, v) { if (this.c[id] !== v) { this.c[id] = v; $(id).textContent = v; } }
  cls(id, name, on) { const k = id + '.' + name; if (this.c[k] !== on) { this.c[k] = on; $(id).classList.toggle(name, on); } }
  css(id, prop, v) { const k = id + ':' + prop; if (this.c[k] !== v) { this.c[k] = v; $(id).style.setProperty(prop, v); } }
  show(id, on) { this.cls(id, 'on', on); }
  // 觀戰模式下玩家那一格也是 bot，用它的代號而不是「你」
  nm(e, g) { return e.isPlayer ? (g.auto ? TEAMS[e.team].names[0] : '你') : e.name; }

  loading(p, text) { $('ldb').style.width = (p * 100).toFixed(0) + '%'; if (text !== undefined) $('ldt').textContent = text; }
  loaded() { $('loading').classList.add('off'); setTimeout(() => $('loading').classList.remove('on'), 700); }

  sync(S) {
    for (const b of $('tTeam').children) b.classList.toggle('on', +b.dataset.team === S.team);
    for (const b of $('tDiff').children) b.classList.toggle('on', b.dataset.d === S.diff);
    for (const b of $('sQual').children) b.classList.toggle('on', b.dataset.q === S.quality);
    for (const b of $('sMisc').children) b.classList.toggle('on', !!S[b.dataset.k]);
    $('sSens').value = S.sens; $('oSens').textContent = S.sens.toFixed(2);
    $('sFov').value = S.fov; $('oFov').textContent = S.fov;
    $('sVol').value = S.vol; $('oVol').textContent = Math.round(S.vol * 100);
    this.css('fps', 'display', S.fps ? 'block' : 'none');
  }
  gunsmith(lo) {
    for (const [slot, id] of SLOTS) for (const b of $(id).children) b.classList.toggle('on', b.dataset.id === lo[slot]);
    const w = weaponStats(lo), bars = [['射程', w.rangeEnd / 56.7], ['穩定', (1.3 - w.recoil) / 0.6], ['開鏡', (0.44 - w.adsTime) / 0.26], ['機動', (w.moveMul - 0.88) / 0.12], ['靜音', 1 - w.noise / 48]];
    $('gsStats').innerHTML = bars.map(([n, v]) => `<span>${n}</span><u><i style="width:${(Math.max(0.04, Math.min(1, v)) * 100).toFixed(0)}%"></i></u>`).join('');
  }

  ledger(el, g) {
    const rows = t => g.board(t).map(e => `<tr class="${e.isPlayer && !g.auto ? 'me' : ''}${e.alive || g.phase === 'over' ? '' : ' dead'}"><td>${esc(this.nm(e, g))}</td><td>${e.k}</td><td>${e.d}</td><td>${e.a}</td></tr>`).join('');
    const tbl = (t, c) => `<table class="${c}"><tr><th>${TEAMS[t].name}</th><th>擊殺</th><th>死亡</th><th>助攻</th></tr>${rows(t)}</table>`;
    $(el).innerHTML = `<div class="big"><span class="v">${g.score[0]}</span><u>:</u><span class="e">${g.score[1]}</span></div><div class="teams">${tbl(0, 'tv')}${tbl(1, 'te')}</div>`;
  }

  // 每幀更新 HUD。v：{ e 視角角色, fp 第一人稱, gap 準星間距 px, scope 0..1, spec 觀戰文字, panel, fps }
  hud(g, v) {
    const e = v.e;
    this.t('sv', g.score[0]); this.t('se', g.score[1]);
    const tl = Math.max(0, Math.ceil(g.phase === 'freeze' ? RULES.roundTime : g.timeLeft));
    this.t('time', (tl / 60 | 0) + ':' + String(tl % 60).padStart(2, '0')); this.cls('time', 'low', tl <= 15 && g.phase === 'live');
    for (let t = 0; t < 2; t++) { const n = g.alive(t), k = 'pips' + t; if (this.c[k] !== n) { this.c[k] = n; const el = $(t ? 'pe' : 'pv').children; for (let i = 0; i < el.length; i++) el[i].classList.toggle('a', (t ? i : el.length - 1 - i) < n); } }
    if (e) {
      const hp = Math.ceil(e.hp); this.t('hpn', hp); this.css('hpb', 'width', hp + '%'); this.cls('hp', 'low', hp <= 35);
      this.t('am', e.ammo); this.t('ar', e.reserve); this.cls('am', 'low', e.ammo <= e.w.mag * 0.25);
    }
    const cross = v.fp && e && e.alive && e.ads < 0.45 && e.sprint < 0.6 && !v.panel;
    this.css('cross', 'opacity', cross ? '1' : '0'); if (cross) this.css('cross', '--g', v.gap.toFixed(1) + 'px');
    this.css('scope', 'opacity', v.scope > 0.02 ? v.scope.toFixed(2) : '0');
    this.css('spec', 'display', v.spec ? 'block' : 'none'); if (v.spec && this.c.spec !== v.spec) { this.c.spec = v.spec; $('spec').innerHTML = v.spec; }
    if (v.fps !== undefined) this.t('fps', v.fps);
  }
  tag(i, on, x, y, text, col) {
    const d = this.tags[i], k = 'tag' + i;
    if (!on) { if (this.c[k]) { this.c[k] = false; d.style.display = 'none'; } return; }
    if (!this.c[k]) { this.c[k] = true; d.style.display = 'block'; d.style.color = col; }
    if (d._t !== text) { d._t = text; d.textContent = text; }
    d.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
  }
  feed(g, k, v, head, assists) {
    const f = $('feed'), d = document.createElement('div'), n = e => `<span class="${e.team ? 'e' : 'v'}${e.isPlayer && !g.auto ? ' me' : ''}">${esc(this.nm(e, g))}</span>`;
    d.innerHTML = n(k) + GUN(head ? 'hs' : '') + n(v) + (assists.length ? `<small>＋${assists.map(a => esc(this.nm(a, g))).join(' ')}</small>` : '');
    f.appendChild(d); while (f.children.length > 4) f.firstChild.remove(); setTimeout(() => d.remove(), 5200);
  }
  clearFeed() { $('feed').innerHTML = ''; }
  banner(big, text, cls, dur = 2600) {
    $('bb').textContent = big; $('bt').textContent = text || ''; $('banner').className = 'on ' + (cls || '');
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => $('banner').classList.remove('on'), dur);
  }
  tip(text, dur = 1800) { const el = $('tip'); el.textContent = text; el.style.opacity = 1; clearTimeout(this.tipT); this.tipT = setTimeout(() => { el.style.opacity = 0; }, dur); }
  hit(head, kill) { const el = $('hitm'); el.className = ''; void el.offsetWidth; el.className = 'h' + (kill ? ' k' : head ? ' hd' : ''); }
  // ang：攻擊者相對視線的角度（弧度，0＝正前方，正值在右）
  damage(ang) {
    const el = $('dmg').children[this.di]; this.di = (this.di + 1) % 3;
    el.style.transition = 'none'; el.style.transform = `rotate(${(ang * 180 / Math.PI).toFixed(0)}deg) translateY(-19vmin)`; el.style.opacity = 1; void el.offsetWidth; el.style.transition = ''; el.style.opacity = 0;
  }
  over(g, win, draw) {
    const r = $('ovRes');
    if (g.auto) { r.textContent = draw ? '平手' : TEAMS[g.score[0] > g.score[1] ? 0 : 1].name; r.style.color = draw ? '' : g.score[0] > g.score[1] ? 'var(--van)' : 'var(--emb)'; }
    else { r.textContent = draw ? '平手' : win ? '勝利' : '落敗'; r.style.color = draw ? '' : win ? 'var(--brass-l)' : 'var(--red)'; }
    this.ledger('overL', g);
  }
  hint(text) { document.querySelector('#pause .hint').textContent = text; }
}
