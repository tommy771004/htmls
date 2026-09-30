// 標題畫面（背景跑示範賽）與練習賽選道。
import { h, fmtMoney, esc } from './dom.js';
import { wordmark, icon } from './art.js';
import { miniMap } from './minimap.js';
import { TRACKS } from '../game/consts.js';

// 路標式選單：一根木樁上釘著箭頭木牌
function signpost(items) {
  const post = h('div', { class: 'post', 'aria-hidden': 'true' });
  const list = h('div', { class: 'signs', role: 'menu' });
  items.forEach((it, i) => {
    const b = h('button', { type: 'button', 'data-nav': '', role: 'menuitem', class: 'sign', style: { '--tilt': (i % 2 ? 0.7 : -0.9) + 'deg' }, onclick: it.onClick },
      h('span', { class: 'sign-t' }, it.label),
      it.sub ? h('span', { class: 'sign-s' }, it.sub) : null);
    if (it.id) b.id = it.id;
    list.append(b);
  });
  return h('nav', { class: 'signpost', 'aria-label': '主選單' }, post, list);
}

export function titleScreen(app) {
  const c = app.career;
  const has = c.hasSave();
  const d = c.data;
  let armed = false;
  const items = [];
  const startItem = {
    id: 'm-new',
    label: '開始巡迴賽',
    sub: has ? '會覆蓋目前的存檔' : '一季四站，贏獎金改車',
    onClick: (e) => {
      if (has && !armed) {
        armed = true;
        const b = e.currentTarget;
        b.querySelector('.sign-t').textContent = '再按一次：重新開始';
        b.classList.add('warn');
        return;
      }
      c.newCareer();
      app.go('intro', { mode: 'tour' });
    },
  };
  if (has) {
    items.push({
      id: 'm-cont',
      label: '繼續',
      sub: `第 ${d.season} 季 第 ${d.round + 1} 站 · ${fmtMoney(d.money)}`,
      onClick: () => app.go('intro', { mode: 'tour' }),
    });
  }
  items.push(startItem);
  items.push({ id: 'm-prac', label: '單場練習', sub: '自選賽道，不計獎金', onClick: () => app.go('practice') });
  items.push({ id: 'm-ctl', label: '操控設定', sub: '鍵盤、手把、旋轉方向盤', onClick: () => app.go('settings', { tab: 'input', from: 'title' }) });
  items.push({ id: 'm-snd', label: '音效', sub: '音量與靜音', onClick: () => app.go('settings', { tab: 'audio', from: 'title' }) });

  const sources = h('ul', { class: 'sources', 'aria-label': '偵測到的輸入' });
  const root = h('section', { class: 'scr scr-title' },
    h('div', { class: 'title-head' },
      h('h1', { class: 'title-mark', html: wordmark('tw') + '<span class="vh">響尾蛇越野 SIDEWINDER</span>' }),
      h('p', { class: 'title-sub' }, '響尾蛇越野 · 四車同場，一季四站')),
    signpost(items),
    sources,
  );

  let tAcc = 1;
  function paintSources() {
    const src = app.inputSources();
    sources.innerHTML = src.map((s) => `<li class="${s.on ? 'on' : ''}">${icon(s.icon)}<span>${esc(s.label)}</span></li>`).join('');
  }
  paintSources();
  return {
    root,
    initial: has ? '#m-cont' : '#m-new',
    update(dt) {
      tAcc += dt;
      if (tAcc > 0.5) { tAcc = 0; paintSources(); }
    },
  };
}

export function practiceScreen(app) {
  const cards = h('div', { class: 'tracks' });
  app.tracks.parsed.forEach((t, i) => {
    const meta = TRACKS[i] || { zh: t.name, en: t.name };
    const best = app.bestLap(i);
    cards.append(h('button', { type: 'button', 'data-nav': '', class: 'tcard', onclick: () => app.go('intro', { mode: 'practice', trackId: i }) },
      h('span', { class: 'tc-no' }, String(i + 1)),
      h('span', { class: 'tc-map', html: miniMap(t) }),
      h('span', { class: 'tc-name' }, meta.zh),
      h('span', { class: 'tc-en' }, meta.en),
      h('span', { class: 'tc-best' }, best ? '最佳單圈 ' + best : '尚無紀錄')));
  });
  const root = h('section', { class: 'scr scr-practice' },
    h('div', { class: 'board wide' },
      h('h2', { class: 'b-title' }, '單場練習'),
      h('p', { class: 'b-note' }, '用目前車庫的改裝跑一場，不計獎金。'),
      cards,
      h('div', { class: 'row-actions' }, h('button', { type: 'button', 'data-nav': '', class: 'act back', onclick: () => app.go('title') }, '返回'))));
  return { root, onBack: () => app.go('title') };
}
