// 車庫：輪胎／引擎／避震／氮氣 0..5 級（菱形格），價格逐級上升；臨時氮氣瓶；繼續下一站。
import { h, fmtMoney } from './dom.js';
import { diamondChain, nitroCan } from './art.js';
import { UPGRADES, MAX_LEVEL, TRACKS } from '../game/consts.js';
import { NITRO_CAN_PRICE } from '../game/career.js';

export function garageScreen(app) {
  const c = app.career;
  const body = h('div', { class: 'gar-body' });
  const wallet = h('p', { class: 'wallet' });
  const root = h('section', { class: 'scr scr-garage' },
    h('div', { class: 'board garage' },
      h('div', { class: 'gar-top' }, h('h2', { class: 'b-title' }, '車庫'), wallet),
      body));

  const stat = (kind, lv) => {
    try { return app.core.upgradeStat(kind, lv); } catch (e) { return NaN; }
  };

  function buy(key) {
    if (app.buy(key)) render(key === 'can' ? 'g-can' : 'g-' + key);
    else {
      const b = root.querySelector(key === 'can' ? '#g-can' : '#g-' + key);
      if (b) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }
      app.sfx('ui_back');
    }
  }

  function render(focusId) {
    const d = c.data;
    wallet.innerHTML = `<span>資金</span><b>${fmtMoney(d.money)}</b>`;
    body.textContent = '';
    const grid = h('div', { class: 'ups' });
    for (const u of UPGRADES) {
      const lv = d.upgrades[u.key];
      const price = c.price(u.key);
      const max = lv >= MAX_LEVEL;
      const now = stat(u.kind, lv);
      const nxt = max ? NaN : stat(u.kind, lv + 1);
      const afford = !max && price <= d.money;
      const b = h('button', {
        type: 'button', 'data-nav': '', id: 'g-' + u.key, class: 'buy' + (afford ? '' : ' off'),
        'aria-disabled': afford ? null : 'true', onclick: () => buy(u.key),
      }, max ? '已滿級' : h('span', null, '升級 ', h('b', null, fmtMoney(price))));
      grid.append(h('div', { class: 'up' },
        h('div', { class: 'up-h' }, h('h3', null, u.name), h('span', { class: 'up-en' }, u.en)),
        h('div', { class: 'up-pips', html: diamondChain(MAX_LEVEL, lv, 0, { size: 26, cls: 'chain pips', label: `${u.name} ${lv} 級，最高 ${MAX_LEVEL} 級` }) }),
        h('p', { class: 'up-stat' }, h('span', null, u.stat), h('b', null, Number.isFinite(now) ? u.fmt(now) : '--'),
          max ? null : h('span', { class: 'arr', 'aria-label': '升級後' }, '→'),
          max ? null : h('b', { class: 'nx' }, Number.isFinite(nxt) ? u.fmt(nxt) : '--')),
        b));
    }
    // 臨時氮氣瓶：只用下一場
    const room = c.nitroCanRoom();
    const canOk = room > 0 && d.money >= NITRO_CAN_PRICE;
    let cans = '';
    for (let i = 0; i < d.extraNitro; i++) cans += nitroCan(true);
    const extra = h('div', { class: 'up extra' },
      h('div', { class: 'up-h' }, h('h3', null, '臨時氮氣瓶'), h('span', { class: 'up-en' }, 'SPARE CAN')),
      h('p', { class: 'up-stat' }, h('span', null, '只用下一場，已備'), h('b', null, d.extraNitro + ' 瓶'), h('span', { class: 'cans', html: cans })),
      h('p', { class: 'b-note' }, room > 0 ? `下一場還能多帶 ${room} 瓶` : '氮氣等級加臨時瓶已到上限'),
      h('button', { type: 'button', 'data-nav': '', id: 'g-can', class: 'buy' + (canOk ? '' : ' off'), 'aria-disabled': canOk ? null : 'true', onclick: () => buy('can') },
        room > 0 ? h('span', null, '多帶一瓶 ', h('b', null, fmtMoney(NITRO_CAN_PRICE))) : '已帶滿'));

    const nr = c.nextRace();
    const meta = TRACKS[nr.trackId] || { zh: '' };
    const sk = nr.rivals.map((r) => Math.round(r.skill * 100));
    const lv = nr.rivals.map((r) => UPGRADES.reduce((s, u) => s + r.up[u.key], 0));
    const rivalNote = h('p', { class: 'b-note rival-note' },
      `下一站對手：技巧 ${Math.min(...sk)}–${Math.max(...sk)}，改裝 ${Math.min(...lv)}–${Math.max(...lv)} 級。他們的技巧每一站都會提升，改裝會跟著你的等級走。`);

    const next = h('button', { type: 'button', 'data-nav': '', class: 'act go', id: 'g-next', onclick: () => app.go('intro', { mode: 'tour' }) },
      `繼續：第 ${nr.season} 季 第 ${nr.round + 1} 站 ${meta.zh}`);
    body.append(grid, extra, rivalNote, h('div', { class: 'row-actions' }, next,
      h('button', { type: 'button', 'data-nav': '', class: 'act back', onclick: () => app.go('title') }, '存檔並回標題')));
    if (!root.isConnected) return; // 第一次繪製時 nav 還沒接上這個畫面
    const el = focusId && root.querySelector('#' + focusId);
    if (el) app.nav.focus(el);
    else app.nav.refresh();
  }

  render();
  return { root, initial: '#g-next', onBack: () => app.go('intro', { mode: 'tour' }), rerender: () => render(app.nav.current && app.nav.current.id) };
}
