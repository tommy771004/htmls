// 輸入整合：鍵盤、Gamepad、旋轉方向盤（Pointer Lock + movementX）、觸控按鈕 → {steer, throttle, brake, nitro}
// 每幀呼叫 poll(dt)（選單畫面也要呼叫，手把的選單事件在 poll 裡產生；超過 200 ms 沒呼叫時內部自己補輪詢）。
import { KEY_ACTION, KEY_MENU, PREVENT, rampSteer, isTextTarget, combine } from './keyboard.js';
import { createPadTracker } from './gamepad.js';
import { createSpinnerFilter } from './spinner.js';
import { loadSettings, saveSettings, sanitize } from './settings.js';
import { createTouch } from './touch.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createInput({ canvas = null, touchRoot = null } = {}) {
  const hasWin = typeof window !== 'undefined';
  const doc = hasWin ? window.document : null;
  let cfg = loadSettings();

  // 旋轉方向盤設定的即時視圖（和 settings() 同一份資料）
  const spinSettings = {
    get mode() { return cfg.spinnerMode; },
    set mode(v) { setSettings({ spinnerMode: v }); },
    get sensitivity() { return cfg.spinnerSensitivity; },
    set sensitivity(v) { setSettings({ spinnerSensitivity: v }); },
    get invert() { return cfg.spinnerInvert; },
    set invert(v) { setSettings({ spinnerInvert: !!v }); },
    get noLock() { return cfg.spinnerNoLock; },
    set noLock(v) { setSettings({ spinnerNoLock: !!v }); },
  };
  const filter = createSpinnerFilter(() => spinSettings);

  const keys = new Set();
  let kbSteer = 0, touchSteer = 0;
  let src = 'keyboard';
  let lastSpinAt = -1e9;
  let lastPoll = 0;
  const menuFns = new Set();
  const pads = createPadTracker();
  let padIds = [];
  let lastPad = null;
  let locked = false;
  let racing = false; // 由 app 設定：只有比賽畫面點畫布才自動鎖定
  const lockFns = new Set();
  let lastMouseX = null;
  const off = [];

  const on = (target, type, fn, opts) => {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, fn, opts);
    off.push(() => target.removeEventListener(type, fn, opts));
  };

  function emitMenu(name, source) {
    for (const fn of menuFns) {
      try { fn(name, { source }); } catch (err) { if (hasWin) setTimeout(() => { throw err; }); }
    }
  }

  // ── 鍵盤 ──
  on(hasWin ? window : null, 'keydown', (e) => {
    if (isTextTarget(e.target)) return;
    const code = e.code;
    if (KEY_ACTION[code]) {
      keys.add(code);
      src = 'keyboard';
      // 同一格內按下又放開的氮氣鍵：鎖存到下一次 poll，快速點按不會漏
      if (KEY_ACTION[code] === 'nitro' && !e.repeat) nitroTap = true;
    }
    // 焦點在原生按鈕等控制項上時不擋（空白鍵要能按按鈕、方向鍵要能捲動設定面板）
    if (PREVENT.has(code) && gameFocus()) e.preventDefault();
    const m = KEY_MENU[code];
    // 按住不放的自動連發只用在方向導覽；確認／返回／暫停連發會讓暫停畫面閃開又關、存檔確認被連按通過、車庫連續購買
    if (m && !(e.repeat && (m === 'confirm' || m === 'back' || m === 'menu'))) emitMenu(m, 'keyboard');
  });
  on(hasWin ? window : null, 'keyup', (e) => { keys.delete(e.code); });
  on(hasWin ? window : null, 'blur', () => { keys.clear(); if (touch) touch.release && touch.release(); });

  function gameFocus() {
    const a = doc && doc.activeElement;
    return !a || a === doc.body || a === doc.documentElement || a === canvas;
  }

  let nitroTap = false;
  function keyboardState(dt) {
    let dir = 0, thr = 0, brk = 0, nit = nitroTap;
    nitroTap = false;
    for (const c of keys) {
      const a = KEY_ACTION[c];
      if (a === 'left') dir -= 1;
      else if (a === 'right') dir += 1;
      else if (a === 'throttle') thr = 1;
      else if (a === 'brake') brk = 1;
      else if (a === 'nitro') nit = true;
    }
    dir = Math.sign(dir);
    kbSteer = rampSteer(kbSteer, dir, dt);
    return { steer: kbSteer, throttle: thr, brake: brk, nitro: nit };
  }

  // ── 觸控 ──
  const touch = createTouch(touchRoot, { onActivity: () => { src = 'touch'; } });
  function applyTouchMode() {
    let vis = cfg.touch === 'on';
    if (cfg.touch === 'auto' && hasWin) {
      try { vis = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || touchSeen; } catch { vis = touchSeen; }
    }
    touch.setVisible(vis);
  }
  let touchSeen = false;
  on(hasWin ? window : null, 'touchstart', () => {
    if (!touchSeen) { touchSeen = true; applyTouchMode(); }
  }, { passive: true });
  applyTouchMode();

  function touchState(dt) {
    const s = touch.state();
    const dir = (s.r ? 1 : 0) - (s.l ? 1 : 0);
    touchSteer = rampSteer(touchSteer, dir, dt);
    return { steer: touchSteer, throttle: s.t ? 1 : 0, brake: s.b ? 1 : 0, nitro: s.n };
  }

  // ── 旋轉方向盤 ──
  function feed(dx) {
    if (!Number.isFinite(dx) || dx === 0) return;
    filter.feed(dx);
    lastSpinAt = now();
    src = 'spinner';
  }
  function lockElement() { return doc ? doc.pointerLockElement : null; }
  function lock() {
    if (!canvas || !canvas.requestPointerLock) return Promise.resolve(false);
    const plain = () => {
      try {
        const r = canvas.requestPointerLock();
        return r && typeof r.then === 'function' ? r.then(() => true, () => false) : Promise.resolve(true);
      } catch { return Promise.resolve(false); }
    };
    try {
      // unadjustedMovement：關掉 OS 滑鼠加速，編碼器計數才線性；不支援就退回一般鎖定
      const r = canvas.requestPointerLock({ unadjustedMovement: true });
      if (r && typeof r.then === 'function') return r.then(() => true, () => plain());
      return Promise.resolve(true);
    } catch {
      return plain();
    }
  }
  function unlock() {
    try { if (doc && lockElement() === canvas && doc.exitPointerLock) doc.exitPointerLock(); } catch { /* 忽略 */ }
  }
  on(doc, 'pointerlockchange', () => {
    const was = locked;
    locked = !!canvas && lockElement() === canvas;
    filter.reset();
    lastMouseX = null;
    if (was !== locked) {
      for (const fn of lockFns) {
        try { fn(locked); } catch (err) { if (hasWin) setTimeout(() => { throw err; }); }
      }
    }
  });
  on(doc, 'pointerlockerror', () => { locked = false; });
  on(doc, 'mousemove', (e) => {
    if (locked) { feed(e.movementX || 0); return; }
    if (!cfg.spinnerNoLock || !canvas) return;
    // 以畫布範圍判斷（上層有 HUD 疊著也算在畫布上）
    let inside = e.target === canvas;
    if (!inside && canvas.getBoundingClientRect) {
      const r = canvas.getBoundingClientRect();
      inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    if (!inside) { lastMouseX = null; return; }
    let dx = e.movementX;
    if (!Number.isFinite(dx) || (dx === 0 && lastMouseX != null)) dx = lastMouseX == null ? 0 : e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    feed(dx);
  });
  on(canvas, 'mouseleave', () => { lastMouseX = null; });
  // 比賽中點畫布：開了「點畫面鎖定」就進入 Pointer Lock（在設定頁鎖定過一次會自動打開）。
  // 比賽以外（設定頁校正時）已鎖定的話，點一下就解除，滑鼠才點得到按鈕。
  on(canvas, 'pointerdown', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (locked) { if (!racing) unlock(); return; }
    if (racing && cfg.spinnerAutoLock) lock();
  });

  // ── 手把 ──
  function readPads() {
    try {
      if (!hasWin || !navigator.getGamepads) return [];
      return navigator.getGamepads() || [];
    } catch { return []; }
  }
  function refreshIds() {
    padIds = Array.from(readPads()).filter(Boolean).map((p) => p.id);
  }
  on(hasWin ? window : null, 'gamepadconnected', refreshIds);
  on(hasWin ? window : null, 'gamepaddisconnected', () => { refreshIds(); lastPad = null; });

  function padPoll(dt) {
    const r = pads.update(readPads(), dt, cfg.padDeadzone);
    for (const m of r.menu) emitMenu(m, 'gamepad');
    if (r.active) src = 'gamepad';
    lastPad = r.input;
    return r.input;
  }

  // 沒人呼叫 poll 時（例如選單畫面只靠事件），用 rAF 補輪詢手把的選單事件
  let raf = 0, rafPrev = 0;
  if (hasWin && window.requestAnimationFrame) {
    const tick = (t) => {
      raf = window.requestAnimationFrame(tick);
      const dt = rafPrev ? Math.min(0.1, (t - rafPrev) / 1000) : 0;
      rafPrev = t;
      if (now() - lastPoll > 200) padPoll(dt);
    };
    raf = window.requestAnimationFrame(tick);
  }

  let lastOut = { steer: 0, throttle: 0, brake: 0, nitro: false };
  function poll(dt) {
    dt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    lastPoll = now();
    const kb = keyboardState(dt);
    const tc = touchState(dt);
    const gp = padPoll(dt);
    const sp = filter.poll(dt);
    lastOut = combine([kb, tc, gp, { steer: sp }]);
    return lastOut;
  }

  function settings() { return { ...cfg }; }
  function setSettings(obj) {
    const prevMode = cfg.spinnerMode;
    cfg = sanitize({ ...cfg, ...obj }, cfg);
    if (cfg.spinnerMode !== prevMode) filter.reset();
    saveSettings(cfg);
    applyTouchMode();
    return settings();
  }

  const spinner = {
    feed,
    lock,
    unlock,
    isLocked: () => locked,
    // fn(locked)：Pointer Lock 取得／失去時呼叫（瀏覽器按 Esc、切視窗也會失去）
    onLockChange(fn) {
      if (typeof fn !== 'function') return () => {};
      lockFns.add(fn);
      return () => lockFns.delete(fn);
    },
    settings: spinSettings,
    value: () => filter.value(),
    // 最近 0.3 秒內有轉動（設定頁的即時指示用）
    active: () => now() - lastSpinAt < 300,
  };

  return {
    poll,
    last: () => lastOut,
    source: () => src,
    spinner,
    gamepads() { refreshIds(); return padIds.slice(); },
    gamepad: () => lastPad,
    settings,
    setSettings,
    touch: { visible: () => touch.visible(), setVisible: (v) => touch.setVisible(v) },
    onMenu(fn) {
      if (typeof fn !== 'function') return () => {};
      menuFns.add(fn);
      return () => menuFns.delete(fn);
    },
    setRacing(v) { racing = !!v; },
    // 清掉按住的按鍵（切畫面時避免卡鍵）
    clear() { keys.clear(); nitroTap = false; kbSteer = 0; touchSteer = 0; filter.reset(); if (touch.release) touch.release(); },
    destroy() {
      unlock();
      for (const f of off.splice(0)) f();
      if (raf && hasWin) window.cancelAnimationFrame(raf);
      menuFns.clear();
      lockFns.clear();
      touch.destroy();
    },
  };
}
