// HUD：速度、冷氣表、空力／吸附／燈光／鏡頭狀態、任務清單、計時與分段、獎牌表、特技彈出字、聯賽比分。
// 只改 DOM，不碰遊戲狀態。每幀 frame() 更新數值，事件用 event() 觸發彈出。
import { OBJECTIVES } from '../core/stunt.js';
import { TA } from '../core/park.js';
import { CAR, MPH } from '../core/const.js';
import { TEAM_NAMES } from '../core/league.js';

const $ = (id) => document.getElementById(id);
export const fmtTime = (t, ms = true) => {
  if (t == null || !Number.isFinite(t)) return '--:--' + (ms ? '.---' : '');
  const m = Math.floor(t / 60), s = t - m * 60;
  const whole = Math.floor(s);
  const out = `${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')}`;
  return ms ? `${out}.${String(Math.floor((s - whole) * 1000)).padStart(3, '0')}` : out;
};
const fmtDelta = (d) => (d < 0 ? '−' : '+') + Math.abs(d).toFixed(3);
const LIGHTS = ['OFF', 'LOW', 'HIGH'];
const MEDALS = [['author', 'AUTHOR', '作者'], ['gold', 'GOLD', '金'], ['silver', 'SILVER', '銀'], ['bronze', 'BRONZE', '銅']];

export class Hud {
  constructor() {
    this.el = $('hud');
    this.units = 'mph';
    const bar = $('gasBar');
    bar.innerHTML = '<i></i>'.repeat(20);
    this.segs = [...bar.children];
    this.trickT = 0; this.toastT = 0; this.hintT = 0; this.bannerT = 0;
    this.lastSpeed = -1; this.lastGas = -1;
    this.speedV = $('speedV'); this.speedFill = $('speedFill');
  }

  show(mode) {
    this.mode = mode;
    this.el.classList.toggle('hide', !mode);
    if (!mode) return;
    const names = { free: 'FREE RIDE', ta: 'TIME ATTACK', league: 'ROADSTER LEAGUE' };
    $('hudModeName').textContent = names[mode] || '';
    $('objectives').classList.toggle('hide', mode !== 'free');
    $('score').classList.toggle('hide', mode !== 'free');
    $('medals').classList.toggle('hide', mode !== 'ta');
    $('ta').classList.toggle('hide', mode !== 'ta');
    $('lg').classList.toggle('hide', mode !== 'league');
    $('lgRoster').classList.toggle('hide', mode !== 'league');
    $('lgBanner').classList.add('hide');
    $('count').classList.add('hide');
    $('wrong').classList.add('hide');
    $('trick').style.opacity = 0;
    $('hint').style.opacity = 0;
    $('taSplit').style.opacity = 0;
    $('toast').classList.add('off');
    this.trickT = this.toastT = this.hintT = 0;
  }

  setUnits(u) { this.units = u; $('speedU').textContent = u === 'kmh' ? 'KM/H' : 'MPH'; this.lastSpeed = -1; }

  objectives(done) {
    const ul = $('objList');
    ul.innerHTML = '';
    let n = 0;
    for (const o of OBJECTIVES) {
      const li = document.createElement('li');
      li.dataset.id = o.id;
      li.innerHTML = `<span>${o.text}${o.key ? ` <small>· ${o.key}</small>` : ''}</span>`;
      if (done[o.id]) { li.classList.add('done'); n++; }
      ul.appendChild(li);
    }
    $('objCount').textContent = `${n}/${OBJECTIVES.length}`;
    $('objectives').classList.toggle('min', n === OBJECTIVES.length);
    this.markLater();
  }

  // 手機版只列前三個還沒完成的任務
  markLater() {
    let k = 0;
    for (const li of document.querySelectorAll('#objList li')) li.classList.toggle('later', !li.classList.contains('done') && k++ >= 3);
  }

  medals(best, world) {
    const m = TA.medals, el = $('medals');
    let h = '';
    for (const [k, label] of MEDALS) h += `<i class="medal ${k}"></i><span>${label}</span><span class="v">${fmtTime(m[k])}</span>`;
    h += '<hr>';
    h += `<i></i><span>PB 個人</span><span class="v">${best ? fmtTime(best) : '--:--.---'}</span>`;
    h += `<i></i><span>WR 世界</span><span class="v">${world ? fmtTime(world) : '--:--.---'}</span>`;
    el.innerHTML = h;
  }

  // st：車輛狀態；extra：模式相關數字
  frame(dt, st, extra = {}) {
    const sp = st.speed * (this.units === 'kmh' ? 3.6 : MPH);
    const v = Math.min(999, Math.round(sp));
    if (v !== this.lastSpeed) {
      this.lastSpeed = v;
      const s = String(v).padStart(3, '0');
      const lead = v < 10 ? 2 : v < 100 ? 1 : 0;
      this.speedV.innerHTML = `<s>${s.slice(0, lead)}</s>${s.slice(lead)}`;
      this.speedFill.style.transform = `scaleX(${Math.min(1, st.speed / CAR.MAX_SPEED).toFixed(3)})`;
    }
    const g = Math.round(st.gas);
    if (g !== this.lastGas) {
      this.lastGas = g;
      $('gasV').textContent = g;
      const on = Math.round(g / 5);
      this.segs.forEach((s, i) => s.classList.toggle('on', i < on));
      $('gas').classList.toggle('low', g < 20);
    }
    const using = st.boosting || st.hovering;
    $('gasMode').classList.toggle('on', using);
    $('gasModeT').textContent = st.hovering ? 'HOVER · 升力' : 'THRUST · 推進';
    this.setTog('tgAero', st.aero, st.aero !== 'AUTO');
    this.setTog('tgSuc', st.suction, st.suction === 'WALL');
    this.setTog('tgLights', LIGHTS[st.lights], st.lights === 2);
    if (extra.cam) this.setTog('tgCam', extra.cam.toUpperCase(), extra.cam !== 'chase');
    if (extra.score != null) $('scoreV').textContent = extra.score.toLocaleString('en-US');
    if (extra.ta) {
      const T = extra.ta;
      const t = T.phase === 'countdown' ? 0 : T.time;
      const s = fmtTime(t);
      $('taTime').innerHTML = `${s.slice(0, 5)}<small>${s.slice(5)}</small>`;
      $('taCp').textContent = `CHECKPOINT ${Math.min(T.next, 5)}/5`;
    }
    if (extra.league) this.league(extra.league);
    // 計時淡出
    this.fade('trick', (this.trickT -= dt));
    this.fade('hint', (this.hintT -= dt));
    if ((this.toastT -= dt) <= 0) $('toast').classList.add('off');
    if (this.splitT != null && (this.splitT -= dt) <= 0) { $('taSplit').style.opacity = 0; this.splitT = null; }
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) $('lgBanner').classList.add('hide');
    if (this.countT != null && (this.countT -= dt) <= 0) { $('count').classList.add('hide'); this.countT = null; }
  }

  setTog(id, text, hot) {
    const b = $(id);
    if (b.textContent !== text) b.textContent = text;
    b.parentElement.classList.toggle('hot', !!hot);
  }

  fade(id, t) { const el = $(id); const o = t > 0 ? Math.min(1, t * 3) : 0; if (el.style.opacity !== String(o)) el.style.opacity = o; }

  cam(mode) { $('hudCam').textContent = `CAM · ${mode.toUpperCase()}`; }

  toast(text, t = 2.4) { const el = $('toast'); el.textContent = text; el.classList.remove('off'); this.toastT = t; }

  hint(big, small, t = 3.5) { $('hintB').textContent = big; $('hintS').textContent = small || ''; this.hintT = t; }

  trick(name, line, pts, sub = '', bail = false) {
    const el = $('trick');
    $('trickName').textContent = name;
    $('trickL').textContent = line;
    $('trickP').textContent = pts;
    $('trickSub').textContent = sub;
    el.classList.toggle('bail', bail);
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    this.trickT = 2.2;
  }

  count(n) {
    const el = $('count');
    el.textContent = n === 0 ? 'GO' : String(n);
    el.classList.toggle('go', n === 0);
    el.classList.remove('hide');
    this.countT = n === 0 ? 0.8 : 1.1;
  }

  split(i, time, delta) {
    $('taSplitT').textContent = `CP ${i + 1}/5 · ${fmtTime(time)}`;
    const d = $('taSplitD');
    if (delta == null) d.classList.add('hide');
    else { d.classList.remove('hide'); d.textContent = fmtDelta(delta); d.classList.toggle('late', delta > 0); }
    $('taSplit').style.opacity = 1;
    this.splitT = 3;
  }

  wrong(on) { $('wrong').classList.toggle('hide', !on); }

  completeObjective(id, count) {
    const li = document.querySelector(`#objList li[data-id="${id}"]`);
    if (li) { li.classList.add('done', 'flash'); }
    $('objCount').textContent = `${count}/${OBJECTIVES.length}`;
    if (count === OBJECTIVES.length) $('objectives').classList.add('min');
    this.markLater();
  }

  league(L) {
    $('lgS0').textContent = L.score[0]; $('lgS1').textContent = L.score[1];
    const c = Math.ceil(L.clock);
    $('lgT').textContent = L.overtime ? `+${fmtTime(L.ot || 0, false).slice(1)}` : `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`;
    $('lgSub').textContent = L.sub || '';
  }

  roster(list, myId) {
    const el = $('lgRoster');
    el.innerHTML = '';
    for (const t of [0, 1]) for (const p of list.filter((x) => x.team === t)) {
      const d = document.createElement('div');
      d.innerHTML = `<i style="background:var(--team${t})"></i><span></span>`;
      d.lastChild.textContent = p.name + (p.id === myId ? '（你）' : '') + (p.bot ? ' · AI' : '');
      el.appendChild(d);
    }
  }

  banner(big, small, team = null, t = 3) {
    const el = $('lgBanner');
    $('lgBig').textContent = big;
    $('lgBig').style.color = team == null ? '' : `var(--team${team})`;
    $('lgSmall').textContent = small || '';
    el.classList.remove('hide');
    this.bannerT = t;
  }
}

export { TEAM_NAMES };
