// DOM HUD（SPEC §13）：血盾、物品列、材料、建造列、準心／狙擊鏡、命中標記、傷害數字、受擊方向、擊殺訊息、
// 提示卡、進度條、風暴橫幅、選單、結算、觀戰、暫停設定。全部由模組狀態＋事件驅動。
import * as THREE from 'three';
import { RARITY, WEAPONS, CONSUMABLES, itemName, itemColor, MAT_COLORS, MAT_NAMES, AMMO_NAMES } from './items.js';
import { ICONS, iconOf, ammoIcon, AMMO_COL } from './match-icons.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SKEY = 'stormwright.settings.v1';
const PIECES = [['wall', '牆', 'Z'], ['floor', '地板', 'X'], ['ramp', '斜坡', 'C']];
const MATS = ['wood', 'stone', 'metal'];
const PIECE_NAMES = { wall: '牆', floor: '地板', ramp: '斜坡' };
const REASONS = { mats: '材料不足（每件需要 10）', far: '太遠了，靠近一點再放置', unsupported: '需要接到地面或其他建材才能放置', buried: '這裡被地形埋住了', water: '不能在水中建造', limit: '建材數量已達上限' };

export class Hud {
  constructor(ctx) {
    this.ctx = ctx; this.mapOpen = false; this.slotClick = -1; this.sig = ''; this.hurtT = 0; this.paused = false;
    this.el = { hud: $('hud'), menu: $('menu'), end: $('end'), pause: $('pause'), bigmap: $('bigmap') };
    this.dmgNums = []; this.arcs = new Map(); this.stack = new Map(); this.gap = 8; this.last = {}; this.spectating = false; this.endShown = false;
    this._timers = [];
    // 靜態圖示
    $('icShield').innerHTML = ICONS.shieldIcon; $('icHeart').innerHTML = ICONS.heart;
    $('stormIcon').innerHTML = ICONS.storm; $('aliveIcon').innerHTML = ICONS.people; $('killIcon').innerHTML = ICONS.skull; $('menuStorm').innerHTML = ICONS.storm;
    document.querySelector('#banner .ic').innerHTML = ICONS.storm; $('endCrown').innerHTML = ICONS.crown;
    // 物品列
    const hb = $('hotbar');
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('div'); s.className = 'slot'; s.dataset.i = i;
      s.innerHTML = `<span class="k">${i + 1}</span><span class="ic"></span><span class="a"></span>`;
      s.addEventListener('pointerdown', (e) => { this.slotClick = i; e.preventDefault(); e.stopPropagation(); });
      hb.appendChild(s);
    }
    this.slots = [...hb.children];
    // 材料
    $('mats').innerHTML = MATS.map((m) => `<div class="m" data-m="${m}">${ICONS[m]}<span>0</span></div>`).join('');
    this.matEls = [...$('mats').children];
    // 建造列
    this.el.buildbar = $('buildbar');
    this.el.buildbar.innerHTML = PIECES.map(([p, n, k]) => `<div class="bp" data-p="${p}"><small>${k}</small><span class="cost">10</span>${ICONS[p]}<span class="nm">${n}</span></div>`).join('')
      + `<div class="bm">${MATS.map((m) => `<div class="m" data-m="${m}">${ICONS[m]}<span>${MAT_NAMES[m]}</span></div>`).join('')}<div class="hint">R 換材料</div></div>`;
    this.el.buildbar.querySelectorAll('.bp').forEach((d) => d.addEventListener('pointerdown', (e) => { if (ctx.input && ctx.input.e) ctx.input.e.piece = d.dataset.p; e.preventDefault(); e.stopPropagation(); }));
    this.bpEls = [...this.el.buildbar.querySelectorAll('.bp')]; this.bmEls = [...this.el.buildbar.querySelectorAll('.bm .m')];
    this.bindUi(); this.loadSettings();
    // 事件
    const ev = ctx.events, P = () => ctx.player;
    ev.on('matchState', ({ state }) => this.onState(state));
    ev.on('unlock', () => { const m = ctx.match.state; if ((m === 'playing' || m === 'bus') && !this.mapOpen && !this.paused) this.togglePause(true); });
    ev.on('damage', (d) => this.onDamage(d));
    ev.on('eliminated', (e) => this.onKill(e));
    ev.on('pickup', ({ actor, item }) => { if (actor === P()) this.notice(`撿起 ${itemName(item)}${item.kind === 'consumable' || item.kind === 'ammo' || item.kind === 'mats' ? ' x' + item.count : ''}`, itemColor(item), item); });
    ev.on('inventoryFull', ({ actor }) => actor === P() && this.notice('背包已滿', '#ff8f8f'));
    ev.on('harvest', ({ actor, material, amount, point, weakPoint }) => { if (actor === P() && amount) { this.matPulse(material); this.floater(point, `+${amount}`, MAT_COLORS[material], weakPoint); } });
    ev.on('stormPhase', (e) => this.onStormPhase(e));
    ev.on('chestOpen', ({ actor }) => actor === P() && this.notice('寶箱已開啟', '#ffe14d'));
    ev.on('heal', ({ actor, kind }) => { if (actor === P()) { const b = $(kind === 'health' ? 'hpBar' : 'shBar'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); } });
    ev.on('lightning', () => { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); });
    ev.on('busDoor', () => { if (ctx.match.state === 'bus') { this.banner('艙門開啟！', '按空白鍵跳下，朝你的目標降落'); this._busBanner = true; } });
    ev.on('matchOver', () => { if (this.spectating) { this.updateSpectateBar(true); this.later(() => { if (this.spectating) this.showEnd(true); }, 2800); } });
    this.onState('menu');
  }

  // ---------- 設定 ----------
  loadSettings() {
    const c = this.ctx, st = c.settings; let s = {};
    try { s = JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { s = {}; }
    if (typeof s.sens === 'number') st.sens = clamp(s.sens, 0.3, 2.5);
    if (typeof s.volume === 'number') st.volume = clamp(s.volume, 0, 1);
    if (typeof s.invertY === 'boolean') st.invertY = s.invertY;
    if (typeof s.autoSprint === 'boolean') st.autoSprint = s.autoSprint;
    if (typeof s.fov === 'number') st.fov = clamp(Math.round(s.fov), 60, 100);
    st.minimapRotate = typeof s.minimapRotate === 'boolean' ? s.minimapRotate : true;
    if (['low', 'medium', 'high', 'epic'].includes(s.quality)) { try { c.render.setQuality(s.quality); c.noAutoQuality = true; } catch (e) { /* 忽略 */ } }
    this.syncSettings();
  }
  saveSettings() {
    const st = this.ctx.settings;
    try { localStorage.setItem(SKEY, JSON.stringify({ sens: st.sens, volume: st.volume, invertY: st.invertY, minimapRotate: st.minimapRotate, autoSprint: st.autoSprint !== false, fov: st.fov || 75, quality: this.ctx.quality })); } catch (e) { /* 無痕模式等 */ }
  }
  syncSettings() {
    const st = this.ctx.settings;
    $('rngSens').value = st.sens; $('valSens').textContent = (+st.sens).toFixed(1);
    $('rngVol').value = st.volume; $('valVol').textContent = Math.round(st.volume * 100);
    $('rngFov').value = st.fov || 75; $('valFov').textContent = st.fov || 75; $('tgAuto').classList.toggle('on', st.autoSprint !== false);
    $('tgInv').classList.toggle('on', !!st.invertY); $('tgRot').classList.toggle('on', st.minimapRotate !== false);
    document.querySelectorAll('#segQ button').forEach((b) => b.classList.toggle('on', b.dataset.q === this.ctx.quality));
  }
  openSettings(fromMenu) {
    this.el.pause.classList.toggle('fromMenu', !!fromMenu); $('setTitle').textContent = fromMenu ? '設定' : '暫停';
    this.syncSettings(); this.el.pause.hidden = false;
  }
  bindUi() {
    const c = this.ctx, E = this.el;
    const go = () => { c.match.start(); c.input.lock(); };
    $('btnStart').onclick = go; $('btnAgain').onclick = go; $('btnAgain2').onclick = go;
    $('btnLobby').onclick = () => c.match.toMenu(); $('btnLobby3').onclick = () => c.match.toMenu();
    $('btnResume').onclick = () => { this.togglePause(false); c.input.lock(); };
    $('btnRestart').onclick = () => { this.togglePause(false); go(); };
    $('btnLobby2').onclick = () => { this.togglePause(false); c.match.toMenu(); };
    $('btnSettings').onclick = () => this.openSettings(true);
    $('btnBack').onclick = () => { E.pause.hidden = true; };
    $('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
    $('btnSpec').onclick = () => this.enterSpectate();
    $('btnReport').onclick = () => { this.spectating = false; this.showEnd(true); };
    $('specPrev').onclick = () => c.match.cycleSpectate(-1); $('specNext').onclick = () => c.match.cycleSpectate(1);
    $('bigmap').addEventListener('pointerdown', () => this.toggleMap(false));
    $('rngSens').oninput = (e) => { c.settings.sens = +e.target.value; $('valSens').textContent = (+e.target.value).toFixed(1); this.saveSettings(); };
    $('rngVol').oninput = (e) => { c.settings.volume = +e.target.value; $('valVol').textContent = Math.round(e.target.value * 100); c.audio.setVolume && c.audio.setVolume(+e.target.value); this.saveSettings(); };
    const tg = (id, key) => { const el = $(id); const f = () => { c.settings[key] = !(key === 'minimapRotate' ? c.settings[key] !== false : c.settings[key]); el.classList.toggle('on', key === 'minimapRotate' ? c.settings[key] !== false : !!c.settings[key]); this.saveSettings(); }; el.onclick = f; el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') f(); }; };
    $('rngFov').oninput = (e) => { c.settings.fov = clamp(Math.round(+e.target.value), 60, 100); $('valFov').textContent = c.settings.fov; this.saveSettings(); };
    $('tgAuto').onclick = () => { c.settings.autoSprint = c.settings.autoSprint === false; $('tgAuto').classList.toggle('on', c.settings.autoSprint !== false); this.saveSettings(); };
    tg('tgInv', 'invertY'); tg('tgRot', 'minimapRotate');
    document.querySelectorAll('#segQ button').forEach((b) => (b.onclick = () => { c.render.setQuality(b.dataset.q); c.noAutoQuality = true; this.syncSettings(); this.saveSettings(); }));
    // UI 點擊音效
    const snd = (n) => c.audio.play && c.audio.play(n);
    document.addEventListener('pointerdown', (e) => {
      const t = e.target.closest && e.target.closest('.btn, .mini, .arr, .tg, .segs button'); if (!t) return;
      snd(t.id === 'btnStart' || t.id === 'btnAgain' || t.id === 'btnAgain2' || t.id === 'btnResume' ? 'ui_confirm' : 'ui_click');
    }, true);
    document.addEventListener('pointerover', (e) => { const t = e.target.closest && e.target.closest('.btn, .mini, .arr, .segs button'); if (t && e.pointerType === 'mouse' && !t.contains(e.relatedTarget)) snd('ui_hover'); }, true);
  }

  // ---------- 狀態切換 ----------
  later(fn, ms) { const id = setTimeout(fn, ms); this._timers.push(id); return id; }
  clearTimers() { this._timers.forEach(clearTimeout); this._timers.length = 0; }
  reset() {
    this.clearTimers(); this.sig = ''; this.dmgNums.forEach((n) => n.el.remove()); this.dmgNums.length = 0; this.arcs.forEach((a) => a.el.remove()); this.arcs.clear(); this.stack.clear();
    for (const id of ['killfeed', 'notices', 'dmg', 'hitdir']) $(id).innerHTML = '';
    $('banner').classList.remove('on'); $('killpop').classList.remove('on'); this.hurtT = 0; this.spectating = false; this.endShown = false; this.last = {};
  }
  onState(s) {
    const E = this.el, c = this.ctx;
    this.clearTimers(); this.spectating = false; this.endShown = false;
    E.menu.hidden = s !== 'menu'; E.hud.hidden = s === 'menu'; E.hud.classList.remove('spec');
    E.end.hidden = true; E.pause.hidden = true; this.paused = false; this.mapOpen = false; E.bigmap.hidden = true; c.paused = false;
    $('spectate').hidden = true; $('specBtns').hidden = true; document.body.classList.remove('building');
    if (s === 'bus') this.reset();
    if (s === 'ended') {
      const m = c.match;
      // 勝利或對戰已結束 → 直接結算；玩家被淘汰但對戰仍在進行 → 先觀戰擊殺者（可隨時開結算）
      if (m.winner === c.player) this.later(() => this.showEnd(), 900);
      else if (m.over) this.later(() => this.showEnd(), 700);
      else this.later(() => this.enterSpectate(), 700);
    }
    c.input.setTouchVisible(s === 'bus' || s === 'playing');
  }
  showEnd(force) {
    const c = this.ctx, m = c.match; if (m.state !== 'ended') return;
    const r = m.summary(), E = this.el.end; this.endShown = true; this.spectating = false;
    E.className = 'screen ' + (r.win ? 'win' : 'lose');
    $('endCrown').hidden = !r.win;
    const t = $('endTitle'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    t.textContent = r.win ? '#1 風暴之冠' : `#${r.place}`;
    $('endSub').textContent = r.win ? 'STORM CROWN' : `你的名次 · 共 ${r.total} 人`;
    $('endWhy').textContent = r.win ? '你是島上最後的倖存者！' : (r.cause + (m.over && r.winner ? ` · 冠軍：${r.winner}` : ''));
    $('btnSpec').hidden = r.win || m.over;
    $('endGrid').innerHTML = [['名次', '#' + r.place], ['擊殺', r.kills], ['存活', fmt(r.time)], ['傷害', r.damage], ['命中率', r.shots ? Math.round(r.accuracy * 100) + '%' : '--'], ['建造', r.builds]]
      .map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('');
    $('confetti').innerHTML = r.win ? Array.from({ length: 44 }, () => `<i style="left:${Math.random() * 100}%;background:${['#ffe14d', '#ff5a5a', '#18c9b0', '#b56cff', '#3aa0f2', '#fff'][Math.floor(Math.random() * 6)]};animation-duration:${3 + Math.random() * 3}s;animation-delay:${-Math.random() * 5}s"></i>`).join('') : '';
    E.hidden = false; this.el.hud.hidden = true; c.input.unlock();
  }
  enterSpectate() {
    this.el.end.hidden = true; this.el.hud.hidden = false; this.el.hud.classList.add('spec'); this.spectating = true;
    $('killpop').classList.remove('on'); $('banner').classList.remove('on');
    $('spectate').hidden = false; $('specBtns').hidden = false; this.updateSpectateBar(true);
  }
  updateSpectateBar(force) {
    const m = this.ctx.match, t = m.spectateTarget || this.ctx.cam.spectate; if (!t) return;
    const sig = t.id + '|' + m.over + '|' + Math.ceil(t.health);
    if (!force && sig === this.last.spec) return; this.last.spec = sig;
    $('specLbl').textContent = m.over ? '對戰結束 · 冠軍' : '觀戰中'; $('specName').textContent = t.name; $('specHp').style.width = t.health + '%';
    $('specPrev').hidden = $('specNext').hidden = m.over;
  }
  togglePause(v) {
    const c = this.ctx; if (c.match.state === 'menu') return;
    this.paused = v === undefined ? !c.paused : v; c.paused = this.paused;
    if (this.paused) { this.openSettings(false); c.input.unlock(); } else this.el.pause.hidden = true;
  }
  toggleMap(v) {
    if (this.ctx.match.state === 'menu') return;
    this.mapOpen = v === undefined ? !this.mapOpen : v; this.el.bigmap.hidden = !this.mapOpen;
    if (this.mapOpen) this.ctx.input.unlock(); else if (this.ctx.input.canLock()) this.ctx.input.lock();
  }

  // ---------- 訊息 ----------
  banner(t, sub = '') { this._busBanner = false; const b = $('banner'); $('bannerT').textContent = t; $('bannerS').textContent = sub; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), 4200); }
  hideBusBanner() { if (this._busBanner) { this._busBanner = false; clearTimeout(this._bt); $('banner').classList.remove('on'); } }
  onStormPhase({ phase, state }) {
    const c = this.ctx, s = c.storm, dmg = s.dmg;
    if (state === 'waiting') this.banner(phase === 1 ? '風暴眼正在形成' : '風暴即將收縮', `第 ${phase} 階段 · 下一個安全區已標示 · 圈外每秒 -${dmg}`);
    else this.banner('風暴正在縮小！', phase >= 6 ? '最後的決戰圈' : '盡快進入白色安全區');
  }
  notice(t, color = '#fff', item = null) {
    const d = document.createElement('div'); d.className = 'nt panel'; d.style.borderRightColor = color;
    const ic = item ? (item.kind === 'ammo' ? ammoIcon(item.defId.slice(5)) : item.kind === 'mats' ? ICONS[item.defId.slice(4)] : iconOf(item.defId)) : '';
    d.innerHTML = `<span>${esc(t)}</span>${ic}`; const box = $('notices'); box.appendChild(d);
    this.later(() => d.classList.add('out'), 3200); this.later(() => d.remove(), 3700); while (box.children.length > 5) box.firstChild.remove();
  }
  matPulse(m) { const el = this.matEls[MATS.indexOf(m)]; if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); } }
  onKill({ victim, killer, weapon, headshot, storm, fall }) {
    const c = this.ctx, p = c.player, f = $('killfeed'), d = document.createElement('div');
    d.className = 'kf panel' + (killer === p ? ' me' : '') + (victim === p ? ' dead' : '');
    const wic = weapon ? iconOf(weapon) : '';
    const hs = headshot ? ICONS.skull.replace('<svg', '<svg class="hs"') : '';
    const sv = ICONS.storm.replace('<svg', '<svg class="hs"');
    // 每筆淘汰都有武器圖示或動詞：武器 → 圖示；未知武器 → 「淘汰了」；風暴 → 風暴圖示；摔落 → 「摔落」
    if (killer) d.innerHTML = `<b>${esc(killer.name)}</b>${wic || '<span class="vb">淘汰了</span>'}${hs}<span class="v">${esc(victim.name)}</span>`;
    else if (fall && !storm) d.innerHTML = `<svg class="hs fall" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3 V15 M6 10 L12 17 L18 10" fill="none" stroke="#0f1d45" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3 V15 M6 10 L12 17 L18 10" fill="none" stroke="#ffb14a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 21 H20" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg><span class="v">${esc(victim.name)}</span><span class="vb">摔落</span>`;
    else d.innerHTML = `${sv}<span class="v">${esc(victim.name)}</span><span class="vb">被風暴淘汰</span>`;
    f.appendChild(d); this.later(() => d.classList.add('out'), 4600); this.later(() => d.remove(), 5100); while (f.children.length > 5) f.firstChild.remove();
    if (killer === p && victim !== p) {
      const kp = $('killpop'); $('kpName').textContent = victim.name; $('kpN').textContent = `本局第 ${p.kills} 次淘汰`; kp.classList.remove('on'); void kp.offsetWidth; kp.classList.add('on');
      this.hitmark(true, true);
    }
  }
  hitmark(head, kill) {
    const hm = $('hitmark'); hm.className = kill ? 'kill' : head ? 'head' : '';
    if (hm.animate) { hm.getAnimations().forEach((a) => a.cancel()); hm.animate([{ opacity: 1, transform: `scale(${kill || head ? 1.9 : 1.6})` }, { opacity: 1, transform: 'scale(1)', offset: 0.35 }, { opacity: 1, transform: 'scale(1)', offset: 0.7 }, { opacity: 0, transform: 'scale(1.05)' }], { duration: kill ? 420 : 240, easing: 'ease-out', fill: 'forwards' }); }
    else { hm.style.opacity = 1; clearTimeout(this._hm); this._hm = setTimeout(() => (hm.style.opacity = 0), 150); }
  }
  onDamage(d) {
    const c = this.ctx, p = c.player;
    if (d.source === p && d.target !== p) {
      this.hitmark(d.headshot, false);
      if (d.point) {
        const shield = d.shieldDamage > d.healthDamage;
        this.floater(d.point, Math.round(d.amount), shield ? '#6cc4ff' : d.headshot ? '#ffe14d' : '#fff', d.headshot, d.target.id);
      }
    }
    if (d.target === p) {
      this.hurtT = 0.45;
      const b = $(d.shieldDamage > 0 ? 'shBar' : 'hpBar'); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
      if (d.source && d.source !== p) this.addArc(d.source);
    }
  }
  addArc(src) {
    let a = this.arcs.get(src.id);
    if (!a) {
      const el = document.createElement('div'); el.className = 'hd';
      el.innerHTML = '<svg viewBox="0 0 220 220"><defs><linearGradient id="hdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5266"/><stop offset="1" stop-color="#ff1f3a" stop-opacity=".3"/></linearGradient></defs><path d="M 41.6 41.6 A 96 96 0 0 1 178.4 41.6" fill="none" stroke="url(#hdg)" stroke-width="13" stroke-linecap="round" transform="rotate(0 110 110)"/><path d="M 61 61 A 70 70 0 0 1 159 61" fill="none" stroke="#ff8a98" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/></svg>';
      $('hitdir').appendChild(el); a = { el, src, t: 0 }; this.arcs.set(src.id, a);
    }
    a.t = 0; a.src = src;
  }
  // 世界座標浮字（傷害、採集）
  floater(pt, text, color, big, key) {
    if (!pt) return;
    const s = document.createElement('span'); s.textContent = text; s.style.color = color;
    const sz = typeof text === 'number' ? clamp(0.85 + text / 90, 0.85, 1.9) * (big ? 1.3 : 1) : 1;
    s.style.fontSize = sz * 1.55 + 'em';
    // 連續命中同一目標：每個數字左右交錯、起始高度錯開，舊的繼續上飄；每個目標最多同時 5 個
    let n = 0;
    if (key != null) { const st = this.stack.get(key); n = st && this.ctx.time.now - st.t < 1.6 ? st.n + 1 : 0; this.stack.set(key, { n, t: this.ctx.time.now }); }
    let ox = (Math.random() - 0.5) * 16, oy = 0;
    $('dmg').appendChild(s);
    if (key != null) {
      const side = n % 2 ? 1 : -1;
      // 錯開高度 ≥ 0.9 × 實際數字高度（量測），數字才不會兩兩疊在一起
      const hh = s.offsetHeight || sz * 1.55 * 16 * 1.2;
      ox = side * (30 + Math.random() * 20); oy = -(n % 3) * hh * 0.95 - Math.random() * 4;
      const same = this.dmgNums.filter((q) => q.key === key);
      while (same.length >= 5) { const q = same.shift(); q.el.remove(); this.dmgNums.splice(this.dmgNums.indexOf(q), 1); }
    }
    this.dmgNums.push({ el: s, key, pt: pt.clone ? pt.clone() : new THREE.Vector3(pt.x, pt.y, pt.z), age: 0, ox, oy, big });
    while (this.dmgNums.length > 28) this.dmgNums.shift().el.remove();
  }

  // ---------- 每幀 ----------
  update(dt) {
    const c = this.ctx, p = c.player, m = c.match, st = m.state;
    if (st === 'menu') return;
    const inv = p.inventory, s = c.storm, L = this.last, touch = c.input.touchMode;
    if (this._busBanner && p.state !== 'bus') this.hideBusBanner();
    const spec = !p.alive;
    // 血盾
    const sh = Math.ceil(p.shield), hp = Math.ceil(p.health);
    if (L.sh !== sh) { L.sh = sh; const b = $('shBar'); const f = clamp(p.shield / 100, 0, 1); b.querySelector('.fl').style.transform = b.querySelector('.gh').style.transform = `scaleX(${f})`; b.querySelector('b').textContent = sh; }
    if (L.hp !== hp) { L.hp = hp; const b = $('hpBar'); const f = clamp(p.health / 100, 0, 1); b.querySelector('.fl').style.transform = b.querySelector('.gh').style.transform = `scaleX(${f})`; b.querySelector('b').textContent = hp; b.classList.toggle('low', p.health < 30); }
    // 統計與風暴計時
    const al = m.alive(); if (L.al !== al) { L.al = al; $('aliveN').textContent = al; }
    if (L.k !== p.kills) { L.k = p.kills; $('killN').textContent = p.kills; }
    const stT = s.active ? (s.state === 'final' ? '--' : fmt(s.timeLeft)) : '--';
    if (L.stT !== stT) { L.stT = stT; $('stormT').textContent = stT; }
    $('pStorm').classList.toggle('shrink', s.active && s.state === 'shrinking');
    // 暈影
    const out = s.active && p.alive && s.isOutside(p.pos.x, p.pos.z);
    this.hurtT = Math.max(0, this.hurtT - dt);
    $('vigStorm').style.opacity = Math.min(1, (s.tint || 0) * 1.05); $('vigStorm').classList.toggle('pulse', out);
    $('vigHurt').style.opacity = p.alive && this.hurtT > 0 ? Math.min(0.9, this.hurtT * 2.4) : 0;
    $('vigLow').classList.toggle('on', p.alive && p.health < 30);
    const sw = $('stormWarn'); sw.hidden = !out || st === 'ended';
    if (out) { const t = `${ICONS.storm.replace('<svg', '<svg')}你在風暴中 · 每秒 -${s.dmg} · 距安全區 ${Math.round(s.distToSafe(p.pos.x, p.pos.z))} m`; if (L.sw !== t) { L.sw = t; sw.innerHTML = t; } }
    // 受擊方向、傷害數字
    this.updateArcs(dt); this.updateFloaters(dt);
    if (spec) { this.updateSpectateBar(); document.body.classList.remove('building'); this.updateBusMsg(p, m, st); return; }
    // 物品列（簽名變更才重繪）
    const sig = inv.selected + '|' + inv.slots.map((it) => (it ? it.uid + ':' + it.mag + ':' + it.count : '-')).join(',') + '|' + JSON.stringify(inv.ammo) + '|' + Object.values(inv.mats).join(',') + '|' + inv.buildMat + '|' + p.building + '|' + p.buildPiece;
    if (sig !== this.sig) { this.sig = sig; this.redrawInventory(p, inv); }
    document.body.classList.toggle('building', !!p.building && p.alive);
    const bb = this.el.buildbar; bb.hidden = !p.building || st === 'bus';
    // 準心
    const it = inv.current(), ads = p.intent.ads, grounded = p.state === 'ground' || p.state === 'air';
    const info = c.combat.weaponInfo ? c.combat.weaponInfo(p) : null;
    const cr = $('cross');
    const scoped = !!(it && it.defId === 'sniper' && ads && grounded && !p.building && (c.cam.adsBlend || 0) > 0.5);
    const cls = p.building ? 'build' : !info ? (it && it.kind === 'consumable' ? 'heal' : '') : info.st.melee ? 'pick' : info.item.defId === 'pump' ? 'shotgun' : '';
    if (L.cls !== cls) { L.cls = cls; cr.className = cls; }
    cr.style.display = scoped || !p.alive || p.state === 'skydive' || p.state === 'glide' || p.state === 'bus' ? 'none' : '';
    let spread = typeof c.combat.crosshairSpread === 'number' ? c.combat.crosshairSpread : (info && !info.st.melee ? info.spread : 0.01);
    const fl = (innerHeight / 2) / Math.tan((c.camera.fov * Math.PI) / 360), want = Math.max(cls === 'shotgun' ? 16 : 5, Math.tan(spread) * fl);
    this.gap += (want - this.gap) * Math.min(1, dt * 22); cr.style.setProperty('--g', this.gap.toFixed(1) + 'px');
    const scp = !!c.cam.scoped && grounded && !p.building;
    $('scope').classList.toggle('on', scp);
    if (scp) cr.style.display = 'none';
    this.updateStructure(p, c);
    // 彈藥顯示
    const am = $('ammo'), showAmmo = !touch && info && !info.st.melee && !p.building && p.state !== 'skydive' && p.state !== 'glide' && st !== 'ended';
    am.hidden = !showAmmo;
    if (showAmmo) {
      const a = `${info.item.uid}|${info.item.mag}|${info.reserve}`;
      if (L.am !== a) { L.am = a; $('ammoName').textContent = WEAPONS[info.item.defId].name; const rc = RARITY[info.item.rarity]; $('ammoRar').textContent = rc.name; $('ammoRar').style.color = rc.color; $('ammoMag').textContent = info.item.mag; $('ammoRes').textContent = info.reserve; $('ammoIc').innerHTML = ammoIcon(WEAPONS[info.item.defId].ammo); am.classList.toggle('empty', info.item.mag <= 0); }
    }
    this.updatePrompt(p, c, touch);
    this.updateAction(p);
    this.updateBusMsg(p, m, st);
  }
  // 建材血條（準心指到的建材）與無法放置的原因
  updateStructure(p, c) {
    const L = this.last, box = $('shp');
    const pc = c.build && c.build.hovered ? c.build.hovered(p) : null;
    if (!pc || p.state === 'skydive' || p.state === 'glide') { if (!box.hidden) box.hidden = true; }
    else {
      box.hidden = false;
      const nm = (MAT_NAMES[pc.mat] || '') + (PIECE_NAMES[pc.type] || '建材') + (pc.building ? ' · 建造中' : '');
      if (L.shn !== nm) { L.shn = nm; $('shpName').textContent = nm; box.dataset.m = pc.mat; }
      const f = clamp(pc.hp / pc.maxHp, 0, 1), hp = Math.ceil(pc.hp) + ' / ' + pc.maxHp;
      $('shpFill').style.transform = `scaleX(${f.toFixed(3)})`; $('shpFill').classList.toggle('grow', !!pc.building);
      if (L.shh !== hp) { L.shh = hp; $('shpHp').textContent = hp; }
    }
    const pv = p.building ? c.build.preview : null, hint = $('bhint');
    const msg = pv && !pv.valid && REASONS[pv.reason] ? REASONS[pv.reason] : '';
    if (L.bh !== msg) { L.bh = msg; hint.hidden = !msg; hint.textContent = msg; }
  }
  redrawInventory(p, inv) {
    this.slots.forEach((el, i) => {
      const it = i === 0 ? { kind: 'weapon', defId: 'pickaxe', rarity: 0, mag: 0 } : inv.slots[i - 1];
      el.classList.toggle('sel', inv.selected === i && !p.building); el.classList.toggle('has', !!it);
      const col = it ? (i === 0 ? '#8fa3c8' : it.kind === 'consumable' ? itemColor(it) : RARITY[it.rarity].color) : 'transparent';
      el.style.setProperty('--rc', col);
      el.classList.toggle('legend', !!it && it.kind === 'weapon' && it.rarity === 4);
      el.querySelector('.ic').innerHTML = it ? iconOf(it.defId) : '';
      el.querySelector('.a').innerHTML = !it || i === 0 ? '' : it.kind === 'weapon' ? `${it.mag}<em>/${inv.ammo[WEAPONS[it.defId].ammo]}</em>` : 'x' + it.count;
    });
    this.matEls.forEach((d) => { d.querySelector('span').textContent = inv.mats[d.dataset.m]; d.classList.toggle('cur', inv.buildMat === d.dataset.m); });
    this.bpEls.forEach((d) => { d.classList.toggle('sel', d.dataset.p === p.buildPiece); d.classList.toggle('poor', inv.mats[inv.buildMat] < 10); });
    this.bmEls.forEach((d) => d.classList.toggle('cur', d.dataset.m === inv.buildMat));
  }
  updatePrompt(p, c, touch) {
    const pr = $('prompt'), L = this.last;
    let near = null;
    if (p.alive && p.state === 'ground' && !p.building) {
      const l = c.loot;
      if (typeof l.nearestPickup === 'function') near = l.nearestPickup(p); else if (l.nearestPickup && typeof l.nearestPickup === 'object') near = l.nearestPickup; else if (l.nearest) near = l.nearest(p);
    }
    if (near && p.intent.ads && p.inventory.current() && p.inventory.current().defId === 'sniper') near = null;
    if (!near) { if (L.pr !== 'none') { L.pr = 'none'; pr.hidden = true; } return; }
    const chest = near.kind === 'chest' || !!near.chest, item = near.item || (near.pickup && near.pickup.item);
    if (!chest && !item) { pr.hidden = true; return; }
    const rep = !chest && near.replaces ? near.replaces : null;
    const sig = chest ? 'chest' : item.uid + ':' + item.count + ':' + (rep ? rep.uid : '');
    if (L.pr !== sig) {
      L.pr = sig; pr.hidden = false; pr.classList.toggle('chest', chest);
      if (chest) { pr.style.setProperty('--rc', '#ffe14d'); $('promptSub').textContent = '補給箱'; $('promptTxt').textContent = touch ? '按住 開啟寶箱' : '按住 開啟寶箱'; }
      else {
        const col = itemColor(item); pr.style.setProperty('--rc', col);
        $('promptIc').innerHTML = item.kind === 'ammo' ? ammoIcon(item.defId.slice(5)) : item.kind === 'mats' ? ICONS[item.defId.slice(4)] : iconOf(item.defId);
        $('promptSub').textContent = item.kind === 'weapon' ? `${RARITY[item.rarity].name} · 武器` : item.kind === 'consumable' ? '消耗品' : item.kind === 'ammo' ? '彈藥' : '材料';
        const nmI = item.kind === 'weapon' ? WEAPONS[item.defId].name : itemName(item);
        $('promptTxt').textContent = rep ? `交換 ${rep.kind === 'weapon' ? WEAPONS[rep.defId].name : itemName(rep)} → ${nmI}` : `撿起 ${nmI}${item.count > 1 && item.kind !== 'weapon' ? ' x' + item.count : ''}`;
      }
    }
    if (chest) { const a = p.action; const f = a && a.kind === 'open' ? clamp(a.t / a.duration, 0, 1) : 0; $('holdFg').style.strokeDashoffset = (100 - f * 100).toFixed(1); }
  }
  updateAction(p) {
    const act = p.action, box = $('act'), L = this.last;
    const show = act && act.kind !== 'open';
    if (!show) { if (!box.hidden) box.hidden = true; return; }
    box.hidden = false;
    let lbl = '換彈中', cls = 'reload';
    if (act.kind === 'consume') { const it = act.data && act.data.item, def = it && CONSUMABLES[it.defId]; lbl = '使用 ' + (def ? def.name : ''); cls = def && def.heal === 'shield' ? 'shield' : 'heal'; }
    else if (act.data && act.data.item) lbl = '換彈 ' + WEAPONS[act.data.item.defId].name;
    if (L.al2 !== lbl) { L.al2 = lbl; $('actLbl').textContent = lbl; box.className = 'txt ' + cls; }
    box.querySelector('i').style.width = clamp(act.t / act.duration, 0, 1) * 100 + '%'; $('actT').textContent = Math.max(0, act.duration - act.t).toFixed(1) + 's';
  }
  updateBusMsg(p, m, st) {
    const bm = $('busmsg'), ab = $('altbox'), L = this.last, touch = this.ctx.input.touchMode;
    let html = '', alt = false;
    if (st === 'bus' && p.state === 'bus' && p.alive) {
      if (!m.canJump()) html = `<small>艙門開啟倒數</small><span class="big cd">${Math.ceil(m.openIn())}</span>`;
      else { const left = m.routeLeft(); html = `<span class="big">準備跳傘</span><small>${touch ? '點「跳」按鈕' : '按 <kbd>空白鍵</kbd>'} 跳下！</small>${left < 14 ? `<small>航線終點 ${Math.ceil(left)} 秒後強制跳傘</small>` : ''}`; }
    } else if (p.state === 'skydive' && p.alive) {
      html = p.altitude() < 90 ? `<span class="big">開滑翔翼</span><small>${touch ? '點「跳」' : '按 <kbd>空白鍵</kbd>'} 展開</small>` : `<small>${touch ? '拖曳畫面控制方向' : '滑鼠控制方向'} · 低頭俯衝更快</small>`; alt = true;
    } else if (p.state === 'glide' && p.alive) alt = true;
    if (L.bus !== html) { L.bus = html; bm.hidden = !html; bm.innerHTML = html; }
    ab.hidden = !alt;
    if (alt) { const a = Math.round(p.altitude()), v = Math.round(Math.hypot(p.vel.x, p.vel.y, p.vel.z) * 3.6); if (L.alt !== a + '|' + v) { L.alt = a + '|' + v; $('altV').textContent = a; $('spdV').textContent = v; } }
  }
  updateArcs(dt) {
    if (!this.arcs.size) return;
    const yaw = this.ctx.playerCtl.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw), p = this.ctx.player;
    for (const [id, a] of this.arcs) {
      a.t += dt; const life = 1.4;
      if (a.t > life || !a.src) { a.el.remove(); this.arcs.delete(id); continue; }
      const dx = a.src.pos.x - p.pos.x, dz = a.src.pos.z - p.pos.z, fx = dx * -sy + dz * -cy, rx = dx * cy + dz * -sy;
      a.el.style.transform = `rotate(${Math.atan2(rx, fx)}rad)`; a.el.style.opacity = clamp((life - a.t) / 0.6, 0, 1);
    }
  }
  updateFloaters(dt) {
    if (!this.dmgNums.length) return;
    const cam = this.ctx.camera; cam.updateMatrixWorld();
    const W = innerWidth, H = innerHeight;
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const n = this.dmgNums[i]; n.age += dt; const life = 1.0;
      if (n.age >= life) { n.el.remove(); this.dmgNums.splice(i, 1); continue; }
      _v.copy(n.pt).project(cam);
      if (_v.z > 1) { n.el.style.opacity = 0; continue; }
      const t = n.age / life, e = 1 - Math.pow(1 - Math.min(1, t * 1.6), 3), pop = n.age < 0.12 ? 1.55 - (n.age / 0.12) * 0.55 : 1;
      const x = (_v.x * 0.5 + 0.5) * W + n.ox, y = (-_v.y * 0.5 + 0.5) * H + n.oy - e * 58 + (n.age < 0.3 ? Math.sin(n.age / 0.3 * Math.PI) * -10 : 0);
      n.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${pop.toFixed(3)})`;
      n.el.style.opacity = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
    }
  }
}
