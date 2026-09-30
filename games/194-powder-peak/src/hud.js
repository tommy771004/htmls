// DOM HUD：計時、分數、生命、小地圖、速度錶、BOOST、浮字、標題/暫停/結算畫面、觸控按鈕。
// 標記在 index.html；這裡只快取元素參照，字串有變才寫 textContent。
import { config } from './config.js';

const C = { ...config.hud }; // 預設值唯一來源是 config.js
const LIVES = (config.score && config.score.lives) || 3;

const GAUGE_STOPS = [
  [0.0, [46, 205, 190]],
  [0.25, [96, 214, 96]],
  [0.5, [255, 214, 64]],
  [0.72, [255, 150, 36]],
  [0.88, [255, 78, 96]],
  [1.0, [246, 64, 160]],
];

const HELMET = '<svg class="life" viewBox="0 0 24 24" aria-hidden="true">'
  + '<path d="M6.6 12.6C3.9 12.3 2.2 9.8 2.6 5.8c1.1 2.7 2.7 3.9 5 4.4z" fill="#fff4dc" stroke="#1c2a44" stroke-width="1.1" stroke-linejoin="round"/>'
  + '<path d="M17.4 12.6c2.7-.3 4.4-2.8 4-6.8-1.1 2.7-2.7 3.9-5 4.4z" fill="#fff4dc" stroke="#1c2a44" stroke-width="1.1" stroke-linejoin="round"/>'
  + '<path d="M5.6 15.4a6.4 6.4 0 0 1 12.8 0z" fill="#dfe8f3" stroke="#1c2a44" stroke-width="1.1" stroke-linejoin="round"/>'
  + '<rect x="4.6" y="15" width="14.8" height="3.6" rx="1.2" fill="#ffc93c" stroke="#1c2a44" stroke-width="1.1"/>'
  + '<path d="M12 9v6" stroke="#9fb2c9" stroke-width="1.4"/></svg>';

export function formatTime(t) {
  const cs = Math.max(0, Math.floor(t * 100 + 1e-6));
  return fmtCs(cs);
}

function fmtCs(cs) {
  const m = Math.floor(cs / 6000);
  const s = Math.floor(cs / 100) % 60;
  const c = cs % 100;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c;
}

export function formatInt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function mixStops(t) {
  for (let i = 1; i < GAUGE_STOPS.length; i++) {
    const [t1, c1] = GAUGE_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = GAUGE_STOPS[i - 1];
      const k = (t - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * k);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * k);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * k);
      return `rgb(${r},${g},${b})`;
    }
  }
  const c = GAUGE_STOPS[GAUGE_STOPS.length - 1][1];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export class HUD {
  constructor(root) {
    const base = root || document.body;
    const hud = base.id === 'hud' ? base : base.querySelector('#hud') || document.getElementById('hud') || base;
    this.root = hud;
    const q = (id) => {
      const el = hud.querySelector('#' + id) || document.getElementById(id);
      if (!el) console.warn('[hud] missing #' + id);
      return el || document.createElement('div');
    };
    this.el = {
      time: q('hud-time'), score: q('hud-score'), combo: q('hud-combo'), lives: q('hud-lives'),
      minimap: q('hud-minimap'), distance: q('hud-distance'),
      mute: q('hud-mute'), pause: q('hud-pause'),
      speed: q('hud-speed'), gauge: q('hud-gauge'),
      boost: q('hud-boost'), boostBar: q('hud-boost-bar'), boostBg: q('hud-boost-bg'), boostFill: q('hud-boost-fill'),
      popups: q('hud-popups'), keys: q('hud-keys'),
      title: q('hud-title'), paused: q('hud-paused'), results: q('hud-results'),
      resDistance: q('res-distance'), resSpeed: q('res-speed'), resAir: q('res-air'), resTime: q('res-time'),
      resGates: q('res-gates'), resScore: q('res-score'), resBest: q('res-best'),
    };
    this._touch = {
      left: q('hud-t-left'), right: q('hud-t-right'), jump: q('hud-t-jump'), boost: q('hud-t-boost'),
    };
    this._handlers = Object.create(null);
    this.screen = 'title';
    this.muted = false;
    this._locked = false;

    // 顯示中的值（有變才寫 DOM）
    this._cs = -1; this._score = -1; this._speed = -1; this._boostQ = -1; this._boostLow = null;
    this._lives = -1; this._combo = -1; this._dist = -1;
    this._mmLast = -1; this._mmInit = false; this._mmScale = 1; this._mmScaleV = 1; this._mmCx = 0;

    // 生命、BOOST 分段
    this.el.lives.innerHTML = HELMET.repeat(LIVES);
    this._pips = Array.from(this.el.lives.children);
    const segs = '<i></i>'.repeat(C.boostSegments);
    this.el.boostBg.innerHTML = segs;
    this.el.boostFill.innerHTML = segs;
    this._gaugeColors = [];
    for (let i = 0; i < C.gaugeSegments; i++) this._gaugeColors.push(mixStops((i + 0.5) / C.gaugeSegments));

    this._mmCtx = this.el.minimap.getContext ? this.el.minimap.getContext('2d') : null;
    this._gCtx = this.el.gauge.getContext ? this.el.gauge.getContext('2d') : null;
    this._mmW = 0; this._mmH = 0; this._gW = 0; this._gH = 0; this._dpr = 1;
    this._lastMinimap = null;
    this._resize = this._resize.bind(this);
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(this._resize);
      this._ro.observe(this.el.minimap);
      this._ro.observe(this.el.gauge);
    }
    window.addEventListener('resize', this._resize);
    this._resize();

    // 按鍵提示高亮
    this._keyMap = new Map();
    for (const k of this.el.keys.querySelectorAll('[data-keys]')) {
      for (const code of k.dataset.keys.split(' ')) this._keyMap.set(code, k);
    }

    this._bindEvents();
    this.setScreen('title');
    this._drawGauge(0);
  }

  on(event, fn) {
    (this._handlers[event] || (this._handlers[event] = [])).push(fn);
    return this;
  }

  _emit(event, arg) {
    const list = this._handlers[event];
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try { list[i](arg); } catch (e) { console.error(e); }
    }
  }

  _bindEvents() {
    const hud = this.root;
    hud.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('[data-action]');
      if (!btn || !hud.contains(btn)) return;
      const a = btn.dataset.action;
      if (e.detail > 0) btn.blur(); // 滑鼠點擊後不留焦點，避免 Space 觸發按鈕
      if (a === 'start' || a === 'restart') {
        if (this._locked) return;
        this._locked = true;
        this._emit(a);
      } else if (a === 'resume') {
        this._emit('resume');
      } else if (a === 'toggle-pause') {
        if (this.screen === 'playing') this._emit('pause');
        else if (this.screen === 'paused') this._emit('resume');
      } else if (a === 'mute') {
        this.setMuted(!this.muted);
        this._emit('mute', this.muted);
      }
    });
    // 小圓鈕與觸控鈕不搶焦點
    for (const b of hud.querySelectorAll('.iconbtn, .tbtn')) {
      b.addEventListener('mousedown', (e) => e.preventDefault());
    }
    // 觸控鈕按下視覺
    for (const b of Object.values(this._touch)) {
      const down = (e) => { b.classList.add('down'); if (e.cancelable) e.preventDefault(); };
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    // 觸控筆電：第一次觸控後顯示觸控按鈕
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !hud.hasAttribute('data-touch')) hud.setAttribute('data-touch', '');
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      const k = this._keyMap.get(e.code);
      if (k && !k.classList.contains('down')) k.classList.add('down');
      if (e.repeat) return;
      const isGo = e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space';
      if (!isGo) return;
      if (this.screen !== 'title' && this.screen !== 'results') return;
      const t = e.target;
      if (t && t.closest && t.closest('button')) return; // 焦點在按鈕上 → 交給原生 click
      e.preventDefault();
      if (this._locked) return;
      this._locked = true;
      this._emit(this.screen === 'title' ? 'start' : 'restart');
    });
    window.addEventListener('keyup', (e) => {
      const k = this._keyMap.get(e.code);
      if (k) k.classList.remove('down');
    });
    window.addEventListener('blur', () => {
      for (const k of this._keyMap.values()) k.classList.remove('down');
    });
  }

  setScreen(name) {
    const prev = this.screen;
    this.screen = name;
    this._locked = false;
    this.root.dataset.screen = name;
    this.el.title.hidden = name !== 'title';
    this.el.paused.hidden = name !== 'paused';
    this.el.results.hidden = name !== 'results';

    const paused = name === 'paused';
    const [pauseIcon, playIcon] = this.el.pause.querySelectorAll('svg');
    if (pauseIcon) pauseIcon.toggleAttribute('hidden', paused); // SVG 沒有 .hidden 屬性
    if (playIcon) playIcon.toggleAttribute('hidden', !paused);
    this.el.pause.setAttribute('aria-label', paused ? '繼續' : '暫停');
    this.el.pause.disabled = !(name === 'playing' || paused);

    if (name === 'title' || name === 'results') this.clearPopups();
    if (name === 'playing' && prev !== 'paused') this._mmInit = false;
    if (name !== 'playing') for (const b of Object.values(this._touch)) b.classList.remove('down');
    if (name === 'paused' || name === 'results') {
      // 若先前焦點在已隱藏的元素上，交給主要按鈕（鍵盤可直接 Enter）
      const active = document.activeElement;
      if (active && active !== document.body && active.closest && active.closest('[hidden]')) active.blur();
    }
  }

  update(s) {
    if (!s) return;
    const el = this.el;

    if (s.time !== undefined) {
      const cs = Math.max(0, Math.floor(s.time * 100 + 1e-6));
      if (cs !== this._cs) { this._cs = cs; el.time.textContent = fmtCs(cs); }
    }
    if (s.score !== undefined) {
      const sc = Math.floor(s.score);
      if (sc !== this._score) { this._score = sc; el.score.textContent = formatInt(sc); }
    }
    if (s.speedKmh !== undefined) {
      const v = Math.max(0, Math.round(s.speedKmh));
      if (v !== this._speed) {
        this._speed = v;
        el.speed.textContent = String(v);
        this._drawGauge(v);
      }
    }
    if (s.boost !== undefined) {
      const b = s.boost < 0 ? 0 : s.boost > 1 ? 1 : s.boost;
      const q = Math.round(b * 200);
      if (q !== this._boostQ) {
        this._boostQ = q;
        el.boostFill.style.clipPath = 'inset(0 ' + (100 - q / 2) + '% 0 0)';
        el.boostBar.setAttribute('aria-valuenow', String(Math.round(q / 2)));
        const low = b < C.boostLow;
        if (low !== this._boostLow) { this._boostLow = low; el.boost.classList.toggle('low', low); }
      }
    }
    if (s.livesLeft !== undefined && s.livesLeft !== this._lives) {
      const prev = this._lives;
      this._lives = s.livesLeft;
      for (let i = 0; i < this._pips.length; i++) {
        const lost = i >= s.livesLeft;
        const cls = this._pips[i].classList;
        if (lost && !cls.contains('lost') && prev > i) {
          cls.remove('pop');
          void this._pips[i].getBoundingClientRect(); // 強制 reflow，讓 pop 動畫可重播
          cls.add('pop');
        }
        cls.toggle('lost', lost);
      }
      el.lives.setAttribute('aria-label', '剩餘機會：' + s.livesLeft);
    }
    if (s.combo !== undefined) {
      const c = Math.floor(s.combo);
      if (c !== this._combo) {
        this._combo = c;
        el.combo.hidden = c < 2;
        if (c >= 2) el.combo.textContent = '×' + c;
      }
    }
    if (s.distance !== undefined) {
      const d = Math.max(0, Math.floor(s.distance));
      if (d !== this._dist) { this._dist = d; el.distance.textContent = formatInt(d) + ' m'; }
    }
    if (s.minimap) {
      this._lastMinimap = s.minimap;
      const now = performance.now();
      if (now - this._mmLast >= C.minimapInterval * 1000 - 2) {
        this._mmLast = now;
        this._drawMinimap(s.minimap);
      }
    }
  }

  popup(text, kind = 'info') {
    const box = this.el.popups;
    const el = document.createElement('div');
    el.className = 'popup popup-' + (kind === 'good' || kind === 'bad' ? kind : 'info');
    el.style.setProperty('--popup-ms', Math.round(C.popupDuration * 1000) + 'ms');
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > C.maxPopups) box.firstElementChild.remove();
    setTimeout(() => el.remove(), C.popupDuration * 1000 + 50);
  }

  clearPopups() {
    this.el.popups.textContent = '';
  }

  showResults(r) {
    const el = this.el;
    el.resDistance.textContent = formatInt(Math.max(0, Math.floor(r.distance || 0)));
    el.resSpeed.textContent = String(Math.round(r.maxSpeedKmh || 0));
    el.resAir.textContent = (r.longestAir || 0).toFixed(2);
    el.resTime.textContent = formatTime(r.time || 0);
    el.resGates.textContent = (r.gates || 0) + ' / ' + (r.gatesTotal || 0);
    const score = Math.floor(r.score || 0);
    el.resScore.textContent = formatInt(score);
    const best = r.best;
    const isNew = best !== undefined && best !== null && score > 0 && score >= best;
    el.resBest.classList.toggle('new', isNew);
    if (best === undefined || best === null) el.resBest.textContent = '';
    else el.resBest.textContent = isNew ? '新紀錄！' : '最佳紀錄 ' + formatInt(best);
  }

  setMuted(b) {
    this.muted = !!b;
    const [on, off] = this.el.mute.querySelectorAll('svg');
    if (on) on.toggleAttribute('hidden', this.muted);
    if (off) off.toggleAttribute('hidden', !this.muted);
    this.el.mute.setAttribute('aria-pressed', String(this.muted));
    this.el.mute.setAttribute('aria-label', this.muted ? '開啟聲音' : '靜音');
  }

  get touchElements() {
    return this._touch;
  }

  // ---------- canvas ----------

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._dpr = dpr;
    const mm = this.el.minimap;
    const g = this.el.gauge;
    const mw = mm.clientWidth, mh = mm.clientHeight;
    if (mw && mh && (mw !== this._mmW || mh !== this._mmH || mm.width !== Math.round(mw * dpr))) {
      this._mmW = mw; this._mmH = mh;
      mm.width = Math.round(mw * dpr); mm.height = Math.round(mh * dpr);
      if (this._lastMinimap) this._drawMinimap(this._lastMinimap);
      else this._drawMinimap(null);
    }
    const gw = g.clientWidth, gh = g.clientHeight;
    if (gw && gh && (gw !== this._gW || gh !== this._gH || g.width !== Math.round(gw * dpr))) {
      this._gW = gw; this._gH = gh;
      g.width = Math.round(gw * dpr); g.height = Math.round(gh * dpr);
      this._drawGauge(Math.max(0, this._speed));
    }
  }

  _drawGauge(kmh) {
    const ctx = this._gCtx;
    const w = this._gW, h = this._gH;
    if (!ctx || !w || !h) return;
    const dpr = this._dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 弧：左（180°）→ 越過頂端 → 右下 30°
    const a0 = Math.PI, a1 = Math.PI * 2 + Math.PI / 6;
    const m = 2;
    const R = Math.min(w / 2 - m, (h - m * 2) / 1.5);
    const cx = w / 2, cy = m + R;
    const lw = R * 0.3;
    const rr = R - lw / 2;
    const n = C.gaugeSegments;
    const gap = 0.05;
    const frac = Math.min(1, Math.max(0, kmh / C.speedMaxKmh));
    const span = a1 - a0;

    ctx.lineCap = 'butt';
    ctx.lineWidth = lw;
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (span * i) / n + gap / 2;
      const t1 = a0 + (span * (i + 1)) / n - gap / 2;
      const lit = frac > 0 && i / n < frac;
      ctx.globalAlpha = lit ? 1 : 0.3;
      ctx.strokeStyle = this._gaugeColors[i];
      ctx.beginPath();
      ctx.arc(cx, cy, rr, t0, t1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 內圈細線
    ctx.lineWidth = Math.max(1, R * 0.035);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.6, a0, a1);
    ctx.stroke();

    // 指針
    const a = a0 + span * frac;
    const ca = Math.cos(a), sa = Math.sin(a);
    const len = R * 0.8;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(28,42,68,0.75)';
    ctx.lineWidth = R * 0.14;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + ca * len, cy + sa * len);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = R * 0.075;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + ca * len, cy + sa * len);
    ctx.stroke();
    // 軸心
    ctx.fillStyle = '#1c2a44';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawMinimap(mm) {
    const ctx = this._mmCtx;
    const w = this._mmW, h = this._mmH;
    if (!ctx || !w || !h) return;
    const dpr = this._dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const player = mm && mm.player;
    const px = player ? player.x : 0;
    const pz = player ? player.z : 0;
    const heading = player && player.heading ? player.heading : 0;
    const path = mm && mm.path;
    const gates = mm && mm.gates;
    const padX = 12, padTop = 9, padBot = 13;
    const baseY = h - padBot;

    // 依前方路徑範圍決定縮放（等比例，平滑）
    let ahead = C.minimapMinAhead, minDx = 0, maxDx = 0;
    const np = path ? path.length : 0;
    for (let i = 0; i < np; i++) {
      const pt = path[i];
      const f = pz - pt[1];
      if (f > C.minimapMaxAhead) continue;
      if (f > ahead) ahead = f;
      const dx = pt[0] - px;
      if (dx < minDx) minDx = dx;
      if (dx > maxDx) maxDx = dx;
    }
    const sV = (baseY - padTop) / ahead;
    const sH = (w - padX * 2) / Math.max(24, maxDx - minDx);
    const target = Math.min(sV * C.minimapLateralBoost, sH); // 側向比例（縱向固定 sV）
    const mid = (minDx + maxDx) / 2;
    if (np < 2) {
      // 沒有路徑資料：只畫玩家，不鎖定縮放
      this._mmScale = target; this._mmCx = mid; this._mmScaleV = sV;
    } else if (!this._mmInit) {
      this._mmInit = true; this._mmScale = target; this._mmCx = mid; this._mmScaleV = sV;
    } else {
      this._mmScale += (target - this._mmScale) * 0.12;
      this._mmCx += (mid - this._mmCx) * 0.12;
      this._mmScaleV += (sV - this._mmScaleV) * 0.12;
    }
    const sx = this._mmScale;
    const sc = this._mmScaleV;
    const ox = w / 2 - this._mmCx * sx;

    // 捲動的等高線（前進感）
    const grid = C.minimapGrid;
    const step = grid * sc;
    if (step > 12) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const f0 = ((pz % grid) + grid) % grid;
      for (let y = baseY - f0 * sc + step; y > 0; y -= step) {
        if (y < h) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
      }
      ctx.stroke();
    }

    if (np >= 2) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < np; i++) {
        const pt = path[i];
        const x = ox + (pt[0] - px) * sx;
        const y = baseY - (pz - pt[1]) * sc;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const lw = Math.max(5, Math.min(9, w * 0.045));
      ctx.strokeStyle = 'rgba(92,128,170,0.55)';
      ctx.lineWidth = lw + 3.5;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    const ng = gates ? gates.length : 0;
    if (ng) {
      ctx.strokeStyle = '#e8394a';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < ng; i++) {
        const g = gates[i];
        const y = baseY - (pz - g.z) * sc;
        if (y < -4 || y > h + 4) continue;
        const x = ox + (g.x - px) * sx;
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
      }
      ctx.stroke();
    }

    // 玩家：黃色圓底 + 紅色箭頭（前進 = 上）
    const x = ox;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#ffc93c';
    ctx.strokeStyle = '#1c2a44';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 側向被放大 sx/sc 倍 → 箭頭角度也要套同樣的非等比變換，才會和畫出來的路線方向一致
    ctx.rotate(Math.atan2(Math.sin(heading) * sx, Math.cos(heading) * sc));
    // 實心細長三角（頂角約 35°）：舊的凹口箭頭兩翼離圓心 5.9 > 箭尖 5.6，小尺寸下方向容易看反
    ctx.fillStyle = '#e8394a';
    ctx.beginPath();
    ctx.moveTo(0, -7.2);
    ctx.lineTo(3.7, 4.4);
    ctx.lineTo(-3.7, 4.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(28,42,68,0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
}
