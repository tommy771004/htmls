// 輸入：鍵盤、滑鼠（Pointer Lock）、手把（標準映射）、觸控（#touch 浮動搖桿＋拖曳視角＋按鈕）。按鍵預設見 config.js KEYS。
import { KEYS } from './config.js';
import { clamp } from './shared.js';

const has = (set, list) => list.some((k) => set.has(k));

// 觸控按鈕圖示（24×24 線稿，currentColor）
const IC = {
  fire: '<path d="M8 21V10l4-7 4 7v11z"/><path d="M8 16h8"/>',
  ads: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  jump: '<path d="M5 12l7-7 7 7M5 20l7-7 7 7"/>',
  crouch: '<path d="M6 7l6 6 6-6M6 17h12"/>',
  reload: '<path d="M20 12a8 8 0 1 1-2.7-6"/><path d="M20 3.5V9h-5.5"/>',
  build: '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="8" height="5" rx="1"/><rect x="13" y="11" width="8" height="5" rx="1"/><rect x="3" y="18" width="18" height="3" rx="1"/>',
  wall: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M6 9h12M6 15h12M12 3v6M9 9v6M15 9v6"/>',
  floor: '<path d="M2.5 14.5L12 9l9.5 5.5L12 20z"/><path d="M7 12l9.5 5.5"/>',
  ramp: '<path d="M3 19h18V6z"/><path d="M8 19l7-6.5M13 19l5-4.5"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  place: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  mat: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
};

const CSS = `
#touch{--tc-bg:rgba(14,26,66,.5);--tc-ring:rgba(255,255,255,.62);--tc-hi:#ffe14d;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
#touch .tc-btn{position:absolute;width:var(--s,48px);height:var(--s,48px);margin:0;padding:0;border:0;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;
  background:radial-gradient(circle at 50% 30%,rgba(60,90,170,.62),var(--tc-bg) 70%);box-shadow:inset 0 0 0 2px var(--tc-ring),0 3px 8px rgba(0,0,0,.28);pointer-events:auto;touch-action:none;
  transition:transform .09s cubic-bezier(.2,.8,.2,1),background .09s;font:900 20px/1 Anton,"Arial Narrow","PingFang TC",sans-serif;z-index:2}
#touch .tc-btn svg{width:56%;height:56%;fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45));pointer-events:none}
#touch .tc-btn.on{transform:scale(.9);background:radial-gradient(circle at 50% 30%,#fff3a0,var(--tc-hi) 75%);color:#14214a;box-shadow:inset 0 0 0 2px #fff,0 0 14px rgba(255,225,77,.6)}
#touch .tc-btn.tog{box-shadow:inset 0 0 0 3px var(--tc-hi),0 3px 8px rgba(0,0,0,.28);color:var(--tc-hi)}
#touch .tc-fire{--s:82px;right:calc(var(--safe-r,0px) + 14px);bottom:calc(var(--safe-b,0px) + 104px);background:radial-gradient(circle at 50% 30%,#ff8a7a,#e53a52 72%);box-shadow:inset 0 0 0 3px rgba(255,255,255,.75),0 4px 12px rgba(0,0,0,.35)}
#touch .tc-fire.on{background:radial-gradient(circle at 50% 30%,#fff3a0,#ffc93d 75%)}
#touch .tc-jump{--s:60px;right:calc(var(--safe-r,0px) + 104px);bottom:calc(var(--safe-b,0px) + 98px)}
#touch .tc-ads{--s:54px;right:calc(var(--safe-r,0px) + 24px);bottom:calc(var(--safe-b,0px) + 198px)}
#touch .tc-crouch{--s:48px;right:calc(var(--safe-r,0px) + 100px);bottom:calc(var(--safe-b,0px) + 166px)}
#touch .tc-reload{--s:48px;right:calc(var(--safe-r,0px) + 170px);bottom:calc(var(--safe-b,0px) + 128px)}
#touch .tc-use{--s:58px;right:calc(var(--safe-r,0px) + 170px);bottom:calc(var(--safe-b,0px) + 194px);display:none;color:#14214a;background:radial-gradient(circle at 50% 30%,#fff3a0,var(--tc-hi) 75%);animation:tcPulse 1s ease-in-out infinite}
#touch .tc-use.show{display:flex}
#touch .tc-map{--s:44px;right:calc(var(--safe-r,0px) + 12px);top:calc(var(--safe-t,0px) + 150px)}
#touch .tc-build{--s:50px;left:calc(var(--safe-l,0px) + 16px);bottom:calc(var(--safe-b,0px) + 296px)}
#touch .tc-p{--s:46px;left:calc(var(--safe-l,0px) + 62px);display:none}
#touch .tc-wall{bottom:calc(var(--safe-b,0px) + 356px)}#touch .tc-floor{bottom:calc(var(--safe-b,0px) + 410px)}#touch .tc-ramp{bottom:calc(var(--safe-b,0px) + 464px)}
#touch.building .tc-p{display:flex}
#touch .tc-btn .ib{display:none;width:100%;height:100%;align-items:center;justify-content:center}
#touch .tc-btn .ia{display:flex;width:100%;height:100%;align-items:center;justify-content:center}
#touch.building .tc-fire .ia,#touch.building .tc-reload .ia{display:none}#touch.building .tc-fire .ib,#touch.building .tc-reload .ib{display:flex}
#touch.building .tc-ads{opacity:.35}
#touch .tc-joybase{position:absolute;left:calc(var(--safe-l,0px) + 22px);bottom:calc(var(--safe-b,0px) + 104px);width:124px;height:124px;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(255,255,255,.06),rgba(14,26,66,.32) 72%);box-shadow:inset 0 0 0 2px rgba(255,255,255,.4);opacity:.55;transition:opacity .18s}
#touch .tc-joybase.act{opacity:1;box-shadow:inset 0 0 0 3px rgba(255,255,255,.75)}
#touch .tc-joybase.run{box-shadow:inset 0 0 0 3px var(--tc-hi),0 0 18px rgba(255,225,77,.4)}
#touch .tc-knob{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle at 50% 30%,#fff,#cfd9ee 80%);box-shadow:0 2px 8px rgba(0,0,0,.4);will-change:transform}
@keyframes tcPulse{50%{transform:scale(1.08)}}
@media (max-height:520px){
 #touch .tc-fire{--s:76px;bottom:calc(var(--safe-b,0px) + 40px)}#touch .tc-jump{--s:56px;bottom:calc(var(--safe-b,0px) + 34px);right:calc(var(--safe-r,0px) + 108px)}
 #touch .tc-ads{bottom:calc(var(--safe-b,0px) + 128px);right:calc(var(--safe-r,0px) + 30px)}#touch .tc-crouch{bottom:calc(var(--safe-b,0px) + 108px);right:calc(var(--safe-r,0px) + 108px)}
 #touch .tc-reload{bottom:calc(var(--safe-b,0px) + 62px);right:calc(var(--safe-r,0px) + 176px)}#touch .tc-use{bottom:calc(var(--safe-b,0px) + 120px);right:calc(var(--safe-r,0px) + 176px)}
 #touch .tc-joybase{bottom:calc(var(--safe-b,0px) + 36px)}#touch .tc-build{bottom:calc(var(--safe-b,0px) + 170px)}
 #touch .tc-p{left:calc(var(--safe-l,0px) + 80px);--s:44px}#touch .tc-wall{bottom:calc(var(--safe-b,0px) + 170px)}#touch .tc-floor{bottom:calc(var(--safe-b,0px) + 170px);left:calc(var(--safe-l,0px) + 130px)}#touch .tc-ramp{bottom:calc(var(--safe-b,0px) + 170px);left:calc(var(--safe-l,0px) + 180px)}
 #touch .tc-map{top:calc(var(--safe-t,0px) + 12px);right:calc(var(--safe-r,0px) + 190px)}
}
@media (prefers-reduced-motion:reduce){#touch .tc-use{animation:none}}
`;

export class Input {
  constructor(ctx) {
    this.ctx = ctx; this.keys = new Set(); this.e = {}; this.mouse = { l: false, r: false };
    this.dx = 0; this.dy = 0; this.wheel = 0; this.locked = false; this.script = null;
    this.device = 'kbm'; // 最後使用的裝置：'kbm' | 'touch' | 'pad'
    this.t = { mx: 0, mz: 0, fire: false, ads: false, crouch: false, sprint: false, interact: false };
    this.s = { moveX: 0, moveZ: 0, sprint: false, crouch: false, jump: false, fire: false, ads: false, reload: false, interact: false, slot: -1, buildToggle: false, piece: null, cycle: false, map: false, pause: false, lookX: 0, lookY: 0, wheel: 0 };
    this.pad = { on: false, prev: [], xHold: 0, sprint: false };
    this.touchMode = false;
    const canvas = () => ctx.renderer.domElement;
    addEventListener('keydown', (ev) => {
      if (ev.target && /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.repeat) { if (ev.code !== 'Tab') ev.preventDefault(); return; }
      this.keys.add(ev.code); this.device = 'kbm';
      const c = ev.code, E = this.e;
      if (KEYS.jump.includes(c)) E.jump = true;
      if (KEYS.reload.includes(c)) E.reload = true;
      if (KEYS.buildToggle.includes(c)) E.buildToggle = true;
      if (KEYS.wall.includes(c)) E.piece = 'wall'; if (KEYS.floor.includes(c)) E.piece = 'floor'; if (KEYS.ramp.includes(c)) E.piece = 'ramp';
      if (KEYS.map.includes(c)) E.map = true;
      if (KEYS.pause.includes(c)) E.pause = true;
      const si = KEYS.slots.indexOf(c); if (si >= 0) E.slot = si;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(c) || ev.ctrlKey) ev.preventDefault();
    });
    addEventListener('keyup', (ev) => this.keys.delete(ev.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
    addEventListener('mousedown', (ev) => {
      if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return; // 觸控合成的滑鼠事件
      if (ev.target !== canvas() && !this.locked) return;
      this.device = 'kbm';
      if (!this.locked && this.canLock()) { this.lock(); return; }
      if (ev.button === 0) this.mouse.l = true; if (ev.button === 2) this.mouse.r = true;
    });
    addEventListener('mouseup', (ev) => { if (ev.button === 0) this.mouse.l = false; if (ev.button === 2) this.mouse.r = false; });
    addEventListener('mousemove', (ev) => { if (this.locked) { this.dx += ev.movementX || 0; this.dy += ev.movementY || 0; } });
    addEventListener('wheel', (ev) => { if (this.locked) this.wheel += Math.sign(ev.deltaY); }, { passive: true });
    addEventListener('contextmenu', (ev) => { if (ev.target === canvas() || this.locked) ev.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === canvas();
      if (was && !this.locked) { this.mouse.l = this.mouse.r = false; ctx.events.emit('unlock', {}); }
    });
    this.buildTouch();
  }
  canLock() { const m = this.ctx.match; return !this.touchMode && !this.ctx.paused && m && (m.state === 'bus' || m.state === 'playing' || m.state === 'ended') && !this.ctx.hud?.mapOpen; }
  lock() { try { const p = this.ctx.renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 無頭或被拒 */ } }
  unlock() { try { document.exitPointerLock(); } catch (e) { /* 忽略 */ } }

  // ---- 觸控 ----
  buildTouch() {
    const root = document.getElementById('touch'); if (!root) return;
    this.touchRoot = root;
    this.touchMode = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const st = document.createElement('style'); st.id = 'tc-css'; st.textContent = CSS; document.head.appendChild(st);
    const buzz = (n = 8) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) { /* 忽略 */ } };
    const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
    const mk = (cls, parent = root) => { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; };
    // 浮動搖桿：左側 42% 螢幕任何地方按下，底座出現在手指處
    const base = mk('tc-joybase'), knob = mk('tc-knob', base);
    const canvas = this.ctx.renderer.domElement;
    let jid = null, lid = null, lx = 0, ly = 0, jcx = 0, jcy = 0;
    const R = 56;
    const rect = () => root.getBoundingClientRect();
    const joyMove = (e) => {
      let x = (e.clientX - jcx) / R, y = (e.clientY - jcy) / R; const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      const dz = 0.1, m = Math.hypot(x, y), k = m < dz ? 0 : (m - dz) / (1 - dz) / (m || 1);
      this.t.mx = x * k; this.t.mz = -y * k; this.t.sprint = m > 0.92 && y < -0.35;
      knob.style.transform = `translate(${x * R * 0.7}px,${y * R * 0.7}px)`;
      base.classList.toggle('run', this.t.sprint);
    };
    const joyEnd = () => { jid = null; this.t.mx = this.t.mz = 0; this.t.sprint = false; knob.style.transform = ''; base.classList.remove('act', 'run'); base.style.left = base.style.top = base.style.bottom = ''; };
    const look = (e, g = 1.6) => {
      const ddx = e.clientX - lx, ddy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      const gain = g * (1 + Math.min(0.7, Math.hypot(ddx, ddy) / 45)); // 快速甩動稍微加速
      this.dx += ddx * gain; this.dy += ddy * gain;
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.device = 'touch'; this.touchMode = true;
      const r = rect(), left = e.clientX - r.left < r.width * 0.42;
      try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* 忽略 */ }
      if (left && jid === null) {
        jid = e.pointerId; const half = 62, sl = parseFloat(getComputedStyle(root).getPropertyValue('--safe-l')) || 0;
        jcx = clamp(e.clientX, r.left + half + 8 + sl, r.left + r.width * 0.42 - half * 0.4); jcy = clamp(e.clientY, r.top + r.height * 0.3, r.bottom - half - 70);
        base.style.left = jcx - r.left - half + 'px'; base.style.top = jcy - r.top - half + 'px'; base.style.bottom = 'auto'; base.classList.add('act');
        joyMove(e);
      } else if (!left && lid === null) { lid = e.pointerId; lx = e.clientX; ly = e.clientY; }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => { if (e.pointerId === jid) joyMove(e); else if (e.pointerId === lid) look(e); });
    const up = (e) => { if (e.pointerId === jid) joyEnd(); else if (e.pointerId === lid) lid = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);

    const btn = (cls, ic, label, o = {}) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-btn ' + cls; b.setAttribute('aria-label', label);
      b.innerHTML = o.text ? `<span class="ia">${o.text}</span>` : `<span class="ia">${svg(ic)}</span>` + (o.alt ? `<span class="ib">${svg(o.alt)}</span>` : '');
      root.appendChild(b);
      let pid = null;
      b.addEventListener('pointerdown', (e) => { this.device = 'touch'; pid = e.pointerId; try { b.setPointerCapture(pid); } catch (er) { /* 忽略 */ } b.classList.add('on'); o.down && o.down(e); if (o.vib !== false) buzz(); lx = e.clientX; ly = e.clientY; e.preventDefault(); e.stopPropagation(); });
      b.addEventListener('pointermove', (e) => { if (e.pointerId === pid && o.drag) look(e, 1.5); });
      const u = (e) => { if (pid === null) return; pid = null; b.classList.remove('on'); o.up && o.up(e); };
      b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    btn('tc-fire', 'fire', '開火', { alt: 'place', drag: true, down: () => (this.t.fire = true), up: () => (this.t.fire = false), vib: false });
    this.adsBtn = btn('tc-ads', 'ads', '瞄準', { down: () => { this.t.ads = !this.t.ads; this.adsBtn.classList.toggle('tog', this.t.ads); } });
    btn('tc-jump', 'jump', '跳', { down: () => (this.e.jump = true) });
    this.crouchBtn = btn('tc-crouch', 'crouch', '蹲', { down: () => { this.t.crouch = !this.t.crouch; this.crouchBtn.classList.toggle('tog', this.t.crouch); } });
    btn('tc-reload', 'reload', '換彈／換建材', { alt: 'mat', down: () => (this.e.reload = true) });
    this.useBtn = btn('tc-use', '', '互動', { text: 'E', down: () => (this.t.interact = true), up: () => (this.t.interact = false) });
    this.buildBtn = btn('tc-build', 'build', '建造模式', { down: () => (this.e.buildToggle = true) });
    btn('tc-p tc-wall', 'wall', '牆', { down: () => (this.e.piece = 'wall') });
    btn('tc-p tc-floor', 'floor', '地板', { down: () => (this.e.piece = 'floor') });
    btn('tc-p tc-ramp', 'ramp', '斜坡', { down: () => (this.e.piece = 'ramp') });
    btn('tc-map', 'map', '地圖', { down: () => (this.e.map = true) });
    this._promptEl = document.getElementById('prompt');
  }
  setTouchVisible(v) { if (this.touchRoot) this.touchRoot.classList.toggle('show', v && (this.touchMode || innerWidth <= 820)); }
  // 依遊戲狀態更新觸控按鈕外觀（建造模式、互動提示、切換鈕）
  updateTouch() {
    const root = this.touchRoot; if (!root || !root.classList.contains('show')) return;
    const p = this.ctx.player, b = !!(p && p.building);
    if (b !== this._tb) { this._tb = b; root.classList.toggle('building', b); this.buildBtn.classList.toggle('tog', b); }
    const u = !!(this._promptEl && !this._promptEl.hidden);
    if (u !== this._tu) { this._tu = u; this.useBtn.classList.toggle('show', u); if (!u) this.t.interact = false; }
    if (this.t.ads && p && !p.alive) { this.t.ads = false; this.adsBtn.classList.remove('tog'); }
  }

  // ---- 手把（標準映射）----
  // 左搖桿移動、右搖桿視角、RT 開火、LT 瞄準、A 跳、B 蹲、X 點按換彈／按住互動、Y 下一格、LB/RB 切格、十字鍵 牆/地板/斜坡/換建材、R3 建造、L3 衝刺、Start 暫停、Back 地圖
  readPad() {
    const P = this.pad; let gp = null;
    try { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of l) if (g && g.connected) { gp = g; break; } } catch (e) { /* 忽略 */ }
    if (!gp) { P.on = false; return null; }
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), v = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
    const stick = (x, y) => { const m = Math.hypot(x, y); if (m < 0.16) return [0, 0]; const k = Math.min(1, (m - 0.16) / 0.84) / m; return [x * k, y * k]; };
    const [lx, ly] = stick(gp.axes[0] || 0, gp.axes[1] || 0), [rx, ry] = stick(gp.axes[2] || 0, gp.axes[3] || 0);
    const cur = []; for (let i = 0; i < 17; i++) cur[i] = b(i);
    const edge = (i) => cur[i] && !P.prev[i];
    let act = lx || ly || rx || ry || cur.some(Boolean); if (act) { this.device = 'pad'; }
    // X：按住 > 0.3 s 視為互動，短按放開＝換彈
    let interact = false;
    if (cur[2]) { P.xHold += 1 / 60; interact = P.xHold > 0.3; } else { if (P.prev[2] && P.xHold <= 0.3) this.e.reload = true; P.xHold = 0; }
    if (edge(0)) this.e.jump = true;
    if (edge(3)) this.wheel += 1;
    if (edge(4)) this.wheel -= 1;
    if (edge(5)) this.wheel += 1;
    if (edge(12)) this.e.piece = 'wall'; if (edge(14)) this.e.piece = 'floor'; if (edge(15)) this.e.piece = 'ramp'; if (edge(13)) this.e.reload = true;
    if (edge(11)) this.e.buildToggle = true;
    if (edge(10)) P.sprint = !P.sprint;
    if (edge(9)) this.e.pause = true;
    if (edge(8)) this.e.map = true;
    P.prev = cur; P.on = true;
    const mag = Math.hypot(rx, ry), rate = Math.pow(mag, 1.7) * 1050 / 60; // 像素當量／步
    return { mx: lx, mz: -ly, lookX: mag ? rx / mag * rate : 0, lookY: mag ? ry / mag * rate : 0, fire: v(7) > 0.35, ads: v(6) > 0.35, crouch: cur[1], interact, sprint: P.sprint && (lx || ly) !== 0 };
  }

  // ---- 輪詢（每個固定步呼叫一次）----
  poll() {
    const s = this.s, k = this.keys, E = this.e, t = this.t;
    const g = this.readPad();
    const mx = (has(k, KEYS.right) ? 1 : 0) - (has(k, KEYS.left) ? 1 : 0) + t.mx + (g ? g.mx : 0);
    const mz = (has(k, KEYS.forward) ? 1 : 0) - (has(k, KEYS.back) ? 1 : 0) + t.mz + (g ? g.mz : 0);
    s.moveX = clamp(mx, -1, 1); s.moveZ = clamp(mz, -1, 1);
    s.sprint = has(k, KEYS.sprint) || t.sprint || !!(g && g.sprint); s.crouch = has(k, KEYS.crouch) || t.crouch || !!(g && g.crouch);
    s.fire = this.mouse.l || t.fire || !!(g && g.fire); s.ads = this.mouse.r || t.ads || !!(g && g.ads);
    s.interact = has(k, KEYS.interact) || t.interact || !!(g && g.interact);
    s.jump = !!E.jump; s.reload = !!E.reload; s.buildToggle = !!E.buildToggle; s.piece = E.piece || null; s.map = !!E.map; s.pause = !!E.pause;
    s.slot = E.slot === undefined ? -1 : E.slot; s.cycle = !!E.reload;
    s.lookX = this.dx + (g ? g.lookX : 0); s.lookY = this.dy + (g ? g.lookY : 0); s.wheel = this.wheel;
    this.e = {}; this.dx = this.dy = this.wheel = 0;
    this.updateTouch();
    if (this.script) Object.assign(s, this.script);
    return s;
  }
}
