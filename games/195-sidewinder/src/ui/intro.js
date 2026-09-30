// 賽道介紹卡：賽道名（中英）、圈數菱形鏈、小地圖、獎金表、對手。
import { h, fmtMoney } from './dom.js';
import { diamondChain, diamond } from './art.js';
import { miniMap } from './minimap.js';
import { TRACKS, UPGRADES } from '../game/consts.js';
import { prizeTable } from '../game/career.js';

export function introScreen(app, params = {}) {
  const mode = params.mode === 'practice' ? 'practice' : 'tour';
  const cfg = app.prepareRace(mode, params.trackId);
  const t = app.tracks.parsed[cfg.trackId];
  const meta = TRACKS[cfg.trackId] || { zh: t.name, en: t.name };
  const colors = app.seatColors();

  const head = mode === 'tour' ? `第 ${cfg.season} 季 · 第 ${cfg.round + 1} 站` : '練習賽';
  const prize = mode === 'tour' ? prizeTable(cfg.season) : null;

  const prizeEl = prize
    ? h('ol', { class: 'prizes' }, prize.map((p, i) => h('li', null, h('span', { class: 'pl' }, `第 ${i + 1} 名`), h('span', { class: 'pv' }, fmtMoney(p)))),
      h('li', { class: 'pz-note' }, h('span', { class: 'pl' }, '場上錢袋'), h('span', { class: 'pv' }, '$10,000–40,000')))
    : h('p', { class: 'b-note' }, '練習賽不發獎金，撿到的錢袋也不入帳。');

  const rivals = h('ul', { class: 'rivals' }, cfg.rivals.map((r, i) => {
    const lv = UPGRADES.reduce((s, u) => s + (r.up[u.key] || 0), 0);
    return h('li', null,
      h('span', { class: 'rv-c', html: diamond(colors[i + 1], 14) }),
      h('span', { class: 'rv-n' }, r.name),
      h('span', { class: 'rv-s' }, `技巧 ${Math.round(r.skill * 100)}`),
      h('span', { class: 'rv-u' }, `改裝 ${lv} 級`));
  }));

  const go = h('button', { type: 'button', 'data-nav': '', class: 'act go', id: 'i-go', onclick: () => app.go('race', { fresh: true }) }, '出發');
  const actions = h('div', { class: 'row-actions' }, go,
    mode === 'tour' ? h('button', { type: 'button', 'data-nav': '', class: 'act', onclick: () => app.go('garage') }, '車庫') : null,
    h('button', { type: 'button', 'data-nav': '', class: 'act back', onclick: () => back() }, mode === 'tour' ? '回標題' : '換賽道'));

  const back = () => app.go(mode === 'tour' ? 'title' : 'practice');

  const root = h('section', { class: 'scr scr-intro' },
    h('div', { class: 'board intro' },
      h('p', { class: 'b-kick' }, head),
      h('h2', { class: 'trk-name' }, meta.zh, h('span', { class: 'trk-en' }, meta.en)),
      h('div', { class: 'intro-grid' },
        h('div', { class: 'intro-map', html: miniMap(t, { label: meta.zh + ' 賽道圖' }) }),
        h('div', { class: 'intro-info' },
          h('div', { class: 'laps' }, h('span', { html: diamondChain(cfg.laps, 0, 0, { size: 22, cls: 'chain lapchain' }) }), h('span', { class: 'laps-t' }, `${cfg.laps} 圈`)),
          prizeEl,
          h('p', { class: 'f-label' }, '對手'),
          rivals)),
      actions));
  return { root, initial: '#i-go', onBack: back };
}
