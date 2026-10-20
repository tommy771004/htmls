// TERRA（268）主程式：載入地點 → 串流圖磚 → 遊戲迴圈（輸入、玩家、車流、天氣、畫面、HUD），
// 以及地圖／相簿／設定／畫質／地點／日誌／測試面板與攝影模式。window.__terra 是給驗收腳本用的測試 API。
import { World, CAR_MODELS } from './core/world.js';
import { ChunkStreamer, raycastBuildings } from './core/stream.js';
import { Traffic } from './core/traffic.js';
import { Weather, OVERRIDES, TIMESCALES, seaState } from './core/weather.js';
import { PLACES, LANDMARKS, KINDS, placeAt, isLand } from './core/places.js';
import { MODES, createPlayer, emptyInput, spawnPlayer, setMode, stepPlayer, carName } from './core/player.js';
import { DEVLOG, PHOTO_OPTIONS, FOV_MM, cycleOption, apertureF } from './core/devlog.js';
import { runSelfTests } from './core/selftest.js';
import { haversine, bearing, clamp, wrapAngle } from './core/math.js';
import { shuttleLatLon, startGlide, jumpToOrbit, ORBIT_ALT } from './core/shuttle.js';
import { Renderer, QUALITY } from './gfx/renderer.js';
import { GlobeMap, drawMini } from './ui/map.js';
import { playSfx, unlockAudio, updateAmbience, setMuted, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(`terra268.${k}`);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`terra268.${k}`, JSON.stringify(v));
    } catch {
      /* 私密視窗或空間不足：只影響偏好設定 */
    }
  },
};

// ── 狀態 ──
const S = {
  place: null,
  world: null,
  streamer: null,
  traffic: null,
  weather: new Weather(268),
  player: createPlayer(),
  t: 0,
  local: null,
  nav: null,
  ready: false,
  hud: store.get('hud', true),
  units: store.get('units', 'metric'),
  stance: store.get('stance', 'regular'),
  quality: store.get('quality', window.innerWidth < 760 ? 'low' : 'mid'),
  photo: { active: false, sel: 0, opts: {}, focusDist: 12 },
  photos: [],
  fps: 60,
  overlay: null,
};
for (const o of PHOTO_OPTIONS) S.photo.opts[o.id] = o.def;
S.weather.dayMinutes = store.get('dayMinutes', 48);

const canvas = $('c');
const R = new Renderer(canvas, S.quality);
const globe = new GlobeMap($('globe'), (ll) => showCard(ll));
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');

// ── 地點 ──
function loadPlace(place, at) {
  S.place = place;
  S.world = new World(place);
  S.streamer = new ChunkStreamer(S.world, { viewDist: QUALITY[S.quality].view, cacheSize: 260, genPerUpdate: 6 });
  S.traffic = new Traffic(S.world, 7);
  const p = S.player;
  if (p.inside) p.inside = null;
  p.lift = null;
  spawnPlayer(p, S.world, at || place.spawn);
  R.setWorld(S.world, S.streamer);
  R.cam.yaw = p.yaw;
  R.cam.pitch = 0.2;
  R.cam.mode = 'follow';
  warm();
  updateDock();
  updateHelp();
  toast(`${place.name} · ${KINDS[place.kind].label}`);
}

// 開場或換地點：把近處圖磚一次生成完，避免一進來是空的
function warm() {
  const p = S.player;
  for (let k = 0; k < 40; k++) {
    const vis = S.streamer.update(p.x, p.z);
    if (!S.streamer.stats.queued) break;
    if (k === 39) break;
    void vis;
  }
  S.warmFrames = 3;
}

// ── 輸入 ──
const keys = new Set();
const pressed = new Set();
const touch = { mx: 0, my: 0, jump: false, use: false, crouch: false, sprint: false };
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('textarea, input, select')) return;
  unlockAudio();
  const k = e.code;
  if (!keys.has(k)) pressed.add(k);
  keys.add(k);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
  hotkey(k, e);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function hotkey(k, e) {
  if (k === 'Escape') {
    if (S.overlay) closeOverlay();
    else if (S.photo.active) togglePhoto(false);
    return;
  }
  if (S.overlay) return;
  if (k === 'KeyM') openOverlay('map');
  else if (k === 'KeyP') togglePhoto();
  else if (k === 'KeyH') setHud(!S.hud);
  else if (k === 'KeyV' && !S.photo.active) {
    R.cam.mode = R.cam.mode === 'first' ? 'follow' : 'first';
    toast(R.cam.mode === 'first' ? '第一人稱' : '第三人稱');
  } else if (k === 'KeyT') {
    const i = TIMESCALES.indexOf(S.weather.timeScale);
    S.weather.timeScale = TIMESCALES[(i + 1) % TIMESCALES.length];
    S.photo.opts.timelapse = TIMESCALES.indexOf(S.weather.timeScale);
    toast(`縮時 ${S.weather.timeScale}×`);
  } else if (k === 'KeyN') {
    if (S.player.lift) return;
    const i = OVERRIDES.findIndex((o) => o.id === S.weather.override);
    setWeather(OVERRIDES[(i + 1) % OVERRIDES.length].id);
  } else if (k === 'Enter' && S.photo.active) shoot();
  else if (/^Digit[1-7]$/.test(k) && !S.photo.active) pickMode(MODES[Number(k.slice(5)) - 1].id);
  else if (S.photo.active && (k === 'ArrowLeft' || k === 'ArrowRight')) {
    S.photo.sel = (S.photo.sel + (k === 'ArrowRight' ? 1 : -1) + PHOTO_OPTIONS.length) % PHOTO_OPTIONS.length;
    renderPhoto();
  } else if (S.photo.active && (k === 'ArrowUp' || k === 'ArrowDown')) {
    changePhoto(PHOTO_OPTIONS[S.photo.sel].id, k === 'ArrowUp' ? 1 : -1);
  }
  void e;
}

// 拖曳轉相機（滑鼠與觸控皆可）
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  R.rotateCam(dx * 0.0055, R.cam.mode === 'free' ? -dy * 0.004 : dy * 0.004);
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('pointercancel', () => (drag = null));
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  R.zoomCam(e.deltaY > 0 ? 1.1 : 0.9);
}, { passive: false });

// 觸控搖桿與按鈕
{
  const stick = $('stick');
  const knob = stick.querySelector('i');
  let sid = null;
  const move = (e) => {
    const r = stick.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    touch.mx = x;
    touch.my = -y;
    knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
  };
  stick.addEventListener('pointerdown', (e) => {
    unlockAudio();
    sid = e.pointerId;
    stick.setPointerCapture(sid);
    move(e);
  });
  stick.addEventListener('pointermove', (e) => e.pointerId === sid && move(e));
  const end = () => {
    sid = null;
    touch.mx = touch.my = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  for (const b of $('tbtns').querySelectorAll('button')) {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      touch[k] = true;
      if (k === 'jump') pressed.add('Space');
      if (k === 'use') pressed.add('KeyE');
      b.classList.add('hold');
    });
    const up = () => {
      touch[k] = false;
      b.classList.remove('hold');
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }
}

function readInput() {
  const k = (c) => keys.has(c);
  const inp = emptyInput();
  inp.mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.mx;
  inp.my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) + touch.my;
  inp.mx = clamp(inp.mx, -1, 1);
  inp.my = clamp(inp.my, -1, 1);
  inp.camYaw = R.cam.yaw;
  inp.sprint = k('ShiftLeft') || k('ShiftRight') || touch.sprint;
  inp.crouch = k('ControlLeft') || k('KeyC') || touch.crouch;
  inp.jump = k('Space') || touch.jump;
  inp.jumpPressed = pressed.has('Space');
  inp.use = pressed.has('KeyE') || pressed.has('KeyF');
  inp.throttleUp = k('KeyR') || k('PageUp');
  inp.throttleDown = k('KeyF') || k('PageDown');
  inp.mxPressed = pressed.has('KeyD') || pressed.has('ArrowRight') ? 1 : pressed.has('KeyA') || pressed.has('ArrowLeft') ? -1 : 0;
  inp.myPressed = pressed.has('KeyW') || pressed.has('ArrowUp') ? 1 : pressed.has('KeyS') || pressed.has('ArrowDown') ? -1 : 0;
  return inp;
}

// ── 載具列 ──
const ICONS = {
  walk: '<path d="M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM9 8l-3 4 2 1 2-2 1 3-3 7h2.4l2.4-5.4L16 20h2.4l-3.6-8.6L14 8z"/>',
  board: '<path d="M3 13h18l-1.5 2.4H4.5zM6 18a1.5 1.5 0 1 0 0-.01M18 18a1.5 1.5 0 1 0 0-.01"/>',
  bike: '<path d="M5.5 19a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm13 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM5.5 15.5L9 9h5l4.5 6.5M9 9l3.5 6.5L14 9M13 6h3"/>',
  car: '<path d="M4 15v-3l2-5h12l2 5v3zM6 15v2.5M18 15v2.5M7 12h10M7.5 7.5l-1 4.5h11l-1-4.5"/>',
  plane: '<path d="M21 14v-2l-8-5V3.5a1 1 0 0 0-2 0V7l-8 5v2l8-2.5V17l-2 1.5V20l3-1 3 1v-1.5L13 17v-5.5z"/>',
  boat: '<path d="M3 15l2 4h14l2-4zM6 15l1-5h7l3 5M10 10V6h3"/>',
  shuttle: '<path d="M12 2.5c2.2 2 3.2 4.6 3.2 7.6V17H8.8v-6.9c0-3 1-5.6 3.2-7.6zM8.8 12.5L5 16.5V19l3.8-2M15.2 12.5l3.8 4V19l-3.8-2M10.5 17l-.6 3.5h4.2l-.6-3.5M12 7.5v2"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  photo: '<path d="M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>',
  cam: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${ICONS[k]}</svg>`;
function updateDock() {
  const snow = S.world && S.world.kind === 'ski';
  const m = S.player.mode;
  $('dock').innerHTML = MODES.map((d) => `<button data-mode="${d.id}" class="${m === d.id ? 'on' : ''}" title="${d.key}">${svg(d.id)}<span>${d.id === 'board' && snow ? d.snowName : d.name.replace('螺旋槳', '')}</span></button>`).join('')
    + `<span class="sep"></span><button data-act="cam" title="V">${svg('cam')}<span>${R.cam.mode === 'first' ? '第一人稱' : '第三人稱'}</span></button><button data-act="photo" title="P">${svg('photo')}<span>攝影</span></button><button data-act="map" title="M">${svg('map')}<span>地圖</span></button>`;
}
$('dock').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  unlockAudio();
  if (b.dataset.mode) pickMode(b.dataset.mode);
  else if (b.dataset.act === 'map') openOverlay('map');
  else if (b.dataset.act === 'photo') togglePhoto();
  else if (b.dataset.act === 'cam') {
    R.cam.mode = R.cam.mode === 'first' ? 'follow' : 'first';
    updateDock();
  }
});
function pickMode(id) {
  const err = setMode(S.player, id, env());
  if (err) toast(err);
  else playSfx('mode');
  updateDock();
  updateHelp();
}

const HELP = {
  walk: [['WASD', '移動'], ['Shift', '衝刺'], ['空白', '跳／爬上岸'], ['C', '蹲'], ['E', '進門／上車／搭纜車'], ['拖曳', '轉視角'], ['滾輪', '遠近']],
  board: [['W', '推進'], ['S', '煞停'], ['A/D', '轉向（空中：翻板）'], ['空白', '豚跳（按住 C 跳更高）'], ['C', '蹲低／空中抓板'], ['S 空中', '轉板'], ['扶手上跳', '磨桿']],
  bike: [['W/S', '踩踏／煞車'], ['A/D', '轉向'], ['Shift', '衝刺'], ['空白', '跳'], ['拖曳', '轉視角']],
  car: [['W/S', '油門／煞車倒車'], ['A/D', '轉向'], ['Shift', '加速'], ['1', '下車'], ['拖曳', '轉視角']],
  plane: [['W/S', '俯衝／拉升'], ['A/D', '滾轉'], ['R/F', '油門'], ['1', '跳傘落地'], ['V', '座艙視角']],
  boat: [['W/S', '油門／倒退'], ['A/D', '轉向'], ['Shift', '全速'], ['1', '上岸']],
};
const SHUTTLE_HELP = {
  pad: [['空白／W', '點火倒數'], ['A/D', '（升空後）改變方位'], ['V', '座艙視角'], ['1', '離開發射台']],
  count: [['等待', '主引擎 T-3.5 點火，T-0 助推器點火']],
  ascent: [['A/D', '改變發射方位'], ['W/S', '姿態微調'], ['V', '座艙視角'], ['拖曳', '轉視角']],
  orbit: [['E', '離軌返回地面'], ['Shift', '軌道快轉 40×'], ['A/D', '偏航'], ['V', '座艙視角'], ['拖曳', '轉視角']],
  reentry: [['A/D', '側滑減速'], ['等待', '約 20 秒落到軌跡下方的地點']],
  landing: [['等待', '進場中']],
  glide: [['W/S', '俯衝／拉平'], ['A/D', '滾轉'], ['1', '跳傘落地'], ['提示', '機頭別太低、滾轉別太大才能平安著陸']],
};
const PHASE_NAME = { pad: '發射台', count: '倒數', ascent: '升空', orbit: '軌道', reentry: '再入', landing: '再入', glide: '滑翔進場' };
function updateHelp() {
  const p = S.player;
  const list = p.lift ? [['空白', '跳下吊椅'], ['等待', '到山頂自動換上雪板']] : p.inside ? [['WASD', '走動'], ['E', '在樓梯上樓（C+E 下樓）／在門口出去'], ['拖曳', '轉視角']] : p.mode === 'shuttle' ? SHUTTLE_HELP[p.shuttle.phase] || SHUTTLE_HELP.pad : HELP[p.mode] || HELP.walk;
  const general = [['1–7', '載具'], ['M', '地圖'], ['P', '攝影'], ['T', '縮時'], ['N', '天氣'], ['H', '隱藏 HUD']];
  const row = (l) => l.map(([k, v]) => `<span><kbd>${k}</kbd> ${v}</span>`).join('');
  $('help').innerHTML = `<div class="hd">${p.lift ? '吊椅纜車' : p.inside ? '室內' : MODES.find((m) => m.id === p.mode).name}${p.mode === 'shuttle' ? ` · ${PHASE_NAME[p.shuttle.phase] || ''}` : ''}</div><div class="row">${row(list)}</div><div class="row" style="margin-top:3px;opacity:.75">${row(general)}</div>`;
}

// ── 提示 ──
function toast(t) {
  if (!t) return;
  const d = document.createElement('div');
  d.textContent = t;
  $('toasts').appendChild(d);
  setTimeout(() => d.remove(), 2600);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
let trickT = 0;
function showTrick(text) {
  const [name, pts] = text.split('  ');
  $('trick').innerHTML = `${name}<small>${pts || ''}</small>`;
  $('trick').style.opacity = 1;
  trickT = 1.6;
}
function setHud(v) {
  S.hud = v;
  store.set('hud', v);
  $('hud').classList.toggle('off', !v);
  renderSettings();
}

// ── 天氣與時間 ──
function myLatLon() {
  return shuttleLatLon(S.player, S.place);
}
// 相對地點的時差（太空梭繞到別的經度時，太陽位置跟著換）
function hourOffset(ll) {
  let d = ll.lon - S.place.lon;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d / 15;
}

// 再入結束：換到軌跡下方的地點，從低空滑翔
function shuttleLanding(e) {
  const p = S.player;
  const heading = p.shuttle.heading;
  const pl = placeAt(e.lat, e.lon);
  S.weather.hour = (((S.weather.hour + hourOffset({ lon: pl.lon })) % 24) + 24) % 24;
  loadPlace(pl);
  startGlide(p, S.world);
  p.yaw = heading;
  R.cam.yaw = heading;
  R.cam.pitch = 0.2;
  updateDock();
  updateHelp();
}
function setWeather(id) {
  const ll = myLatLon();
  S.weather.setOverride(id, ll.lat, ll.lon);
  S.photo.opts.weather = OVERRIDES.findIndex((o) => o.id === id);
  toast(`天氣：${OVERRIDES.find((o) => o.id === id).name}`);
  renderSettings();
}

// ── 導航 ──
function setNav(target) {
  S.nav = target;
  if (target) toast(`導航到 ${target.name}`);
}

// ── 覆蓋面板 ──
function openOverlay(tab) {
  S.overlay = tab;
  $('ov').classList.add('on');
  for (const b of $('ovBar').querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.id === `tab-${tab}`);
  keys.clear();
  if (tab === 'map') {
    const ll = myLatLon();
    globe.me = ll;
    globe.target = S.nav;
    globe.cells = S.weather.allCells();
    if (!globe.pick) {
      globe.centerOn(ll.lat, ll.lon);
      showCard(ll, true);
    }
    requestAnimationFrame(() => {
      globe.resize();
      globe.draw();
    });
  }
  if (tab === 'settings') renderSettings();
  if (tab === 'quality') renderQuality();
  if (tab === 'places') renderPlaces();
  if (tab === 'log') renderLog();
  if (tab === 'tests') renderTests();
  if (tab === 'photos') renderPhotos();
}
function closeOverlay() {
  S.overlay = null;
  $('ov').classList.remove('on');
}
$('ovBar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'ovClose') closeOverlay();
  else if (b.dataset.tab) openOverlay(b.dataset.tab);
});
$('miniWrap').addEventListener('click', () => openOverlay('map'));
$('mapFlat').addEventListener('click', () => {
  globe.flat = !globe.flat;
  globe.zoom = globe.flat ? 1.2 : 1;
  $('mapFlat').classList.toggle('on', globe.flat);
  $('mapFlat').textContent = globe.flat ? '地球儀' : '平面地圖';
  globe.draw();
});
$('mapHome').addEventListener('click', () => {
  const ll = myLatLon();
  globe.centerOn(ll.lat, ll.lon);
  globe.zoom = Math.max(globe.zoom, 2.5);
  globe.pick = null;
  showCard(ll, true);
  globe.draw();
});
$('mapStorms').addEventListener('click', () => {
  globe.showStorms = !globe.showStorms;
  $('mapStorms').classList.toggle('on', globe.showStorms);
  globe.draw();
});

function fmtDist(m) {
  if (S.units === 'imperial') {
    const mi = m / 1609.34;
    return mi < 0.2 ? `${Math.round(m * 3.281)} ft` : `${mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString()} mi`;
  }
  return m < 1000 ? `${Math.round(m)} m` : `${m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000).toLocaleString()} km`;
}
function fmtLL(ll) {
  return `${Math.abs(ll.lat).toFixed(4)}°${ll.lat >= 0 ? 'N' : 'S'}  ${Math.abs(ll.lon).toFixed(4)}°${ll.lon >= 0 ? 'E' : 'W'}`;
}

let cardLL = null;
function showCard(ll, mine) {
  cardLL = ll;
  const near = PLACES.find((p) => haversine(p.lat, p.lon, ll.lat, ll.lon) < 30000);
  const lm = LANDMARKS.find((p) => haversine(p.lat, p.lon, ll.lat, ll.lon) < 30000);
  const land = isLand(ll.lat, ll.lon);
  const kind = placeAt(ll.lat, ll.lon).kind;
  const w = S.weather.sample(ll.lat, ll.lon, 0);
  const me = myLatLon();
  const d = haversine(me.lat, me.lon, ll.lat, ll.lon);
  const title = mine ? `你在這裡 · ${S.place.name}` : near ? near.name : lm ? lm.name : land ? '陸地' : '海洋';
  $('card').innerHTML = `<h3>${title}</h3><div class="m">${fmtLL(ll)}${mine ? '' : ` · 距離 ${fmtDist(d)}`}</div>
    <div class="w">${w.label} · ${Math.round(w.temp)}°C · 風 ${Math.round(w.wind * 3.6)} km/h · 地區類型：${KINDS[kind].label}</div>
    <div class="acts">${mine ? '' : '<button class="obtn" data-c="drop">落在這裡</button><button class="obtn" data-c="nav">導航到這裡</button>'}
    <button class="obtn ghost" data-c="home">回到你身邊</button><button class="obtn ghost" data-c="wx">在這裡生成：${OVERRIDES[(OVERRIDES.findIndex((o) => o.id === S.weather.override) + 1) % OVERRIDES.length].name}</button></div>`;
}
$('card').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !cardLL) return;
  playSfx('click');
  const c = b.dataset.c;
  if (c === 'drop') {
    const name = (PLACES.find((p) => haversine(p.lat, p.lon, cardLL.lat, cardLL.lon) < 30000) || {}).name;
    loadPlace(placeAt(cardLL.lat, cardLL.lon, name));
    closeOverlay();
  } else if (c === 'nav') {
    const lm = LANDMARKS.find((p) => haversine(p.lat, p.lon, cardLL.lat, cardLL.lon) < 30000);
    setNav({ name: lm ? lm.name : fmtLL(cardLL), lat: cardLL.lat, lon: cardLL.lon });
    globe.target = S.nav;
    globe.draw();
  } else if (c === 'home') $('mapHome').click();
  else if (c === 'wx') {
    const i = OVERRIDES.findIndex((o) => o.id === S.weather.override);
    S.weather.setOverride(OVERRIDES[(i + 1) % OVERRIDES.length].id, cardLL.lat, cardLL.lon);
    toast(`天氣：${OVERRIDES[(i + 1) % OVERRIDES.length].name}`);
    globe.cells = S.weather.allCells();
    showCard(cardLL);
    globe.draw();
  }
});

function sw(on, id) {
  return `<button class="sw ${on ? 'on' : ''}" data-s="${id}" role="switch" aria-checked="${on}"></button>`;
}
function seg(id, list, cur) {
  return `<div class="seg" data-g="${id}">${list.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function renderSettings() {
  if (S.overlay !== 'settings') return;
  const W = S.weather;
  const hh = Math.floor(W.hour);
  const mm = Math.floor((W.hour - hh) * 60);
  const month = Math.min(11, Math.floor(W.day / 30.42));
  $('settings').innerHTML = `
  <h4>顯示</h4>
  <div class="row2"><div class="tx"><b>顯示 HUD</b><small>速度、儀表、小地圖、羅盤與除錯資訊</small></div>${sw(S.hud, 'hud')}</div>
  <div class="row2"><div class="tx"><b>單位</b><small>距離與速度</small></div>${seg('units', [['metric', '公制'], ['imperial', '英制']], S.units)}</div>
  <div class="row2"><div class="tx"><b>音效</b><small>環境、引擎與招式（WebAudio 即時合成）</small></div>${sw(!isMuted(), 'sound')}</div>
  <h4>天空</h4>
  <div class="row2"><div class="tx"><b>時刻</b><small>太陽依真實經緯度與日期計算位置</small></div><input type="range" min="0" max="23.99" step="0.05" value="${W.hour}" data-r="hour" aria-label="時刻"><b style="width:44px;text-align:right">${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b></div>
  <div class="row2"><div class="tx"><b>月份</b><small>季節影響日照長短、氣溫與降雪</small></div><select data-r="month">${Array.from({ length: 12 }, (_, k) => `<option value="${k}" ${k === month ? 'selected' : ''}>${k + 1} 月</option>`).join('')}</select></div>
  <div class="row2"><div class="tx"><b>時間流逝</b><small>關閉後時刻固定（天氣系統仍緩慢移動）</small></div>${sw(W.timePasses, 'passes')}</div>
  <div class="row2"><div class="tx"><b>一天長度</b><small>現實幾分鐘＝遊戲一天</small></div>${seg('daylen', [[12, '12 分'], [24, '24 分'], [48, '48 分'], [96, '96 分']], W.dayMinutes)}</div>
  <div class="row2"><div class="tx"><b>縮時</b><small>雲、颶風與龍捲風一起加速</small></div>${seg('ts', TIMESCALES.map((x) => [x, `${x}×`]), W.timeScale)}</div>
  <div class="row2 hot"><div class="tx"><b>天氣</b><small>龍捲風會在你西方 2.2 公里生成並朝你移動；颶風把你放進眼牆外圍</small></div><select data-r="weather">${OVERRIDES.map((o) => `<option value="${o.id}" ${o.id === W.override ? 'selected' : ''}>${o.name}</option>`).join('')}</select></div>
  <h4>滑板</h4>
  <div class="row2"><div class="tx"><b>站姿</b><small>滑板與雪板：左腳在前（一般）或右腳在前（反腳）</small></div>${seg('stance', [['regular', '一般'], ['goofy', '反腳']], S.stance)}</div>`;
}
$('settings').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  playSfx('click');
  if (b.dataset.s === 'hud') setHud(!S.hud);
  else if (b.dataset.s === 'sound') setMuted(!isMuted());
  else if (b.dataset.s === 'passes') S.weather.timePasses = !S.weather.timePasses;
  const g = b.closest('[data-g]');
  if (g) {
    const v = b.dataset.v;
    if (g.dataset.g === 'units') S.units = v;
    if (g.dataset.g === 'daylen') S.weather.dayMinutes = Number(v);
    if (g.dataset.g === 'ts') S.weather.timeScale = Number(v);
    if (g.dataset.g === 'stance') S.stance = v;
    store.set('units', S.units);
    store.set('dayMinutes', S.weather.dayMinutes);
    store.set('stance', S.stance);
  }
  renderSettings();
});
$('settings').addEventListener('input', (e) => {
  const r = e.target.dataset.r;
  if (r === 'hour') {
    S.weather.hour = Number(e.target.value);
    const lab = e.target.nextElementSibling;
    const hh = Math.floor(S.weather.hour);
    lab.textContent = `${String(hh).padStart(2, '0')}:${String(Math.floor((S.weather.hour - hh) * 60)).padStart(2, '0')}`;
  }
});
$('settings').addEventListener('change', (e) => {
  const r = e.target.dataset.r;
  if (r === 'month') S.weather.day = Math.round(Number(e.target.value) * 30.42 + 15);
  if (r === 'weather') setWeather(e.target.value);
});

function renderQuality() {
  if (S.overlay !== 'quality') return;
  const st = S.streamer.stats;
  const rs = R.stats;
  const hit = st.hits + st.misses ? Math.round((st.hits / (st.hits + st.misses)) * 100) : 0;
  $('quality').innerHTML = `<h4>畫質</h4>
  <div class="row2"><div class="tx"><b>預設</b><small>視距、陰影解析度、像素比、泛光、每幀建網格數與路人上限</small></div>${seg('q', Object.entries(QUALITY).map(([k, q]) => [k, q.label]), S.quality)}</div>
  <h4>串流</h4>
  <div class="row2"><div class="stat">視距 ${QUALITY[S.quality].view} m · LOD 切換 170 / 400 m
常駐圖磚 ${st.resident} · 繪製 ${st.drawn}（L0 ${st.lod[0]} · L1 ${st.lod[1]} · L2 ${st.lod[2]}）· 排隊 ${st.queued}
累計生成 ${st.generated} · 快取命中 ${hit}% · 逐出 ${st.evicted}
圖磚網格 ${rs.chunkMeshes} · 本幀建置 ${rs.builtThisFrame}
繪製呼叫 ${rs.calls} · 三角形 ${(rs.tris / 1000).toFixed(0)}k · ${S.fps.toFixed(0)} fps</div></div>`;
}
$('quality').addEventListener('click', (e) => {
  const b = e.target.closest('[data-g] button');
  if (!b) return;
  S.quality = b.dataset.v;
  store.set('quality', S.quality);
  R.setQuality(S.quality);
  S.streamer.viewDist = QUALITY[S.quality].view;
  renderQuality();
});

function renderPlaces() {
  const me = myLatLon();
  $('places').innerHTML = `<h4>精選地點</h4><div class="plist">${PLACES.map((p) => `<button class="pcard" data-p="${p.id}"><em>${KINDS[p.kind].label}</em><b>${p.name}</b><small>${p.sub}</small></button>`).join('')}</div>
  <h4>導航目的地</h4><div class="plist">${LANDMARKS.map((l) => `<button class="pcard" data-l="${l.id}"><em>${fmtDist(haversine(me.lat, me.lon, l.lat, l.lon))}</em><b>${l.name}</b><small>${fmtLL(l)}</small></button>`).join('')}
  <button class="pcard" data-l=""><b>取消導航</b><small>收起右側的導航卡</small></button></div>`;
}
$('places').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  playSfx('click');
  if (b.dataset.p) {
    loadPlace(PLACES.find((p) => p.id === b.dataset.p));
    closeOverlay();
  } else if (b.dataset.l !== undefined) {
    const l = LANDMARKS.find((x) => x.id === b.dataset.l);
    setNav(l ? { name: l.name, lat: l.lat, lon: l.lon } : null);
    closeOverlay();
  }
});

function renderLog() {
  const fb = store.get('feedback', '');
  $('log').innerHTML = `<h4>每日進度與明日計畫</h4>${DEVLOG.map((d) => `<div class="day"><h5><span>第 ${d.day} 天</span>${d.title}</h5><ul>${d.done.map((x) => `<li>${x}</li>`).join('')}</ul><div class="nx"><b>明天：</b>${d.next.join('；')}</div></div>`).join('')}
  <h4>回饋（存在這台裝置）</h4><textarea id="fb" placeholder="哪裡最想先加細節？">${fb.replace(/</g, '&lt;')}</textarea>`;
  $('fb').addEventListener('input', (e) => store.set('feedback', e.target.value));
}

function renderTests() {
  const r = runSelfTests();
  $('tests').innerHTML = `<h4>引擎自我測試 · ${r.passed} / ${r.total} 通過</h4><div class="tests">${r.results.map((x) => `<div><span class="${x.passed ? 'ok' : 'ng'}">${x.passed ? '通過' : '失敗'}</span><span>第 ${x.stage} 階段 · ${x.name}</span><small>${x.detail || ''}</small></div>`).join('')}</div>`;
}

function renderPhotos() {
  $('photos').innerHTML = S.photos.length
    ? S.photos.map((p, i) => `<figure><img src="${p.url}" alt="${p.name}"><figcaption><span>${p.name}</span><a href="${p.url}" download="terra-${i + 1}.jpg">下載</a></figcaption></figure>`).join('')
    : '<p style="color:var(--paper-mute)">還沒有照片。按 P 進入攝影模式，Enter 或白色快門拍照。</p>';
}

// ── 攝影模式 ──
function togglePhoto(on = !S.photo.active) {
  S.photo.active = on;
  $('photo').classList.toggle('on', on);
  $('hud').style.visibility = on ? 'hidden' : '';
  if (on) {
    applyPhoto();
    renderPhoto();
  } else {
    R.cam.mode = 'follow';
    $('grid').classList.remove('on');
    canvas.style.filter = '';
    if (!S.player.inside) R.setInterior(null);
  }
}
function renderPhoto() {
  $('photoOpts').innerHTML = PHOTO_OPTIONS.map((o, i) => `<button class="${i === S.photo.sel ? 'sel' : ''}" data-i="${i}"><small>${o.name}</small><b>${o.values[S.photo.opts[o.id]]}</b></button>`).join('');
  $('photoHint').textContent = R.cam.mode === 'free' ? 'WASD 移動鏡頭 · Q/E 升降 · 拖曳轉向 · ←/→ 選項 · ↑/↓ 調整 · Enter 拍照' : '鏡頭跟著你 · ←/→ 選項 · ↑/↓ 調整 · Enter 拍照';
}
$('photoOpts').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = Number(b.dataset.i);
  if (i === S.photo.sel) changePhoto(PHOTO_OPTIONS[i].id, 1);
  else {
    S.photo.sel = i;
    renderPhoto();
  }
});
$('shutter').addEventListener('click', () => shoot());
$('photoExit').addEventListener('click', () => togglePhoto(false));
function changePhoto(id, d) {
  cycleOption(S.photo.opts, id, d);
  applyPhoto();
  renderPhoto();
  playSfx('click');
}
const FILTERS = ['', 'sepia(.28) saturate(1.25) brightness(1.04)', 'hue-rotate(-12deg) saturate(.85) brightness(1.05) contrast(1.05)', 'grayscale(1) contrast(1.1)', 'contrast(1.12) saturate(.82) sepia(.16)'];
function applyPhoto() {
  const o = S.photo.opts;
  const val = (id) => PHOTO_OPTIONS.find((x) => x.id === id).values[o[id]];
  $('grid').classList.toggle('on', o.grid === 1);
  S.weather.timeScale = TIMESCALES[o.timelapse];
  const wantFree = o.camera === 1;
  if (wantFree && R.cam.mode !== 'free') {
    R.enterFree();
    R.cam.mode = 'free';
  } else if (!wantFree && R.cam.mode === 'free') R.cam.mode = 'follow';
  const wid = OVERRIDES[o.weather].id;
  if (wid !== S.weather.override) {
    const ll = myLatLon();
    S.weather.setOverride(wid, ll.lat, ll.lon);
  }
  canvas.style.filter = FILTERS[o.filter];
  S.photo.fov = FOV_MM[val('fov')];
  S.photo.aperture = apertureF(val('aperture')) || 99;
}
function photoState() {
  if (!S.photo.active) return null;
  const o = S.photo.opts;
  const p = S.player;
  const cam = R.camera.position;
  let focus = 12;
  if (o.focus === 0) focus = Math.hypot(cam.x - p.x, cam.y - p.y - 1.2, cam.z - p.z);
  else if (o.focus === 1) {
    const d = R.camera.getWorldDirection(R.camera.up.clone());
    focus = Math.min(300, raycastBuildings(S.streamer, cam.x, cam.y, cam.z, d.x, d.y, d.z, 300));
  } else focus = [0, 0, 3, 12, 60][o.focus];
  S.photo.focusDist += (focus - S.photo.focusDist) * 0.2;
  return { active: true, fov: S.photo.fov, aperture: S.photo.aperture, focus: S.photo.focusDist, exposure: 1 };
}
function shoot() {
  playSfx('shutter');
  const fx = $('flashFx');
  fx.style.transition = 'none';
  fx.style.opacity = 0.85;
  requestAnimationFrame(() => {
    fx.style.transition = '';
    fx.style.opacity = 0;
  });
  try {
    const w = 960;
    const h = Math.round((canvas.height / canvas.width) * w);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.filter = FILTERS[S.photo.opts.filter] || 'none';
    g.drawImage(canvas, 0, 0, w, h);
    const url = c.toDataURL('image/jpeg', 0.86);
    const hh = Math.floor(S.weather.hour);
    S.photos.unshift({ url, name: `${S.place.name.split(' · ')[0]} · ${String(hh).padStart(2, '0')}:${String(Math.floor((S.weather.hour - hh) * 60)).padStart(2, '0')}` });
    S.photos.length = Math.min(S.photos.length, 24);
    toast(`已存到相簿（${S.photos.length} 張）`);
  } catch {
    toast('這個瀏覽器不允許擷取畫面');
  }
}

// ── 主迴圈 ──
function env() {
  return { world: S.world, place: S.place, streamer: S.streamer, traffic: S.traffic, t: S.t, seaAmp: S.local ? seaState(S.world.kind, S.local.wind) : 0.4 };
}

let last = performance.now();
let hudT = 0;
let miniT = 0;
let ambT = 0;
let prevInside = null;
let prevLift = null;
let fpsAcc = 0;
let fpsN = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(rawDt);
}

function tick(rawDt) {
  const dt = Math.min(rawDt, 0.05);
  fpsAcc += rawDt;
  fpsN++;
  if (fpsAcc > 0.5) {
    S.fps = fpsN / fpsAcc;
    fpsAcc = 0;
    fpsN = 0;
  }
  S.t += dt;
  const p = S.player;
  const W = S.world;
  S.weather.step(dt);
  const ll = myLatLon();
  S.local = S.weather.sample(ll.lat, ll.lon, Math.max(0, p.y));

  // 玩家
  const inp = S.overlay ? emptyInput() : readInput();
  if (R.cam.mode === 'free' && S.photo.active) {
    R.moveFree(inp.mx, inp.my, (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0), dt, inp.sprint);
    stepPlayer(p, emptyInput(), dt, env());
  } else stepPlayer(p, inp, dt, env());
  pressed.clear();
  let landing = null;
  for (const e of p.events) {
    if (e.type === 'toast') {
      toast(e.text);
      if (/走進|回到街上/.test(e.text)) playSfx('door');
    } else if (e.type === 'trick') {
      showTrick(e.text);
      playSfx('trick');
    } else if (e.type === 'bump') {
      if (e.text) toast(e.text);
      playSfx('bump');
    } else if (e.type === 'crash') {
      toast(e.text);
      playSfx('crash');
    } else if (e.type === 'count') {
      showTrick(e.text);
      playSfx('click');
    } else if (e.type === 'liftoff' || e.type === 'sep' || e.type === 'orbit') {
      if (e.type === 'liftoff') showTrick(e.text);
      else toast(e.text);
      playSfx(e.type === 'liftoff' ? 'thunder' : 'pop');
    } else if (e.type === 'reentry') {
      landing = e;
    }
  }
  p.events.length = 0;
  if (landing) shuttleLanding(landing);
  if (p.mode === 'shuttle' && p.shuttle.phase !== S.lastPhase) {
    S.lastPhase = p.shuttle.phase;
    updateHelp();
  }
  if (!!p.inside !== !!prevInside || !!p.lift !== !!prevLift) {
    updateHelp();
    updateDock();
  }
  prevInside = p.inside;
  prevLift = p.lift;
  if (p.mode !== S.lastMode) {
    S.lastMode = p.mode;
    updateDock();
    updateHelp();
  }

  // 世界
  S.traffic.update(dt, p);
  const fx = R.cam.mode === 'free' ? R.cam.free.x : p.x;
  const fz = R.cam.mode === 'free' ? R.cam.free.z : p.z;
  const visible = S.streamer.update(fx, fz);
  const flash = S.weather.maybeFlash(dt, S.local.thunder);
  if (flash) playSfx('thunder');

  // 攝影模式的剖面
  if (S.photo.active && S.photo.opts.cutaway === 1 && !p.inside) {
    R.U.uCutY.value = p.y + 3.2;
    R.U.uCutBox.value.set(p.x - 40, p.z - 40, p.x + 40, p.z + 40);
  } else if (!p.inside && R.U.uCutY.value < 1e5) R.setInterior(null);

  R.frame({
    player: p, local: S.local, dt, t: S.t, lat: ll.lat, lon: ll.lon, weather: S.weather, sun: S.weather.sun(ll.lat, hourOffset(ll)), moon: S.weather.moon(ll.lat, hourOffset(ll)),
    visible, warm: S.warmFrames > 0, traffic: S.traffic.enabled ? S.traffic : null, trafficT: S.traffic.t,
    newFlash: flash, flashPos: S.weather.flashPos, timeScale: S.weather.timeScale,
    interiorLayout: p.inside ? p.inside.layout : null, photo: photoState(), stance: S.stance,
  });
  if (S.warmFrames > 0) S.warmFrames--;

  // 聲音
  ambT -= dt;
  if (ambT <= 0) {
    ambT = 0.1;
    const vehicle = p.mode === 'car' || p.mode === 'boat' || p.mode === 'plane' || (p.mode === 'shuttle' && p.shuttle.thrust > 0);
    updateAmbience({
      wind: S.local.wind, rain: S.local.snow ? 0 : S.local.rain, city: W.K.grid ? (W.kind === 'metro' ? 1 : 0.5) : 0, indoor: !!p.inside,
      roll: (p.mode === 'board' || p.mode === 'bike') && p.grounded ? clamp(Math.abs(p.sp) / 10, 0, 1) : 0, rollSp: Math.abs(p.sp), snow: W.kind === 'ski',
      engine: vehicle ? { kind: p.mode, rpm: p.mode === 'shuttle' ? p.shuttle.thrust * clamp(1.3 - p.shuttle.alt / 60000, 0.15, 1) : p.mode === 'plane' ? p.plane.throttle : clamp(Math.abs(p.sp) / (p.mode === 'boat' ? 28 : 40), 0, 1) } : null,
    });
  }

  // HUD
  if (trickT > 0) {
    trickT -= dt;
    if (trickT <= 0) $('trick').style.opacity = 0;
  }
  compass();
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.12;
    hud(ll);
  }
  miniT -= dt;
  if (miniT <= 0 && S.hud) {
    miniT = 0.15;
    const nb = S.nav ? bearing(ll.lat, ll.lon, S.nav.lat, S.nav.lon) : null;
    drawMini($('mini'), W, S.streamer, p, R.cam.yaw, nb);
  }
  if (S.overlay === 'quality' && Math.random() < 0.05) renderQuality();
  if (!S.ready && S.streamer.stats.queued === 0 && R.stats.builtThisFrame === 0) {
    S.ready = true;
    $('boot').classList.add('done');
  } else if (!S.ready) $('bootBar').style.width = `${Math.min(100, (R.stats.chunkMeshes / Math.max(1, S.streamer.stats.drawn)) * 100)}%`;
}

const DIRS = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
function compass() {
  if (!S.hud) return;
  const yawDeg = ((R.cam.yaw * 180) / Math.PI + 360) % 360;
  const w = $('compass').clientWidth;
  const pxPerDeg = 2.4;
  let html = '';
  for (let d = -90; d <= 90; d += 15) {
    const a = Math.round((yawDeg + d) / 15) * 15;
    const off = (a - yawDeg) * pxPerDeg + w / 2;
    const aa = ((a % 360) + 360) % 360;
    if (aa % 45 === 0) html += `<span style="left:${off}px">${aa % 90 === 0 ? ['N', 'E', 'S', 'W'][aa / 90] : DIRS[aa / 45]}</span>`;
    else html += `<i style="left:${off}px"></i>`;
  }
  if (S.nav) {
    const ll = myLatLon();
    const b = (bearing(ll.lat, ll.lon, S.nav.lat, S.nav.lon) * 180) / Math.PI;
    const rel = ((b - yawDeg + 540) % 360) - 180;
    html += `<em style="left:${clamp(rel, -88, 88) * pxPerDeg + w / 2}px"></em>`;
  }
  $('cmpTrack').innerHTML = html;
  $('cmpDeg').textContent = `${Math.round(yawDeg)}°`;
}

function speedText(ms) {
  return S.units === 'imperial' ? [Math.round(ms * 2.237), 'mph'] : [Math.round(ms * 3.6), 'km/h'];
}

function hud(ll) {
  const p = S.player;
  const W = S.world;
  const L = S.local;
  const wx = S.weather;
  const hh = Math.floor(wx.hour);
  const mm = Math.floor((wx.hour - hh) * 60);
  $('wxTime').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  $('wxLabel').textContent = `${L.label} · ${Math.round(L.temp)}°C`;
  $('wxTs').textContent = wx.timeScale > 1 ? `${wx.timeScale}×` : wx.timePasses ? '' : '暫停';
  const alert = L.tornado && L.tornado.km < 8 ? `龍捲風 · ${L.tornado.km.toFixed(1)} km · ${DIRS[Math.round(((L.tornado.bearing * 180) / Math.PI + 360) / 45) % 8]}方` : L.hurricane && L.hurricane.km < L.hurricane.cell.radius ? `颶風${L.hurricane.cell.name ? ` ${L.hurricane.cell.name}` : ''} · 距中心 ${Math.round(L.hurricane.km)} km` : '';
  $('alert').style.display = alert ? 'block' : 'none';
  $('alert').textContent = alert;
  if (!S.hud) return;
  const st = S.streamer.stats;
  const g = W.groundAt(p.x, p.z);
  const [sv, su] = speedText(Math.abs(p.sp));
  const nBuild = (S.streamer.visible || []).reduce((a, v) => a + v.chunk.layers.building.length, 0);
  const hit = st.hits + st.misses ? Math.round((st.hits / (st.hits + st.misses)) * 100) : 0;
  const yaw = ((p.yaw * 180) / Math.PI + 360) % 360;
  const modeName = p.lift ? '吊椅' : p.inside ? `室內 ${p.inside.floor + 1}F` : p.mode === 'car' ? carName(p.car.model) : MODES.find((m) => m.id === p.mode).name;
  $('dbg').innerHTML = `<b>${ll.lat.toFixed(5)}°, ${ll.lon.toFixed(5)}°</b> · Alt ${Math.round(p.y)} m
Hdg ${Math.round(yaw)}° · ${modeName} · ${sv} ${su} · 離地 ${(p.y - g).toFixed(1)} m
${S.place.name}（${KINDS[W.kind].label}）
圖磚 L0 ${st.lod[0]} / L1 ${st.lod[1]} / L2 ${st.lod[2]} · 常駐 ${st.resident} · 排隊 ${st.queued}
生成 ${st.generated} · 命中 ${hit}% · 逐出 ${st.evicted} · 建物 ${nBuild}
車 ${S.traffic.cars.length} · 路人 ${S.traffic.peds.length} · 繪製 ${R.stats.calls} · ${(R.stats.tris / 1e6).toFixed(2)}M 三角形
<span class="w">${L.label}</span> · 雲 ${Math.round(L.cover * 100)}% · 雨 ${Math.round(L.rain * 100)}% · 風 ${Math.round(L.wind * 3.6)} km/h · ${S.fps.toFixed(0)} fps`;

  // 速度表
  const showG = p.mode !== 'walk' && !p.inside && !p.lift;
  $('gauge').classList.toggle('on', showG);
  if (showG) {
    $('gV').textContent = sv;
    $('gU').textContent = su;
    const max = { board: 12, bike: 14, car: 42, plane: 90, boat: 30, shuttle: p.shuttle.phase === 'glide' ? 140 : 7800 }[p.mode] || 20;
    $('gBar').style.width = `${clamp(Math.abs(p.sp) / max, 0, 1) * 100}%`;
    const SH = p.shuttle;
    $('gX').textContent = p.mode === 'shuttle' ? `${PHASE_NAME[SH.phase] || ''} · 高度 ${SH.alt >= 1000 ? `${(SH.alt / 1000).toFixed(1)} km` : `${Math.round(SH.alt)} m`}${SH.phase === 'ascent' ? ` · T+${Math.floor(SH.T)} s` : SH.phase === 'count' ? ` · T-${Math.ceil(SH.count)}` : SH.phase === 'orbit' && SH.warp > 1 ? ` · 快轉 ${SH.warp}×` : ''}` : p.mode === 'plane' ? `高度 ${S.units === 'imperial' ? `${Math.round((p.y - Math.max(g, W.waterY)) * 3.281)} ft` : `${Math.round(p.y - Math.max(g, W.waterY))} m`} · 油門 ${Math.round(p.plane.throttle * 100)}%` : p.mode === 'board' && p.board.score ? `分數 ${p.board.score}` : '';
  }

  // 互動提示
  let hint = '';
  if (p.mode === 'shuttle') {
    if (p.shuttle.phase === 'pad') hint = '<kbd>空白</kbd>開始倒數';
    else if (p.shuttle.phase === 'orbit') hint = '<kbd>E</kbd>離軌返回地面';
  } else if (p.mode === 'walk' && !p.inside && !p.lift) {
    if (W.kind === 'ski' && Math.hypot(p.x - 147.6, p.z - 246) < 9) hint = '搭吊椅纜車';
    else {
      const car = S.traffic.cars.find((c) => Math.hypot(c.x - p.x, c.z - p.z) < 3.6);
      if (car) hint = `接手這台${carName(car.model)}`;
      else {
        const b = S.streamer.buildingsNear(p.x, p.z, 3).find((b2) => Math.hypot(b2.door.x - p.x, b2.door.z - p.z) < 2.6);
        if (b) hint = `走進${b.shop ? b.shop.name : '建物'}（${b.floors} 層）`;
      }
    }
  } else if (p.inside) {
    const Lr = p.inside.layout;
    const s = Lr.stairs;
    if (s && p.x > s.x0 - 0.8 && p.x < s.x1 + 0.8 && p.z > s.z0 - 0.8 && p.z < s.z1 + 0.8) hint = `上樓（${p.inside.floor + 1}/${Lr.floors}F）`;
    else if (Lr.exit && Math.hypot(p.x - Lr.exit.x, p.z - Lr.exit.z) < 2.2) hint = '走出去';
  }
  $('prompt').style.display = hint ? 'block' : 'none';
  $('prompt').innerHTML = hint ? (hint.startsWith('<kbd>') ? hint : `<kbd>E</kbd>${hint}`) : '';

  // 導航卡
  $('nav').classList.toggle('on', !!S.nav);
  if (S.nav) {
    const d = haversine(ll.lat, ll.lon, S.nav.lat, S.nav.lon);
    const b = bearing(ll.lat, ll.lon, S.nav.lat, S.nav.lon);
    const rel = wrapAngle(b - R.cam.yaw);
    const deg = (rel * 180) / Math.PI;
    $('navArrow').style.transform = `rotate(${deg}deg)`;
    $('navD').textContent = fmtDist(d);
    $('navS').textContent = Math.abs(deg) < 25 ? '直走' : Math.abs(deg) > 150 ? '在你後方' : deg > 0 ? '在你右方' : '在你左方';
    $('navN').textContent = S.nav.name;
  }
}

addEventListener('resize', () => {
  R.resize();
  if (S.overlay === 'map') {
    globe.resize();
    globe.draw();
  }
});

// ── 測試 API ──
window.__terra = {
  get ready() {
    return S.ready;
  },
  state() {
    const p = S.player;
    return {
      place: S.place.id, kind: S.world.kind, mode: p.mode, x: p.x, y: p.y, z: p.z, yaw: p.yaw, sp: p.sp, inside: p.inside ? { id: p.inside.id, floor: p.inside.floor, rooms: p.inside.layout.rooms.length } : null,
      lift: !!p.lift, anim: p.anim, weather: S.local.label, hour: S.weather.hour, stats: { ...S.streamer.stats }, render: { ...R.stats }, cars: S.traffic.cars.length, peds: S.traffic.peds.length,
    };
  },
  goto(id, at) {
    const pl = PLACES.find((p) => p.id === id);
    S.ready = false;
    loadPlace(pl, at);
  },
  drop(lat, lon) {
    S.ready = false;
    loadPlace(placeAt(lat, lon));
  },
  place(x, z, yaw = 0) {
    const p = S.player;
    p.x = x;
    p.z = z;
    p.yaw = yaw;
    p.y = S.world.groundAt(x, z);
    p.sp = 0;
    R.cam.yaw = yaw;
    warm();
  },
  mode(m) {
    return setMode(S.player, m, env());
  },
  // 太空梭：'pad' 架台、'launch' 立刻升空、'orbit' 直接入軌（可給經緯度）、'reentry' 離軌、或回傳狀態
  shuttle(cmd, lat, lon) {
    const p = S.player;
    const SH = p.shuttle;
    if (cmd === 'pad') return setMode(p, 'shuttle', env());
    if (cmd === 'launch') {
      if (p.mode !== 'shuttle') setMode(p, 'shuttle', env());
      SH.phase = 'count';
      SH.count = 0.01;
    }
    if (cmd === 'orbit') {
      if (p.mode !== 'shuttle') setMode(p, 'shuttle', env());
      const ll = myLatLon();
      jumpToOrbit(p, lat ?? ll.lat, lon ?? ll.lon);
    }
    if (cmd === 'reentry' && SH.phase === 'orbit') {
      SH.phase = 'reentry';
      SH.T = 0;
      SH.entry = { alt: SH.alt, vH: SH.vH };
    }
    if (cmd === 'advance') {
      // 快轉 lat 秒（模擬固定步長，給驗收用）
      for (let k = 0; k < (lat || 1) * 30; k++) tick(1 / 30);
    }
    return { phase: SH.phase, alt: SH.alt, vH: SH.vH, vUp: SH.vUp, tilt: SH.tilt, srb: SH.srb, et: SH.et, lat: SH.lat, lon: SH.lon, mode: p.mode, ORBIT_ALT };
  },
  cam(yaw, pitch, zoom = 1) {
    R.cam.yaw = yaw;
    R.cam.pitch = pitch;
    R.cam.zoom = zoom;
    R.cam.idle = -1e9;
  },
  time(h) {
    S.weather.hour = h;
    S.weather.timePasses = false;
  },
  weather(id) {
    setWeather(id);
  },
  photo(on) {
    togglePhoto(on);
  },
  photoOpt(id, idx) {
    S.photo.opts[id] = idx;
    applyPhoto();
    renderPhoto();
  },
  shoot,
  overlay(tab) {
    if (tab) openOverlay(tab);
    else closeOverlay();
  },
  enter() {
    const p = S.player;
    const b = S.streamer.buildingsNear(p.x, p.z, 60).filter((x) => x.shop).sort((a, c) => Math.hypot(a.door.x - p.x, a.door.z - p.z) - Math.hypot(c.door.x - p.x, c.door.z - p.z))[0];
    if (!b) return false;
    const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[b.door.side];
    p.x = b.door.x + out[0] * 1.2;
    p.z = b.door.z + out[1] * 1.2;
    pressed.add('KeyE');
    return b.shop.name;
  },
  lift() {
    const p = S.player;
    p.x = 147.6;
    p.z = 246;
    p.y = S.world.groundAt(p.x, p.z);
    S.player.mode = 'walk';
    pressed.add('KeyE');
  },
  hud: setHud,
  quality(q) {
    S.quality = q;
    R.setQuality(q);
    S.streamer.viewDist = QUALITY[q].view;
  },
  nav(id) {
    const l = LANDMARKS.find((x) => x.id === id);
    setNav(l ? { name: l.name, lat: l.lat, lon: l.lon } : null);
  },
  key(code, down) {
    if (down) {
      if (!keys.has(code)) pressed.add(code);
      keys.add(code);
    } else keys.delete(code);
  },
  tests: () => runSelfTests(),
  CAR_MODELS,
  _r: R,
  _s: S,
};

// ── 開場 ──
const q = new URLSearchParams(location.search);
const startId = q.get('place');
loadPlace(PLACES.find((p) => p.id === startId) || PLACES[0]);
if (q.has('hour')) window.__terra.time(Number(q.get('hour')));
setHud(S.hud);
requestAnimationFrame(loop);
