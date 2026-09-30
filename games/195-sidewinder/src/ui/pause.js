// 暫停：繼續／重新開始／操控設定／離開比賽。
import { h } from './dom.js';

export function pauseScreen(app) {
  const mode = (app.race.config && app.race.config.mode) || 'practice';
  const b = (id, label, fn, cls = 'sign') => h('button', { type: 'button', 'data-nav': '', id, class: cls, onclick: fn }, h('span', { class: 'sign-t' }, label));
  const root = h('section', { class: 'scr scr-pause' },
    h('div', { class: 'board pause', role: 'dialog', 'aria-label': '暫停' },
      h('h2', { class: 'b-title' }, '暫停'),
      h('div', { class: 'signs' },
        b('p-resume', '繼續比賽', () => app.resume()),
        b('p-restart', '重新開始這一場', () => app.restartRace()),
        app.spinnerInUse() ? b('p-lock', '鎖定游標並繼續（旋轉方向盤）', () => app.resume({ lock: true })) : null,
        b('p-set', '操控設定', () => app.go('settings', { tab: 'input', from: 'pause' })),
        b('p-quit', mode === 'tour' ? '棄賽回標題（不計成績）' : '離開練習', () => app.quitRace()))));
  return { root, initial: '#p-resume', onBack: () => app.resume() };
}
