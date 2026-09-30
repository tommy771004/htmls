// SIDEWINDER：啟動（分段載入）、畫面流程、固定步長迴圈、巡迴賽與商店、window.__sw 測試 API、window.Sidewinder 掛點。
import './style.css';
import { loadAssets } from './assets.js';
import { loadCore } from './core.js';
import { parseTrack, parseMeshes } from './track.js';
import { createRenderer } from './render/index.js';
import { createInput } from './input/index.js';
import { createAudio } from './audio/index.js';

import { PHASE, COLORS, RIVALS, UPGRADES } from './game/consts.js';
import { header, trucks as readTrucks } from './game/state.js';
import { createCareer, rivalsFor, LAPS } from './game/career.js';
import { createRace } from './game/race.js';

import { h } from './ui/dom.js';
import { wordmark, plywoodTexture } from './ui/art.js';
import { createNav } from './ui/nav.js';
import { computeLayout, applyLayout } from './ui/layout.js';
import { createHud } from './ui/hud.js';
import { titleScreen, practiceScreen } from './ui/title.js';
import { introScreen } from './ui/intro.js';
import { resultsScreen } from './ui/results.js';
import { garageScreen } from './ui/garage.js';
import { settingsScreen } from './ui/settings.js';
import { pauseScreen } from './ui/pause.js';

const $ = (sel) => document.querySelector(sel);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const ZERO = { steer: 0, throttle: 0, brake: 0, nitro: false };

// ---------- 對外掛點：一載入就有 window.Sidewinder（含 ready Promise），開機完成後補上 audio／input ----------
// 用法：await Sidewinder.ready（或監聽 window 的 'sidewinder:ready' 事件）後再用 Sidewinder.audio。
let resolveReady;
const readyPromise = new Promise((r) => { resolveReady = r; });
window.Sidewinder = Object.assign(window.Sidewinder || {}, { version: '195.1', ready: readyPromise });

// ---------- 網址參數 ----------
function readParams() {
  let q;
  try { q = new URLSearchParams(location.search); } catch (e) { q = new URLSearchParams(''); }
  const int = (k) => {
    const v = q.get(k);
    if (v === null || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  return { track: int('track'), seed: int('seed'), mute: q.get('mute') === '1', debug: q.get('debug') === '1' };
}

// ---------- 載入畫面 ----------
const STAGES = ['解壓資產', '編譯核心', '解析賽道', '準備畫面'];

function loadingUI() {
  const root = $('#loading');
  const mark = root && root.querySelector('.ld-mark');
  if (mark) mark.innerHTML = wordmark('lw', { tracks: false });
  const list = root && root.querySelector('.ld-steps');
  if (list) {
    list.innerHTML = STAGES.map((s) => `<li><i aria-hidden="true"></i><span>${s}</span></li>`).join('');
  }
  return {
    stage(i) {
      if (!list) return;
      [...list.children].forEach((li, k) => {
        li.classList.toggle('done', k < i);
        li.classList.toggle('now', k === i);
      });
      const bar = root.querySelector('.ld-bar i');
      if (bar) bar.style.width = ((i / STAGES.length) * 100).toFixed(0) + '%';
      root.setAttribute('aria-valuenow', String(i));
    },
    done() { if (root) root.remove(); },
    error(title, msg) {
      if (!root) return;
      root.classList.add('err');
      const card = root.querySelector('.ld-card');
      if (card) {
        card.innerHTML = '';
        card.append(h('h2', null, title), h('p', null, msg));
      }
    },
  };
}

function missingFeatures() {
  const miss = [];
  if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') miss.push('WebAssembly');
  if (typeof DecompressionStream !== 'function') miss.push('DecompressionStream');
  return miss;
}

// ---------- 主程式 ----------
async function boot() {
  const L = loadingUI();
  const miss = missingFeatures();
  if (miss.length) {
    L.error('這個瀏覽器跑不動', `缺少 ${miss.join('、')}。請改用新版 Chrome、Edge、Firefox 或 Safari 16.4 以上。`);
    return;
  }
  if (!window.__SW_ASSETS) {
    L.error('資產沒有內嵌', '找不到 window.__SW_ASSETS，這個檔案可能沒有經過 npm run build。');
    return;
  }
  const P = readParams();
  let assets;
  let core;
  let parsed;
  let meshes;
  try {
    L.stage(0);
    await nextFrame();
    assets = await loadAssets();
    L.stage(1);
    await nextFrame();
    core = await loadCore(assets.wasm);
    L.stage(2);
    await nextFrame();
    parsed = assets.tracks.map((b) => parseTrack(b));
    meshes = parseMeshes(assets.meshes);
    L.stage(3);
    await nextFrame();
  } catch (err) {
    console.warn(err);
    L.error('載入失敗', String((err && err.message) || err));
    return;
  }

  // 面板木紋（程序產生，寫進 CSS 變數）
  const ply = plywoodTexture();
  if (ply) document.documentElement.style.setProperty('--ply', `url(${ply})`);

  const hudRoot = $('#hud');
  const touchRoot = $('#touch');
  const screensRoot = $('#screens');
  let renderer;
  try {
    renderer = createRenderer($('#view'), { meshes, tracks: parsed, albedo: assets.albedo });
  } catch (err) {
    console.warn(err);
    L.error('畫面初始化失敗', String((err && err.message) || err));
    return;
  }
  const canvas = renderer.canvas || $('#view');
  canvas.id = 'view';
  const input = createInput({ canvas, touchRoot });
  const audio = createAudio();
  const career = createCareer();
  const race = createRace(core, { raw: assets.tracks, parsed });
  const nav = createNav();

  const app = createApp({ P, core, renderer, input, audio, career, race, nav, parsed, raw: assets.tracks, hudRoot, touchRoot, screensRoot, canvas });
  L.done();
  app.start();
}

function createApp(ctx) {
  const { P, core, renderer, input, audio, career, race, nav, parsed, raw, hudRoot, touchRoot, screensRoot, canvas } = ctx;
  const body = document.body;

  let screen = 'loading';
  let scr = null; // 目前畫面物件 {root, update, onBack, ...}
  let layout = null;
  let raceEnd = -1; // 比賽結束倒數（秒）
  let playerDoneT = -1;
  let attractWait = -1;
  let frameEvents = [];
  let last = 0;
  let pauseToggleT = 0;
  let volTimer = 0;

  const app = {
    core, renderer, input, audio, career, race, nav, debug: P.debug,
    tracks: { raw, parsed },
    get screen() { return screen; },
  };

  // ---------- 車色與名字 ----------
  app.playerColor = () => {
    const v = career.settings.color | 0;
    return v >= 0 && v < COLORS.length ? v : 0;
  };
  app.setPlayerColor = (i) => career.saveSettings({ color: i | 0 });
  // 座位 0 = 玩家色，其餘三色依序給對手
  app.seatColors = () => {
    const p = app.playerColor();
    const rest = COLORS.map((c, i) => i).filter((i) => i !== p);
    return [p, ...rest].map((i) => COLORS[i].hex);
  };
  app.colorName = (seat) => {
    const p = app.playerColor();
    const rest = COLORS.map((c, i) => i).filter((i) => i !== p);
    return COLORS[[p, ...rest][seat]].name;
  };
  app.seatNames = () => ['你', ...RIVALS.map((r) => r.name)];

  // ---------- 音訊 ----------
  app.sfx = (name) => { try { audio.api.play(name); } catch (e) { /* 忽略 */ } };
  app.muted = () => { try { return !!audio.api.isMuted(); } catch (e) { return false; } };
  app.setMuted = (v) => {
    try { audio.api.mute(!!v); } catch (e) { /* 忽略 */ }
    career.saveSettings({ muted: !!v });
  };
  app.saveVolumes = () => {
    clearTimeout(volTimer);
    volTimer = setTimeout(() => {
      const v = {};
      for (const b of ['master', 'music', 'sfx', 'engine']) {
        try { v[b] = audio.api.getVolume(b); } catch (e) { /* 忽略 */ }
      }
      career.saveSettings({ volumes: v });
    }, 250);
  };
  function restoreAudio() {
    const s = career.settings;
    if (s.volumes && typeof s.volumes === 'object') {
      for (const [b, v] of Object.entries(s.volumes)) {
        if (Number.isFinite(v)) try { audio.api.setVolume(b, v); } catch (e) { /* 忽略 */ }
      }
    }
    if (P.mute) app.setMutedTemp(true);
    else if (s.muted) try { audio.api.mute(true); } catch (e) { /* 忽略 */ }
  }
  app.setMutedTemp = (v) => { try { audio.api.mute(!!v); } catch (e) { /* 忽略 */ } };

  // ---------- 輸入來源（標題畫面顯示） ----------
  app.inputSources = () => {
    let pads = [];
    try { pads = input.gamepads() || []; } catch (e) { pads = []; }
    let locked = false;
    try { locked = !!input.spinner.isLocked(); } catch (e) { /* 忽略 */ }
    let src = 'keyboard';
    try { src = input.source(); } catch (e) { /* 忽略 */ }
    const touchVis = touchVisible();
    const padName = pads.length ? String(pads[0]).replace(/\s*\(.*$/, '').slice(0, 22) : '';
    const out = [
      { icon: 'key', label: '鍵盤', on: src === 'keyboard' },
      { icon: 'pad', label: pads.length ? '手把：' + padName : '手把未接上', on: src === 'gamepad' || pads.length > 0 },
      { icon: 'spin', label: locked ? '旋轉方向盤已鎖定' : '旋轉方向盤', on: src === 'spinner' || locked },
    ];
    if (touchVis || src === 'touch') out.push({ icon: 'touch', label: '觸控按鈕', on: src === 'touch' });
    return out;
  };
  function touchVisible() {
    try { return !!(input.touch && input.touch.visible()); } catch (e) { return false; }
  }

  // ---------- 最佳單圈 ----------
  app.bestLap = (i) => {
    const b = career.settings.bests && career.settings.bests[i];
    if (!(b > 0)) return '';
    const m = Math.floor(b / 60);
    const s = (b - m * 60).toFixed(2).padStart(5, '0');
    return m + ':' + s;
  };
  function recordBest(trackId, t) {
    if (!(t > 0)) return;
    const bests = { ...(career.settings.bests || {}) };
    if (!(bests[trackId] > 0) || t < bests[trackId]) {
      bests[trackId] = +t.toFixed(3);
      career.saveSettings({ bests });
    }
  }

  // ---------- HUD ----------
  const hud = createHud(hudRoot, app);

  // ---------- 版面 ----------
  function isRaceLayout() { return screen === 'race' || screen === 'pause'; }
  app.layoutNow = () => {
    const W = document.documentElement.clientWidth || innerWidth;
    const H = document.documentElement.clientHeight || innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const race = isRaceLayout();
    const touch = race && touchVisible();
    layout = computeLayout(W, H, { race, touch });
    applyLayout(layout, body);
    body.classList.toggle('touch-on', touch);
    try {
      if (renderer.setInsets) renderer.setInsets(layout.insets);
      renderer.resize(W, H, dpr);
    } catch (e) { console.warn(e); }
    placeHud();
  };
  function placeHud() {
    let r = null;
    try { r = renderer.trackRectOnScreen(); } catch (e) { r = null; }
    if (r) hud.place(r);
  }
  // 非觸控裝置第一次被觸控時，input 才會顯示觸控鈕：重排一次留出空間
  window.addEventListener('touchstart', () => requestAnimationFrame(app.layoutNow), { once: true, passive: true });
  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(app.layoutNow);
  });

  // ---------- 比賽設定 ----------
  const randSeed = () => (P.seed !== null ? P.seed : (Math.random() * 0x7fffffff) | 0) >>> 0 || 1;

  // mode: 'tour' | 'practice' | 'attract'
  app.prepareRace = (mode, trackId, extra = {}) => {
    const c = career.ensure();
    let cfg;
    if (mode === 'tour') {
      const nr = career.nextRace();
      cfg = { mode, trackId: nr.trackId, laps: nr.laps, rivals: nr.rivals, season: nr.season, round: nr.round, extraNitro: c.extraNitro };
    } else if (mode === 'attract') {
      cfg = { mode, trackId, laps: 2, rivals: rivalsFor(2, (trackId | 0) % 4), season: 0, round: 0, extraNitro: 0, playerAI: true };
    } else {
      const t = ((trackId | 0) % parsed.length + parsed.length) % parsed.length;
      cfg = { mode: 'practice', trackId: t, laps: extra.laps || LAPS, rivals: rivalsFor(c.season, c.round, c.upgrades), season: c.season, round: c.round, extraNitro: 0 };
    }
    if (extra.laps) cfg.laps = extra.laps | 0;
    if (extra.playerAI) cfg.playerAI = true;
    const player = mode === 'attract' ? { tires: 2, engine: 2, shocks: 2, nitro: 1 } : { ...c.upgrades };
    const full = race.start({ ...cfg, seed: extra.seed != null ? extra.seed : randSeed(), player });
    Object.assign(full, { season: cfg.season, round: cfg.round });
    try { renderer.setTrack(full.trackId); } catch (e) { console.warn(e); }
    if (mode !== 'attract') hud.setupRace(full);
    raceEnd = -1;
    playerDoneT = -1;
    placeHud();
    return full;
  };

  function startAttract() {
    const id = (Math.random() * parsed.length) | 0;
    app.prepareRace('attract', id);
    attractWait = -1;
  }

  // ---------- 畫面切換 ----------
  const SCREENS = {
    title: (p) => titleScreen(app, p),
    practice: (p) => practiceScreen(app, p),
    intro: (p) => introScreen(app, p),
    results: (p) => resultsScreen(app, p),
    garage: (p) => garageScreen(app, p),
    settings: (p) => settingsScreen(app, p),
    pause: (p) => pauseScreen(app, p),
  };
  // 畫面 → 音樂／音效情境
  // 暫停：音樂沿用比賽曲目，但引擎／打滑／氮氣持續音要停（audio 的 'pause' 情境）
  const AUDIO_SCREEN = { title: 'title', practice: 'title', settings: 'title', intro: 'race', race: 'race', pause: 'pause', results: 'results', garage: 'garage' };

  // 由暫停進入的設定頁沿用暫停情境（引擎靜音、音樂不換）
  let audioScreen = 'title';
  const audioScreenFor = (name, params) => (name === 'settings' && params.from === 'pause' ? 'pause' : AUDIO_SCREEN[name] || 'title');

  app.go = (name, params = {}) => {
    const prev = screen;
    if (scr && scr.root) scr.root.remove();
    scr = null;
    screen = name;
    body.dataset.screen = name;
    try { input.clear(); } catch (e) { /* 忽略 */ }

    // 設定頁若由暫停進入，維持比賽畫面（不跑示範賽）
    const attractScreens = ['title', 'practice'];
    if (attractScreens.includes(name) || (name === 'settings' && params.from !== 'pause')) {
      const cfg = race.config;
      if (!cfg || cfg.mode !== 'attract') startAttract();
    }

    if (name === 'race') {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      nav.setScope(null);
      if (params.fresh) {
        raceEnd = -1;
        playerDoneT = -1;
      }
    } else {
      const make = SCREENS[name];
      scr = make ? make(params) : null;
      if (scr) {
        screensRoot.append(scr.root);
        nav.setScope(scr.root, { initial: scr.initial, onBack: scr.onBack });
      }
    }
    body.classList.toggle('racing', name === 'race' || name === 'pause');
    // 旋轉方向盤的 Pointer Lock 只在比賽畫面保留：其他畫面放開游標，滑鼠才點得到按鈕
    try {
      input.setRacing(name === 'race');
      if (name !== 'race' && name !== 'settings') input.spinner.unlock();
    } catch (e) { /* 忽略 */ }
    audioScreen = audioScreenFor(name, params);
    try { audio.setScreen(audioScreen); } catch (e) { /* 忽略 */ }
    if (prev !== name) app.layoutNow();
    last = performance.now();
  };

  let lockedBeforePause = false;
  app.pause = () => {
    if (screen !== 'race') return;
    if (race.phase() === PHASE.DONE) return;
    try { lockedBeforePause = !!input.spinner.isLocked(); } catch (e) { lockedBeforePause = false; }
    app.go('pause');
  };
  // opts.lock：暫停選單的「鎖定游標並繼續」。暫停前是鎖定的也自動重新鎖定（需要使用者手勢，失敗就等玩家點畫面）
  app.resume = (opts = {}) => {
    if (screen !== 'pause') return;
    const relock = opts.lock || (lockedBeforePause && input.settings().spinnerAutoLock);
    app.go('race');
    if (relock) { try { input.spinner.lock(); } catch (e) { /* 忽略 */ } }
  };
  app.spinnerInUse = () => {
    try { return lockedBeforePause || !!input.settings().spinnerAutoLock; } catch (e) { return false; }
  };
  // 比賽中失去 Pointer Lock（瀏覽器的 Esc、切換視窗）：轉盤玩家會突然不能轉向，所以自動暫停
  input.spinner.onLockChange((locked) => {
    if (!locked && screen === 'race' && race.config && race.config.mode !== 'attract' && race.phase() !== PHASE.DONE) {
      app.pause();
      lockedBeforePause = true;
    }
  });
  app.restartRace = () => {
    const cfg = race.config;
    if (!cfg) return;
    app.prepareRace(cfg.mode, cfg.trackId, { laps: cfg.laps, playerAI: cfg.playerAI });
    app.go('race', { fresh: true });
  };
  app.quitRace = () => {
    race.stop();
    app.go('title');
  };

  // ---------- 商店 ----------
  app.buy = (key) => {
    if (typeof key === 'number') key = (UPGRADES[key] || {}).key;
    if (key === 'extra' || key === 'nitroCan' || key === 'spare') key = 'can';
    const ok = career.buy(key);
    app.sfx(ok ? 'purchase' : 'ui_back');
    return ok;
  };

  // ---------- 結算 ----------
  function finishToResults() {
    const cfg = race.config;
    if (!cfg) return null;
    const res = race.results();
    let summary = null;
    if (cfg.mode === 'tour') {
      summary = career.applyResult(res.player.place, res.player.cash, res.player.bestLap, cfg.trackId);
    }
    recordBest(cfg.trackId, res.player.bestLap);
    app.go('results', { res, summary, mode: cfg.mode });
    return { res, summary };
  }

  // 比賽事件分派：HUD、音效；silent = 快轉時不發聲
  function dispatch(evs, silent) {
    if (!evs || !evs.length) return;
    const s = core.state();
    if (screen === 'race' || screen === 'pause') hud.onEvents(evs, s);
    // 快轉時不發聲，但 Sidewinder.audio.on() 掛點照樣收到事件
    try { audio.handleEvents(evs, core, { silent: !!silent }); } catch (e) { /* 忽略 */ }
    if (!silent) frameEvents = frameEvents.concat(evs);
  }

  // ---------- 選單事件（鍵盤＋手把） ----------
  input.onMenu((type, info) => {
    const t = typeof type === 'string' ? type : type && (type.type || type.name);
    if (!t) return;
    unlockAudio();
    const fromPad = !!(info && info.source === 'gamepad');
    if (screen === 'race') {
      // 手把的 B 在比賽中是煞車，不能當「返回」暫停；手把只用 Start 暫停。鍵盤 Esc／Backspace 照舊
      if (t === 'menu' || t === 'pause' || t === 'start' || (t === 'back' && !fromPad)) togglePause();
      return;
    }
    if (screen === 'pause' && (t === 'menu' || t === 'start' || t === 'pause')) { togglePause(); return; }
    if (screen === 'loading') return;
    const before = nav.current;
    const used = nav.handle(t);
    if (used) {
      if (t === 'back') app.sfx('ui_back');
      else if (t === 'confirm') app.sfx('ui_confirm');
      else if (nav.current !== before || t === 'left' || t === 'right') app.sfx('ui_move');
    }
  });
  function togglePause() {
    const now = performance.now();
    if (now - pauseToggleT < 120) return; // Esc 可能同時來自 keydown 與 onMenu
    pauseToggleT = now;
    if (screen === 'race') app.pause();
    else if (screen === 'pause') app.resume();
  }
  // 點擊按鈕的音效（滑鼠／觸控）
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest && e.target.closest('[data-nav]');
    if (el && e.isTrusted) app.sfx(el.classList.contains('back') ? 'ui_back' : 'ui_confirm');
  });

  // 第一次使用者手勢解鎖 AudioContext
  // 手把事件不算使用者手勢：只有 context 真的在跑才停止重試
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    try {
      audio.unlock();
      audioUnlocked = audio.api.state() === 'running';
    } catch (e) { audioUnlocked = false; }
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(ev, unlockAudio, { passive: true });
  }

  // 視窗失去焦點（alt-tab 到別的程式、點到別的視窗）也暫停：這時按鍵都收不到
  window.addEventListener('blur', () => {
    if (screen === 'race' && race.phase() !== PHASE.DONE) app.pause();
  });
  // 分頁隱藏就暫停
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (screen === 'race' && race.phase() !== PHASE.DONE) app.pause();
    } else {
      last = performance.now();
    }
  });

  // ---------- 迴圈 ----------
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    frameEvents = [];
    let inp = ZERO;
    try { inp = input.poll(dt) || ZERO; } catch (e) { inp = ZERO; }
    let simDt = 0;

    try {
      if (screen === 'race') {
        const evs = race.tick(dt, inp, false);
        simDt = dt;
        dispatch(evs, false);
        raceFlow(dt);
      } else if (race.config && race.config.mode === 'attract') {
        dispatch(race.tick(dt, ZERO, false), false);
        simDt = dt;
        if (race.phase() === PHASE.DONE) {
          if (attractWait < 0) attractWait = 3;
          attractWait -= dt;
          if (attractWait <= 0) startAttract();
        }
      } else if ((screen === 'results' || screen === 'garage') && race.phase() === PHASE.DONE) {
        // 結算後畫面背景：讓場上的車自己停下（從賽道介紹進車庫時，準備好的比賽還沒開始，不能跑）
        dispatch(race.tick(dt, ZERO, false), true);
        simDt = dt;
      }
      if (screen === 'race' || screen === 'pause') hud.update(dt, race.gaps());
      if (scr && scr.update) scr.update(dt);
    } catch (e) {
      reportOnce(e);
    }

    try {
      renderer.draw(core, simDt, {
        truckColors: app.seatColors(),
        attract: !!(race.config && race.config.mode === 'attract'),
        events: frameEvents,
        paused: screen === 'pause',
      });
    } catch (e) {
      reportOnce(e);
    }
    try { audio.update(core, dt, audioScreen); } catch (e) { /* 忽略 */ }
  }
  let reported = false;
  function reportOnce(e) {
    if (reported) return;
    reported = true;
    console.warn('SIDEWINDER 迴圈例外', e);
  }

  // 比賽中：偵測結束、玩家完賽後快轉收尾
  function raceFlow(dt) {
    const s = core.state();
    const hd = header(s);
    if (hd.phase === PHASE.DONE) {
      if (raceEnd < 0) raceEnd = 2.4;
      raceEnd -= dt;
      if (raceEnd <= 0) finishToResults();
      return;
    }
    const pl = readTrucks(s)[0];
    if (pl.finished) {
      if (playerDoneT < 0) playerDoneT = 3.2;
      playerDoneT -= dt;
      if (playerDoneT <= 0) {
        // 玩家已完賽：其餘的車不必看完，直接快轉到結束
        race.runToEnd((evs) => dispatch(evs, true), 120);
        finishToResults();
      }
    }
  }

  // ---------- 對外 API ----------
  function snapshot() {
    const s = core.state();
    const hd = header(s);
    const c = career.data;
    return {
      screen,
      paused: screen === 'pause',
      phase: hd.phase,
      time: hd.time,
      laps: hd.laps,
      trackId: race.config ? race.config.trackId : hd.trackId,
      mode: race.config ? race.config.mode : null,
      trucks: readTrucks(s),
      money: c ? c.money : 0,
      season: c ? c.season : 1,
      round: c ? c.round : 0,
      upgrades: c ? { ...c.upgrades } : { tires: 0, engine: 0, shocks: 0, nitro: 0 },
      extraNitro: c ? c.extraNitro : 0,
      layout: layout ? layout.mode : null,
      renderer: renderer.kind,
      input: (() => { try { return input.source(); } catch (e) { return null; } })(),
    };
  }

  const testApi = {
    state: snapshot,
    // 直接開一場（跳過介紹卡）；opts: {laps, seed, playerAI, mode:'practice'|'tour'}
    startRace(trackId = 0, opts = {}) {
      const mode = opts.mode === 'tour' ? 'tour' : 'practice';
      const cfg = app.prepareRace(mode, trackId, opts);
      app.go('race', { fresh: true });
      return { trackId: cfg.trackId, laps: cfg.laps, seed: cfg.seed, mode: cfg.mode, playerAI: !!cfg.playerAI };
    },
    // 不渲染快轉；玩家非 AI 時由自動駕駛代開
    fastForward(sec = 10) {
      if (!race.config) return snapshot();
      race.fastForward(sec, (evs) => dispatch(evs, true));
      if (race.config.mode !== 'attract' && race.phase() === PHASE.DONE && (screen === 'race' || screen === 'pause')) finishToResults();
      return snapshot();
    },
    finishRaceNow() {
      if (!race.config || race.config.mode === 'attract') return null;
      const done = race.runToEnd((evs) => dispatch(evs, true), 900);
      const r = finishToResults();
      if (!r) return null;
      return {
        completed: done,
        place: r.res.player.place,
        order: r.res.order.map((t) => ({ k: t.k, place: t.place, finished: t.finished, time: t.finishT, best: t.bestLap })),
        summary: r.summary,
      };
    },
    buy(kind) {
      const ok = app.buy(kind);
      if (scr && scr.rerender) scr.rerender();
      return ok;
    },
    career() {
      const c = career.ensure();
      return JSON.parse(JSON.stringify({ ...c, prizes: career.prizes(), next: career.nextRace() }));
    },
    grant(n) { career.grant(n | 0); if (scr && scr.rerender) scr.rerender(); return career.data.money; },
    go: (name, p) => app.go(name, p),
    upgradeStat: (kind, lv) => core.upgradeStat(kind, lv),
    input,
    audio: audio.api,
    renderer,
    core,
  };

  app.start = () => {
    restoreAudio();
    window.__sw = testApi;
    const pub = Object.assign(window.Sidewinder || {}, { audio: audio.api, input, version: '195.1', ready: readyPromise });
    window.Sidewinder = pub;
    resolveReady(pub);
    try { window.dispatchEvent(new CustomEvent('sidewinder:ready', { detail: pub })); } catch (e) { /* 忽略 */ }
    last = performance.now();
    if (P.track !== null) {
      testApi.startRace(P.track, {});
    } else {
      app.go('title');
    }
    app.layoutNow();
    requestAnimationFrame(frame);
  };

  return app;
}

boot();
