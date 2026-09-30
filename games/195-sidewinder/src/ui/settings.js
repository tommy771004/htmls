// 設定：操控（鍵盤對照、手把狀態、旋轉方向盤校正與即時指示、觸控按鈕、車色）與音效（四組音量、靜音）。
import { h, esc } from './dom.js';
import { slider, segmented, toggle } from './widgets.js';
import { diamond, icon } from './art.js';
import { COLORS } from '../game/consts.js';

const KEYMAP = [
  ['轉向', ['←', '→'], ['A', 'D']],
  ['油門', ['↑'], ['W']],
  ['煞車／倒車', ['↓'], ['S']],
  ['氮氣', ['空白鍵'], ['Shift']],
  ['暫停', ['Esc'], ['P']],
];
const PADMAP = [
  ['轉向', '左搖桿／十字鍵'],
  ['油門', 'RT／A'],
  ['煞車', 'LT／B'],
  ['氮氣', 'X／RB'],
  ['暫停', 'Start'],
];
const BUSES = [['master', '總音量'], ['music', '音樂'], ['sfx', '音效'], ['engine', '引擎聲']];

// 靈敏度用對數刻度：20..5000
const SENS_MIN = 20;
const SENS_MAX = 5000;
const sensToV = (s) => Math.log(Math.max(SENS_MIN, Math.min(SENS_MAX, s)) / SENS_MIN) / Math.log(SENS_MAX / SENS_MIN);
const vToSens = (v) => Math.round(SENS_MIN * Math.pow(SENS_MAX / SENS_MIN, v));

export function settingsScreen(app, params = {}) {
  let tab = params.tab === 'audio' ? 'audio' : 'input';
  const from = params.from || 'title';
  const input = app.input;
  const back = () => app.go(from === 'pause' ? 'pause' : 'title');

  const getIn = () => {
    try { return input.settings() || {}; } catch (e) { return {}; }
  };
  const setIn = (patch) => {
    try { input.setSettings(patch); } catch (e) { /* 忽略 */ }
  };

  const tabs = segmented({
    label: '分頁',
    options: [{ value: 'input', label: '操控' }, { value: 'audio', label: '音效' }],
    value: tab,
    onChange: (v) => { tab = v; paint(); },
  });
  tabs.classList.add('tabs');
  const body = h('div', { class: 'set-body' });

  // 即時轉向指示（旋轉方向盤）
  const meterFill = h('span', { class: 'mt-fill' });
  const meterMark = h('span', { class: 'mt-mark' });
  const meterVal = h('span', { class: 'mt-val' }, '0.00');
  const lockBtn = h('button', { type: 'button', 'data-nav': '', class: 'act small', id: 's-lock' }, '鎖定游標');
  const lockNote = h('span', { class: 'b-note' });
  const padList = h('ul', { class: 'pads' });

  lockBtn.addEventListener('click', () => {
    const sp = input.spinner;
    if (!sp) return;
    try {
      if (sp.isLocked()) sp.unlock();
      else {
        sp.lock();
        // 鎖定過一次就當作在用轉盤：之後比賽中點畫面會自動鎖定（下面的開關可以關）
        if (!getIn().spinnerAutoLock) { setIn({ spinnerAutoLock: true }); if (autoLockToggle) autoLockToggle.setValue(true); }
      }
    } catch (e) { /* 瀏覽器可能拒絕 */ }
  });
  let autoLockToggle = null;

  function inputTab() {
    const s = getIn();
    const keys = h('table', { class: 'keymap' },
      h('tbody', null, KEYMAP.map(([name, a, b]) => h('tr', null,
        h('th', null, name),
        h('td', { html: a.map((k) => `<kbd>${esc(k)}</kbd>`).join('') }),
        h('td', { html: b.map((k) => `<kbd>${esc(k)}</kbd>`).join('') })))));
    const pad = h('table', { class: 'keymap pad' },
      h('tbody', null, PADMAP.map(([name, k]) => h('tr', null, h('th', null, name), h('td', null, k)))));

    const colorRow = h('div', { class: 'colors', role: 'radiogroup', 'aria-label': '車色' },
      COLORS.map((c, i) => h('button', {
        type: 'button', 'data-nav': '', role: 'radio', class: 'col' + (app.playerColor() === i ? ' on' : ''),
        'aria-checked': app.playerColor() === i ? 'true' : 'false',
        onclick: (e) => {
          app.setPlayerColor(i);
          for (const b of colorRow.children) {
            const on = b === e.currentTarget;
            b.classList.toggle('on', on);
            b.setAttribute('aria-checked', on ? 'true' : 'false');
          }
        },
        html: diamond(c.hex, 22) + `<span>${c.name}</span>`,
      })));

    return [
      h('section', { class: 'set-sec' },
        h('h3', { html: icon('key') + '<span>鍵盤</span>' }), keys),
      h('section', { class: 'set-sec' },
        h('h3', { html: icon('pad') + '<span>手把</span>' }), pad, padList),
      h('section', { class: 'set-sec spin' },
        h('h3', { html: icon('spin') + '<span>旋轉方向盤</span>' }),
        h('p', { class: 'b-note' }, 'USB 街機轉盤會被電腦當成滑鼠。鎖定游標後，左右轉動就是轉向。'),
        h('div', { class: 'meter', 'aria-label': '即時轉向' },
          h('span', { class: 'mt-track' }, h('span', { class: 'mt-zero' }), meterFill, meterMark), meterVal),
        h('div', { class: 'row-actions left' }, lockBtn, lockNote),
        segmented({
          label: '模式',
          options: [{ value: 'rate', label: '速率：轉越快轉越多' }, { value: 'position', label: '位置：累積角度自動回中' }],
          value: s.spinnerMode || 'rate',
          onChange: (v) => setIn({ spinnerMode: v }),
        }),
        slider({
          label: '靈敏度',
          value: sensToV(s.spinnerSensitivity || 400),
          step: 0.04,
          fmt: (v) => String(vToSens(v)),
          onChange: (v) => setIn({ spinnerSensitivity: vToSens(v) }),
        }),
        (autoLockToggle = toggle({ label: '比賽中點一下畫面就鎖定游標', value: !!s.spinnerAutoLock, onChange: (v) => setIn({ spinnerAutoLock: v }) })),
        toggle({ label: '方向反轉', value: !!s.spinnerInvert, onChange: (v) => setIn({ spinnerInvert: v }) }),
        toggle({ label: '不鎖游標，滑鼠在畫面上移動就轉向', value: !!s.spinnerNoLock, onChange: (v) => setIn({ spinnerNoLock: v }) })),
      h('section', { class: 'set-sec' },
        h('h3', { html: icon('touch') + '<span>觸控按鈕</span>' }),
        segmented({
          label: '顯示',
          options: [{ value: 'auto', label: '自動' }, { value: 'on', label: '顯示' }, { value: 'off', label: '隱藏' }],
          value: s.touch || 'auto',
          onChange: (v) => { setIn({ touch: v }); app.layoutNow(); },
        })),
      h('section', { class: 'set-sec' },
        h('h3', null, '車色'), colorRow),
    ];
  }

  function audioTab() {
    const api = app.audio && app.audio.api;
    const vol = (bus) => {
      try { const v = api.getVolume(bus); return Number.isFinite(v) ? v : 0.8; } catch (e) { return 0.8; }
    };
    return [
      h('section', { class: 'set-sec' },
        h('h3', null, '音量'),
        BUSES.map(([bus, name]) => slider({
          label: name, value: vol(bus), step: 0.05,
          onChange: (v) => { try { api.setVolume(bus, v); } catch (e) { /* 忽略 */ } app.saveVolumes(); },
        })),
        toggle({ label: '全部靜音', value: app.muted(), onChange: (v) => app.setMuted(v) })),
      h('section', { class: 'set-sec' },
        h('h3', null, '自訂音樂與音效'),
        h('p', { class: 'b-note' }, '預設的聲音都是即時合成。開發者可用 window.Sidewinder.audio 換上自己的音樂（標題、比賽、車庫三段）和音效，或用 on(事件名) 監聽比賽事件。')),
    ];
  }

  function paint() {
    body.textContent = '';
    body.append(...(tab === 'audio' ? audioTab() : inputTab()));
    app.nav.refresh();
  }

  const root = h('section', { class: 'scr scr-settings' },
    h('div', { class: 'board settings' },
      h('div', { class: 'gar-top' }, h('h2', { class: 'b-title' }, '設定'), tabs),
      body,
      h('div', { class: 'row-actions' }, h('button', { type: 'button', 'data-nav': '', class: 'act back', id: 's-back', onclick: back }, '返回'))));
  body.append(...(tab === 'audio' ? audioTab() : inputTab()));

  let padKey = '';
  function update() {
    const sp = input.spinner;
    let v = 0;
    let locked = false;
    try { v = sp ? +sp.value() || 0 : 0; locked = sp ? !!sp.isLocked() : false; } catch (e) { /* 忽略 */ }
    v = Math.max(-1, Math.min(1, v));
    const pct = Math.abs(v) * 50;
    meterFill.style.left = (v < 0 ? 50 - pct : 50) + '%';
    meterFill.style.width = pct + '%';
    meterMark.style.left = (50 + v * 50) + '%';
    meterVal.textContent = (v >= 0 ? '+' : '') + v.toFixed(2);
    lockBtn.textContent = locked ? '解除鎖定' : '鎖定游標';
    lockNote.textContent = locked ? '已鎖定：按 Esc 或點一下畫面解除' : '未鎖定';
    let pads = [];
    try { pads = input.gamepads() || []; } catch (e) { pads = []; }
    const k = pads.join('|');
    if (k !== padKey) {
      padKey = k;
      padList.innerHTML = pads.length
        ? pads.map((id) => `<li class="on">${esc(String(id).slice(0, 60))}</li>`).join('')
        : '<li>尚未偵測到手把。接上後按任一按鈕。</li>';
    }
  }

  return { root, initial: '.tabs .seg-b.on', onBack: back, update };
}
