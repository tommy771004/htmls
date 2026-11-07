// 主選單、暫停、賽果。分頁都是真內容：開戰、軍械（WEAPONS 數值）、簡報（雷達與 RULES）、操作、設定、署名；
// 直式手機多一頁隊伍。隊伍名單來自 NAMES，戰績來自 record.js，沒有的東西不顯示。
import { input } from '../core/input.js';
import { setVolume } from '../audio/sfx.js';
import { WEAPONS, GEAR, RULES, TEAM_NAME, TEAM_COLOR, NAMES } from '../game/state.js';
import { LAYOUT } from '../map/layout.js';
import { ASSET_BASE } from '../core/assets.js';
import { record, clearRecord, loadSettings, saveSettings } from '../game/record.js';
import { COLS, DESC, SPEC, statRows } from './buy.js';

const CHECK = '<svg class="m-chk" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"><path d="M4.500 12.500 10 18 19.500 6.500"/></svg>';
const GNOMON = '<svg class="m-gno" viewBox="0 0 40 40" aria-hidden="true" fill="currentColor"><path d="M4 34V5l32 29z"/></svg>';
const POWER = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.600 6.600a8 8 0 1 0 10.800 0"/></svg>';
const MODES = [
  { id: 'atk', name: '赤沙', sub: '攻方，把裝藥送進炸點', c: TEAM_COLOR[0] },
  { id: 'def', name: '海防', sub: '守方，守住或拆除裝藥', c: TEAM_COLOR[1] },
  { id: 'rand', name: '隨機', sub: '開賽時抽邊', c: '#b9a988' },
];
const TABS = [['play', '開戰'], ['team', '隊伍'], ['arms', '軍械'], ['brief', '簡報'], ['keys', '操作'], ['set', '設定'], ['about', '署名']];
const SIDE_GUN = { atk: 'ks', def: 'ar5', rand: 'ks' };
const R = RULES;

const pct = (v, lo, hi) => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%';
function mapHtml() {
  const b = LAYOUT.bounds, X = v => pct(v, b.x0, b.x1), Y = v => pct(b.z1 - v + b.z0, b.z0, b.z1), S = LAYOUT.sites;
  const site = n => `<u style="left:${X(S[n].x0)};top:${Y(S[n].z1)};width:${pct(S[n].x1 - S[n].x0, 0, b.x1 - b.x0)};height:${pct(S[n].z1 - S[n].z0, 0, b.z1 - b.z0)}">${n}</u>`;
  const spawn = (list, name, c) => { const x = list.reduce((a, p) => a + p.x, 0) / list.length, z = list.reduce((a, p) => a + p.z, 0) / list.length; return `<em style="left:${X(x)};top:${Y(z)};--c:${c}">${name}</em>`; };
  return `<div class="m-map"><img src="${ASSET_BASE}radar.webp" alt="日晷坊俯視圖" draggable="false">${site('A')}${site('B')}${spawn(LAYOUT.spawns.atk, '赤沙出發', TEAM_COLOR[0])}${spawn(LAYOUT.spawns.def, '海防出發', TEAM_COLOR[1])}</div>`;
}
const rule = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
const keys = rows => `<table>${rows.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>`;

function shell() {
  return `<nav class="m-nav"><h1 class="m-logo">赭線<small>OCHRE LINE</small></h1>
  <div class="m-tabs" role="tablist" aria-label="主選單">${TABS.map(([id, t], i) => `<button role="tab" type="button" data-tab="${id}" class="${id === 'team' ? 'm-narrow' : ''}" aria-selected="${i ? 'false' : 'true'}" tabindex="${i ? -1 : 0}">${t}</button>`).join('')}</div>
  <a class="m-exit" href="../index.html" title="離開遊戲，回作品集" aria-label="離開遊戲，回作品集">${POWER}<span>離開</span></a><i class="m-line"></i></nav>
  <div class="m-body">
    <section class="m-page" id="p-play">
      <div class="m-left">
        <div id="m-rec" class="m-cut"></div>
        <div class="m-modes" role="radiogroup" aria-label="選邊">${MODES.map((m, i) => `<button type="button" role="radio" class="m-mode" data-mode="${m.id}" aria-checked="${i ? 'false' : 'true'}"><i class="m-sil" style="--c:${m.c}"></i><span><b>${m.name}</b><small>${m.sub}</small></span>${CHECK}</button>`).join('')}</div>
        <button type="button" id="m-go" class="m-cut" data-s="atk"><span><b>開始比賽</b><small id="m-gosub"></small></span>${GNOMON}</button>
        <div id="m-card"></div>
      </div>
      <div class="m-right"><aside id="m-roster"></aside><p class="m-foot"><span id="m-fps"></span>受 @0xKense1 影片啟發的原創作品，與 Valve／Counter-Strike 無關。</p></div>
    </section>
    <section class="m-page" id="p-arms"><div class="m-sheet m-arms"><div class="m-list"></div><aside class="m-info"><i></i><div><h3></h3><div class="pr"></div><p></p></div><dl></dl></aside></div></section>
    <section class="m-page" id="p-brief"><div class="m-sheet m-brief">${mapHtml()}<div><h2>日晷坊，五對五回合制</h2><p>赤沙要把破門裝藥送進炸點 A 或 B，海防要守住或拆除。先贏 ${R.winTarget} 回合獲勝，第 ${R.half} 回合後換邊，金錢重置。</p>
      <dl>${rule('購買時間', `${R.buyTime} 秒，開打後 20 秒內還能買`)}${rule('回合時間', `${R.roundTime} 秒`)}${rule('安裝裝藥', `${R.plantTime} 秒`)}${rule('裝藥引爆', `${R.chargeTime} 秒`)}${rule('拆除', `${R.defuseTime} 秒，有拆彈鉗 ${R.defuseKit} 秒`)}${rule('起始金錢', `$${R.startMoney}`)}${rule('回合勝利', `+$${R.winMoney}`)}${rule('回合落敗', `+$${R.loseBase} 起，連敗每次 +$${R.loseStep}，上限 $${R.loseMax}`)}</dl></div></div></section>
    <section class="m-page" id="p-keys"><div class="m-sheet m-keys"><div><h2>鍵盤滑鼠</h2>${keys([['WASD', '移動'], ['Shift', '靜步'], ['Ctrl 或 C', '蹲下'], ['Space', '跳'], ['左鍵', '射擊'], ['右鍵', '開鏡'], ['R', '裝填'], ['E', '按住安裝或拆除'], ['B', '購買'], ['Tab', '計分板'], ['1–5', '切換武器'], ['Q', '上一把'], ['F', '檢視武器'], ['Esc', '暫停']])}</div>
      <div><h2>觸控</h2>${keys([['左下搖桿', '移動'], ['右半邊滑動', '轉向'], ['右下大鈕', '射擊'], ['上箭頭', '跳'], ['下箭頭', '蹲下'], ['環形箭頭', '裝填'], ['雙向箭頭', '切換武器與投擲物'], ['準星', '開鏡'], ['手掌', '按住安裝或拆除'], ['買', '購買，購買時間內出現']])}</div></div></section>
    <section class="m-page" id="p-set"><div class="m-sheet m-set"><h2>設定</h2><label>滑鼠靈敏度<output data-out="sens"></output><input data-set="sens" type="range" min="0.0006" max="0.006" step="0.0002"></label><label>開鏡靈敏度<output data-out="scope"></output><input data-set="scope" type="range" min="0.4" max="2" step="0.05"></label><label>音量<output data-out="vol"></output><input data-set="vol" type="range" min="0" max="1" step="0.05"></label><p>設定與戰績只存在這台裝置的瀏覽器。</p><button type="button" id="m-clear"></button></div></section>
    <section class="m-page" id="p-about"><div class="m-sheet m-about"><h2>署名與授權</h2><p>受 @0xKense1 影片啟發的原創作品，與 Valve／Counter-Strike 無關。</p>
      <h3>CC BY 4.0</h3><p>Urpo（R50、S8）、SK3D（V11）、Vextin（破片手雷）、polyowlstudios（煙霧彈、閃光彈）、britdawgmasterfunk（Military Character Kit 1.1）、Cransh（FPS Benelli M4 Animations 的手臂與袖子）、JUST（Hand With Gloves 手套）。</p>
      <h3>CC0</h3><p>Poly Haven 貼圖與天空、Quaternius 人物與動畫。</p><p>其餘模型自製。</p></div></section>
  </div>`;
}

let menu, pause, result, $ = {}, side = 'atk', acts, fpsTimer = 0, picked = 'ks', confirmClear = false;
const set = { sens: input.sens, scope: 1, vol: 0.8 };
const html = (s, cls = '') => { const d = document.createElement('div'); d.className = 'pn ' + cls; d.innerHTML = s; return d; };
const fmt = { sens: v => (v / 0.0022).toFixed(2) + ' 倍', scope: v => (+v).toFixed(2) + ' 倍', vol: v => Math.round(v * 100) + '%' };
const applyAll = () => { input.sens = set.sens; input.scopeSens = set.scope; setVolume(set.vol); for (const e of document.querySelectorAll('[data-set]')) e.value = set[e.dataset.set]; for (const e of document.querySelectorAll('[data-out]')) e.textContent = fmt[e.dataset.out](set[e.dataset.out]); };

function drawRoster() {
  const my = side === 'def' ? 1 : 0, rand = side === 'rand';
  const list = (head, c, names, me) => `<h3 style="--c:${c}"><i class="m-sil"></i>${head}</h3><ol style="--c:${c}">${names.map((n, i) => `<li class="${me && !i ? 'me' : ''}"><i class="m-sil"></i><span>${n}</span><small>${me && !i ? '玩家' : '電腦'}</small></li>`).join('')}</ol>`;
  $.roster.innerHTML = '<h2>隊伍 5 對 5</h2>' + list(rand ? '我方' : `${TEAM_NAME[my]} · 我方`, rand ? '#b9a988' : TEAM_COLOR[my], NAMES.slice(0, 5), true) + list(rand ? '對手' : `${TEAM_NAME[1 - my]} · 對手`, rand ? '#8d8068' : TEAM_COLOR[1 - my], NAMES.slice(5), false);
}
function drawRecord() {
  const r = record(), seen = r.matches > 0, rounds = r.roundsWon + r.roundsLost, c = side === 'def' ? TEAM_COLOR[1] : side === 'atk' ? TEAM_COLOR[0] : '#b9a988';
  $.rec.innerHTML = seen
    ? `<h2>本機戰績</h2><div class="big">${r.wins} 勝 ${r.matches - r.wins} 敗</div><p>擊殺／死亡 ${r.kills} / ${r.deaths}，上一場 ${r.last.my}:${r.last.opp}${r.last.win ? ' 勝' : ' 敗'}</p>`
    : `<h2>地圖 日晷坊</h2><div class="big">先贏 ${R.winTarget} 回合</div><p>第 ${R.half} 回合後換邊。尚無戰績</p>`;
  const rate = rounds ? r.roundsWon / rounds : 0;
  $.card.innerHTML = `<i class="m-sil" style="--c:${c}"></i><div><b>你</b><small>${seen ? `本機玩家，已打 ${r.matches} 場` : '本機玩家，尚無紀錄'}</small><div class="m-bar"><b style="width:${(rate * 100).toFixed(1)}%"></b></div><small>回合勝率 ${rounds ? Math.round(rate * 100) + '%' : '未有紀錄'}</small></div>`;
  $.clear.disabled = !seen; confirmClear = false; $.clear.textContent = seen ? '清除戰績' : '沒有戰績可清除';
}
function pickSide(id) {
  side = id; const mode = MODES.find(m => m.id === id);
  for (const b of $.modes) { const on = b.dataset.mode === id; b.setAttribute('aria-checked', String(on)); }
  $.go.dataset.s = id; $.gosub.textContent = id === 'rand' ? '開賽時抽邊，日晷坊' : `以${mode.name}進場，日晷坊`;
  drawRoster(); drawRecord(); showArm(SIDE_GUN[id]); acts.stage(id === 'rand' ? null : id, picked);
}
function line() {
  const t = menu.querySelector('[role=tab][aria-selected=true]'), n = t.parentNode.closest('nav').getBoundingClientRect(), r = t.getBoundingClientRect(), a = Math.round(r.left - n.left), b = Math.round(r.right - n.left), W = Math.round(n.width), k = 6;
  $.line.style.clipPath = `polygon(0 0,${a - k}px 0,${a}px ${k}px,${b}px ${k}px,${b + k}px 0,${W}px 0,${W}px 2px,${b + k + 1}px 2px,${b + 1}px 9px,${a - 1}px 9px,${a - k - 1}px 2px,0 2px)`;
}
function tab(id) {
  menu.dataset.tab = id;
  for (const b of $.tabs) { const on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
  line(); acts.aside(id !== 'play' && id !== 'team');
}
function showArm(id) {
  picked = id; const w = WEAPONS[id], g = GEAR[id], i = $.info;
  for (const k in $.it) $.it[k].setAttribute('aria-pressed', String(k === id));
  i.ic.className = w ? `ic ic-${id}` : ''; i.ic.style.display = w ? '' : 'none';
  i.h.textContent = w?.name ?? g.name; i.pr.textContent = (w?.price ?? g.price) ? '$' + (w?.price ?? g.price) : '開局配發'; i.p.textContent = DESC[id] ?? ''; i.dl.innerHTML = w?.mag ? statRows(w) : '';
}
/** 軍械頁點槍：舞台上的士兵換拿這把。投擲物與裝備沒有手持模型，不換。 */
function arm(id) { showArm(id); if (WEAPONS[id]?.mag) acts.stage(null, id); }
function buildArms() {
  const box = menu.querySelector('.m-list'); $.it = {};
  for (const c of COLS) {
    const d = document.createElement('div'); d.className = 'm-group'; d.innerHTML = `<h3>${c.name}</h3>`;
    for (const id of c.items) {
      const w = WEAPONS[id], g = GEAR[id], b = document.createElement('button'), p = w?.price ?? g.price; b.type = 'button'; b.className = 'm-tile';
      b.innerHTML = `<em>${p ? '$' + p : '配發'}</em>${w ? `<i class="ic ic-${id}"></i>` : `<div class="sp">${SPEC[id]}</div>`}<span>${w?.name ?? g.name}</span>`;
      b.onclick = () => arm(id); d.appendChild(b); $.it[id] = b;
    }
    box.appendChild(d);
  }
  const f = menu.querySelector('.m-info'); $.info = { ic: f.querySelector('i'), h: f.querySelector('h3'), pr: f.querySelector('.pr'), p: f.querySelector('p'), dl: f.querySelector('dl') };
}

export function initMenu(root, actions) {
  acts = actions;
  Object.assign(set, loadSettings());
  menu = html(shell(), 'main'); menu.dataset.tab = 'play';
  pause = html(`<div class="box" style="max-width:460px"><h2>暫停</h2><label>滑鼠靈敏度<input data-set="sens" type="range" min="0.0006" max="0.006" step="0.0002"></label><label>音量<input data-set="vol" type="range" min="0" max="1" step="0.05"></label><div class="row"><button id="res">繼續</button><button id="leave" class="q">離開比賽，不計戰績</button></div></div>`);
  result = html(`<div class="box" style="max-width:520px"><h1 id="rs"></h1><p id="rsd"></p><div class="row"><button id="again">再來一場</button><button id="tomenu" class="q">回主選單</button></div></div>`);
  root.append(menu, pause, result);
  $ = { rec: menu.querySelector('#m-rec'), card: menu.querySelector('#m-card'), roster: menu.querySelector('#m-roster'), go: menu.querySelector('#m-go'), gosub: menu.querySelector('#m-gosub'), fps: menu.querySelector('#m-fps'), line: menu.querySelector('.m-line'), clear: menu.querySelector('#m-clear'), modes: [...menu.querySelectorAll('.m-mode')], tabs: [...menu.querySelectorAll('[role=tab]')] };
  buildArms();
  for (const b of $.modes) b.onclick = () => pickSide(b.dataset.mode);
  for (const b of $.tabs) b.onclick = () => tab(b.dataset.tab);
  menu.querySelector('[role=tablist]').addEventListener('keydown', e => { const d = e.code === 'ArrowRight' ? 1 : e.code === 'ArrowLeft' ? -1 : 0; if (!d) return; const vis = $.tabs.filter(b => b.offsetWidth), i = vis.indexOf(document.activeElement), n = vis[(i + d + vis.length) % vis.length]; n.focus(); tab(n.dataset.tab); e.preventDefault(); });
  $.go.onclick = () => acts.start({ side });
  $.clear.onclick = () => { if (!confirmClear) { confirmClear = true; $.clear.textContent = '再按一次確認清除'; return; } clearRecord(); drawRecord(); };
  menu.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') acts.point(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); });
  for (const e of root.querySelectorAll('[data-set]')) e.oninput = () => { set[e.dataset.set] = +e.value; applyAll(); saveSettings(set); };
  pause.querySelector('#res').onclick = () => actions.resume();
  pause.querySelector('#leave').onclick = () => actions.toMenu();
  result.querySelector('#again').onclick = () => actions.again();
  result.querySelector('#tomenu').onclick = () => actions.toMenu();
  // 隊伍分頁只在直式有；手機轉橫向時退回開戰（名單就在開戰頁右欄）
  addEventListener('resize', () => { if (menu.style.display !== 'flex') return; if (!menu.querySelector('[role=tab][aria-selected=true]').offsetWidth) tab('play'); else line(); });
  applyAll(); pickSide('atk');
}
const show = (e, on) => { e.style.display = on ? 'flex' : 'none'; };
const fpsTick = () => { $.fps.textContent = `${acts.backend} · ${Math.round(acts.fps())} fps`; };
export function showMenu() { show(menu, true); input.menu = true; drawRecord(); line(); fpsTick(); clearInterval(fpsTimer); fpsTimer = setInterval(fpsTick, 1000); }
export function hideMenu() { show(menu, false); input.menu = false; clearInterval(fpsTimer); }
export const showPause = () => show(pause, true), hidePause = () => show(pause, false), hideResult = () => show(result, false);
export function showResult(win, my, opp, kills, deaths) {
  result.querySelector('#rs').textContent = win ? '勝利' : '落敗';
  result.querySelector('#rsd').textContent = `比分 ${my} : ${opp}，你擊殺 ${kills}、死亡 ${deaths}。已記入本機戰績。`;
  show(result, true);
}
