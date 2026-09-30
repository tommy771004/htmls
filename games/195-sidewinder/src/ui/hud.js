// 比賽 HUD：名次塔（看板木條）、圈數菱形鏈、速度、氮氣瓶、本場獎金、倒數與橫幅、除錯資訊。
import { h, fmtMoney, fmtTime, setText } from './dom.js';
import { diamondChain, diamond, nitroCan } from './art.js';
import { miniMap } from './minimap.js';
import { header, trucks } from '../game/state.js';
import { PHASE, EV, TRACKS, SURF_NAME, AI_MODE_NAME, TRUCK0, T } from '../game/consts.js';

export function createHud(root, app) {
  const rows = [0, 1, 2, 3].map(() => {
    const li = h('li', { class: 'tw-row' },
      h('span', { class: 'tw-pos' }),
      h('span', { class: 'tw-c' }),
      h('span', { class: 'tw-n' }),
      h('span', { class: 'tw-l' }),
      h('span', { class: 'tw-g' }));
    return li;
  });
  const tower = h('ol', { class: 'tower', 'aria-label': '名次' }, rows);
  const trackName = h('p', { class: 'r-track' });
  const lapChain = h('span', { class: 'r-chain' });
  const lapText = h('span', { class: 'r-lapt' });
  const lapTime = h('span', { class: 'r-lapclock' });
  const spd = h('b', { class: 'spd-v' }, '0');
  const cans = h('span', { class: 'cans' });
  const cash = h('span', { class: 'cash-v' }, '$0');
  const flash = h('span', { class: 'r-flash', 'aria-live': 'polite' });
  const me = h('p', { class: 'r-me' });
  const map = h('div', { class: 'r-map', 'aria-hidden': 'true' });
  let dots = [];

  const rail = h('aside', { class: 'rail', 'aria-label': '比賽資訊' },
    h('div', { class: 'r-head' }, trackName, me),
    tower,
    h('div', { class: 'r-lap' }, lapChain, h('span', { class: 'r-lapcol' }, lapText, lapTime)),
    map,
    h('div', { class: 'r-stats' },
      h('div', { class: 'st spd' }, spd, h('small', null, 'km/h')),
      h('div', { class: 'st nit' }, cans, h('small', null, '氮氣')),
      h('div', { class: 'st cash' }, cash, h('small', null, '本場獎金'))),
    flash);

  const count = h('div', { class: 'count', 'aria-live': 'assertive' });
  const banner = h('div', { class: 'banner' }, h('span', { class: 'bn-t' }), h('span', { class: 'bn-s' }));
  const center = h('div', { class: 'hud-center' }, count, banner);
  const pauseBtn = h('button', { type: 'button', class: 'pause-btn', 'aria-label': '暫停', onclick: () => app.pause() }, h('span'), h('span'));
  const dbg = h('pre', { class: 'dbg', hidden: !app.debug });
  root.append(rail, center, pauseBtn, dbg);

  let lastKey = '';
  let chainKey = '';
  let cansKey = '';
  let wrongWay = false;
  let bannerT = 0;
  let flashT = 0;
  let fpsAcc = 0;
  let fpsN = 0;
  let fps = 0;
  let lastCount = '';

  function setupRace(cfg) {
    const meta = TRACKS[cfg.trackId] || { zh: '', en: '' };
    // 中文名＋窄體英文名，一行放得下，四條賽道的名次塔起點一致
    trackName.replaceChildren(meta.zh, h('span', { class: 'r-en' }, meta.en));
    const colors = app.seatColors();
    const names = app.seatNames();
    rows.forEach((li, k) => {
      li.dataset.k = k;
      li.classList.toggle('me', k === 0);
      li.querySelector('.tw-c').innerHTML = diamond(colors[k], 14);
      setText(li.querySelector('.tw-n'), names[k]);
      li.style.setProperty('--i', k);
    });
    me.innerHTML = diamond(colors[0], 12) + '<span>你開 ' + app.colorName(0) + '</span>';
    // 欄內小地圖：viewBox 就是世界座標，車點直接用 x,z
    map.innerHTML = miniMap(app.tracks.parsed[cfg.trackId], { cls: 'minimap' });
    const svg = map.firstElementChild;
    const NS = 'http://www.w3.org/2000/svg';
    dots = [3, 2, 1, 0].map((k) => {
      const c = document.createElementNS(NS, 'path');
      c.setAttribute('d', k === 0 ? 'M0 -2.6L2 0L0 2.6L-2 0Z' : 'M0 -1.9L1.5 0L0 1.9L-1.5 0Z');
      c.setAttribute('fill', colors[k]);
      c.setAttribute('stroke', '#170e08');
      c.setAttribute('stroke-width', '0.5');
      svg.append(c);
      return { k, c };
    });
    lastKey = chainKey = cansKey = '';
    wrongWay = false;
    rail.classList.remove('flashing');
    bannerT = 0;
    flashT = 0;
    banner.classList.remove('show');
    flash.classList.remove('show');
    count.classList.remove('show');
    lastCount = '';
  }

  function showBanner(t, s = '', sec = 2.2) {
    setText(banner.querySelector('.bn-t'), t);
    setText(banner.querySelector('.bn-s'), s);
    banner.classList.remove('show', 'warn');
    void banner.offsetWidth; // 重新觸發動畫
    banner.classList.add('show');
    bannerT = sec;
  }
  function showFlash(t, sec = 1.6) {
    setText(flash, t);
    flash.classList.add('show');
    rail.classList.add('flashing'); // 直式版面浮字和「你開 …」同一角：浮字期間先藏起來
    flashT = sec;
  }

  // 比賽事件 → 橫幅、浮字
  function onEvents(evs, s) {
    for (const e of evs) {
      if ((e.truck | 0) !== 0) continue;
      switch (e.type | 0) {
        case EV.FINAL_LAP: showBanner('最後一圈', '全力衝'); break;
        case EV.FINISH: {
          const p = Math.round(e.a) || 0;
          // b = 1：時限到被 core 收尾，不算完賽
          if ((e.b | 0) === 1) showBanner('時間到', '未完賽', 3);
          else showBanner('完賽', p ? `第 ${p} 名` : '', 3);
          break;
        }
        case EV.WRONG_WAY:
          // core：逆向超過 1 秒 a=1，轉回正向 a=0
          if (e.a > 0.5) { wrongWay = true; showBanner('逆向', '方向反了，掉頭', 1e9); banner.classList.add('warn'); }
          else if (wrongWay) { wrongWay = false; bannerT = 0.01; }
          break;
        case EV.LAP: {
          // 單圈時間以 core 的「上一圈」為準（core 從第一次過線才開始計；進行中的碼錶讀表頭 9）
          const lt = s ? s[TRUCK0 + T.LAST_LAP] : 0;
          if (lt > 0.5) showFlash(`第 ${Math.round(e.a)} 圈 ${fmtTime(lt)}`);
          break;
        }
        case EV.PICKUP:
          if ((e.a | 0) === 2) showFlash('錢袋 +' + fmtMoney(e.b));
          else showFlash('氮氣瓶 +1');
          break;
        case EV.OVERTAKE:
          showFlash(`升到第 ${Math.round(e.a)} 名`, 1.2);
          break;
        default: break;
      }
    }
  }

  function update(dt, raceGaps) {
    const s = app.core.state();
    const hd = header(s);
    const ts = trucks(s);
    const pl = ts[0];
    const laps = hd.laps || 4;

    // 名次塔
    const order = ts.slice().sort((a, b) => (a.pos || 9) - (b.pos || 9) || (b.laps + b.lapProg) - (a.laps + a.lapProg));
    const key = order.map((t) => t.k).join('');
    if (key !== lastKey) {
      order.forEach((t, i) => rows[t.k].style.setProperty('--i', i));
      lastKey = key;
    }
    order.forEach((t, i) => {
      const li = rows[t.k];
      setText(li.querySelector('.tw-pos'), String(i + 1));
      setText(li.querySelector('.tw-l'), `${Math.min(laps, t.laps + (t.finished ? 0 : 1))}/${laps}`);
      let g;
      if (t.finished) g = '完賽';
      else if (t.dnf) g = '未完賽';
      else if (i === 0) g = hd.phase === PHASE.RACE ? '領先' : '';
      else g = raceGaps && raceGaps[t.k] > 0.05 ? '+' + raceGaps[t.k].toFixed(1) : '';
      setText(li.querySelector('.tw-g'), g);
    });

    // 圈數鏈
    const done = Math.min(laps, pl.laps);
    const part = pl.finished ? 0 : Math.round(Math.max(0, Math.min(1, pl.lapProg)) * 20) / 20;
    const ck = laps + ':' + done + ':' + part;
    if (ck !== chainKey) {
      lapChain.innerHTML = diamondChain(laps, done, part, { size: 20, cls: 'chain lapchain', label: `已完成 ${done} 圈，共 ${laps} 圈` });
      chainKey = ck;
    }
    setText(lapText, pl.finished ? '完賽' : `第 ${Math.min(laps, done + 1)} / ${laps} 圈`);
    // 本圈碼錶：core 在第一次過起終點線（上線）才開始計第 1 圈，上線前顯示 0:00.00
    const running = hd.phase === PHASE.RACE && !pl.finished && !pl.dnf;
    setText(lapTime, running ? (hd.lapStart >= 0 ? fmtTime(Math.max(0, hd.time - hd.lapStart)) : '0:00.00') : pl.finished ? fmtTime(pl.finishT) : pl.dnf ? '未完賽' : '0:00.00');

    for (const d of dots) {
      const t = ts[d.k];
      d.c.setAttribute('transform', `translate(${t.x.toFixed(2)} ${t.z.toFixed(2)})`);
    }

    setText(spd, String(Math.round(Math.abs(pl.speed) * 3.6)));
    const burning = pl.nitroT > 0;
    const nk = pl.nitroCans + ':' + burning;
    if (nk !== cansKey) {
      const n = Math.max(0, Math.min(10, pl.nitroCans));
      let out = '';
      for (let i = 0; i < n; i++) out += nitroCan(true, false);
      if (burning) out = nitroCan(true, true) + out;
      if (!out) out = '<span class="empty">用完了</span>';
      cans.innerHTML = out;
      cansKey = nk;
    }
    setText(cash, fmtMoney(pl.cash));

    // 倒數
    let c = '';
    if (hd.phase === PHASE.COUNTDOWN) c = String(Math.max(1, Math.ceil(hd.countdown - 1e-4)));
    else if (hd.phase === PHASE.RACE && hd.time < 0.9) c = '出發';
    if (c !== lastCount) {
      count.classList.remove('show');
      if (c) {
        setText(count, c);
        count.classList.toggle('word', c.length > 1);
        void count.offsetWidth;
        count.classList.add('show');
      }
      lastCount = c;
    }

    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.classList.remove('show', 'warn'); }
    if (flashT > 0) { flashT -= dt; if (flashT <= 0) { flash.classList.remove('show'); rail.classList.remove('flashing'); } }

    if (app.debug) {
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
      dbg.textContent = `fps ${fps.toFixed(0)}  t ${hd.time.toFixed(2)}  phase ${hd.phase}\n`
        + ts.map((t) => `${t.k} ${t.isAi ? 'AI ' + (AI_MODE_NAME[t.aiMode] || t.aiMode) : '玩家'}  ${SURF_NAME[t.surface] || t.surface}${t.air ? ' 滯空' : ''}  ${(t.speed * 3.6).toFixed(0)}km/h`).join('\n');
    }
  }

  // 版面：hud-center 蓋在賽道範圍上
  function place(rect) {
    if (!rect) return;
    Object.assign(center.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
  }

  return { setupRace, update, onEvents, place, showBanner, rail };
}
