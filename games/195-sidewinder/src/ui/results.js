// 結果：完賽順序、時間、最佳單圈、名次獎金＋撿到的錢、生涯累計。
import { h, fmtMoney, fmtTime } from './dom.js';
import { diamond } from './art.js';
import { TRACKS } from '../game/consts.js';
import { prizeTable } from '../game/career.js';

export function resultsScreen(app, params) {
  const { res, summary, mode } = params;
  const colors = app.seatColors();
  const names = app.seatNames();
  const cfg = app.race.config || {};
  const meta = TRACKS[cfg.trackId] || { zh: '', en: '' };
  const prizes = mode === 'tour' && summary ? prizeTable(summary.season) : null;

  const rows = res.order.map((t) => h('li', { class: 'rs-row' + (t.k === 0 ? ' me' : '') },
    h('span', { class: 'rs-pos' }, String(t.place)),
    h('span', { class: 'rs-c', html: diamond(colors[t.k], 14) }),
    h('span', { class: 'rs-n' }, names[t.k]),
    h('span', { class: 'rs-t' }, t.finished ? fmtTime(t.finishT) : '未完賽'),
    h('span', { class: 'rs-b' }, fmtTime(t.bestLap)),
    h('span', { class: 'rs-p' }, prizes ? fmtMoney(prizes[t.place - 1]) : '')));

  const place = res.player.place;
  let head;
  let money = null;
  if (mode === 'tour' && summary) {
    head = summary.seasonEnd ? `第 ${summary.season} 季結束` : `第 ${summary.season} 季 · 第 ${summary.round + 1} 站`;
    const c = app.career.data;
    money = h('dl', { class: 'ledger' },
      h('dt', null, `第 ${place} 名獎金`), h('dd', null, fmtMoney(summary.prize)),
      h('dt', null, '場上撿到'), h('dd', null, fmtMoney(summary.pickups)),
      h('dt', { class: 'sum' }, '本場入帳'), h('dd', { class: 'sum' }, fmtMoney(summary.total)),
      h('dt', null, '生涯累計'), h('dd', null, fmtMoney(c.earned)),
      h('dt', null, '可用資金'), h('dd', null, fmtMoney(c.money)));
  } else {
    head = '練習賽';
    money = h('p', { class: 'b-note' }, '練習賽不計獎金。');
  }

  const verdict = ['冠軍', '亞軍', '季軍', '第四名'][place - 1] || `第 ${place} 名`;
  const note = mode === 'tour' && summary && summary.seasonEnd
    ? h('p', { class: 'b-note' }, `下一季獎金提高，對手也會改得更兇。`)
    : null;

  const actions = mode === 'tour'
    ? [h('button', { type: 'button', 'data-nav': '', class: 'act go', id: 'r-next', onclick: () => app.go('garage') }, '進車庫')]
    : [h('button', { type: 'button', 'data-nav': '', class: 'act go', id: 'r-next', onclick: () => app.go('intro', { mode: 'practice', trackId: cfg.trackId }) }, '再跑一次'),
      h('button', { type: 'button', 'data-nav': '', class: 'act back', onclick: () => app.go('title') }, '回標題')];

  const root = h('section', { class: 'scr scr-results' },
    h('div', { class: 'board results' },
      h('p', { class: 'b-kick' }, head + '　' + meta.zh),
      h('h2', { class: 'verdict' + (place === 1 ? ' win' : '') }, verdict),
      h('div', { class: 'rs-grid' },
        h('ol', { class: 'rs-table' },
          h('li', { class: 'rs-row rs-headrow', 'aria-hidden': 'true' },
            h('span', { class: 'rs-pos' }, ''), h('span', { class: 'rs-c' }), h('span', { class: 'rs-n' }, '車手'),
            h('span', { class: 'rs-t' }, '總時間'), h('span', { class: 'rs-b' }, '最佳單圈'), h('span', { class: 'rs-p' }, prizes ? '獎金' : '')),
          rows),
        h('div', { class: 'rs-money' }, money, note)),
      h('div', { class: 'row-actions' }, actions)));
  return { root, initial: '#r-next', onBack: () => (mode === 'tour' ? app.go('garage') : app.go('title')) };
}
