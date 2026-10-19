// 進入點：載入 Rapier、建立畫面與各模式，管主選單、暫停、結算、排行榜、設定與展示間的介面。
import RAPIER from '@dimforge/rapier3d-compat';
import { PerspectiveCamera, Vector3 } from 'three';
import { Gfx } from './gfx.js';
import { Showroom } from './showroom.js';
import { Drive } from './drive.js';
import { Match } from './match.js';
import { Input } from './input.js';
import { Hud, fmtTime } from './hud.js';
import { Sound } from './audio.js';
import { Lobby } from './net.js';
import { store } from './store.js';
import { PAINTS, LIVERIES } from './roadster.js';
import { emptyInput } from '../core/car.js';
import { TA } from '../core/park.js';
import { OBJECTIVES, medalFor } from '../core/stunt.js';
import { TEAM_NAMES } from '../core/league.js';

const $ = (id) => document.getElementById(id);
const MEDAL_NAME = { author: '作者獎牌', gold: '金牌', silver: '銀牌', bronze: '銅牌' };

async function loadRapier() {
  const b64 = document.getElementById('rapier-wasm').textContent.trim();
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  globalThis.__RAPIER_WASM__ = await new Response(ds).arrayBuffer();
  const warn = console.warn; console.warn = () => {};
  try { await RAPIER.init(); } finally { console.warn = warn; }
  return RAPIER;
}

const coarse = matchMedia('(pointer: coarse)').matches;
const pickQuality = (q) => (q === 'auto' ? (coarse || Math.min(innerWidth, innerHeight) < 700 ? 'mid' : 'high') : q);

async function main() {
  const q = new URLSearchParams(location.search);
  const settings = store.settings();
  if (!settings.name) { settings.name = '車手' + Math.floor(Math.random() * 9000 + 1000); store.saveSettings(settings); }
  const R = await loadRapier();
  const gfx = new Gfx($('view'), q.get('q') || pickQuality(settings.quality));
  const input = new Input();
  input.bindTouch($('touch'));
  const hud = new Hud();
  hud.setUnits(settings.units);
  const sound = new Sound();
  sound.setVolume(settings.volume);
  const lobby = new Lobby();
  const drive = new Drive(gfx, R, settings);
  let show = null, match = null;
  let screen = null, paused = false, overlay = null;
  let worldBest = null;
  const inp = emptyInput();
  const menuCam = new PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 6000);
  let menuT = 0;

  // ---- 在線人數 ----
  const setOnline = () => {
    const el = $('online');
    if (lobby.live && lobby.counts) {
      el.classList.add('live');
      $('onlineN').textContent = lobby.counts.online.toLocaleString('en-US');
      $('onlineL').textContent = lobby.counts.playing ? `位車手在線 · ${lobby.counts.playing} 人在聯賽` : '位車手在線';
    } else {
      el.classList.remove('live');
      $('onlineN').textContent = '0';
      $('onlineL').textContent = lobby.base ? '連不到伺服器，離線模式' : '離線模式（沒有設定連線伺服器）';
    }
  };
  lobby.on('status', setOnline).on('count', setOnline);
  lobby.connect();
  setOnline();

  // ---- 畫面切換 ----
  const sheets = ['pause', 'result', 'controls', 'settings', 'board', 'lobby'];
  function openSheet(id) {
    for (const s of sheets) $(s).classList.toggle('hide', s !== id);
    overlay = id;
    if (id === 'settings') fillSettings();
    if (id === 'board') loadBoard(boardKind);
    const first = id && $(id).querySelector('button.primary, button, input');
    if (first && !coarse) first.focus({ preventScroll: true });
  }
  function closeSheet() {
    const was = overlay;
    for (const s of sheets) $(s).classList.add('hide');
    overlay = null;
    // 從暫停開的子面板關掉後回到暫停
    if (paused && was !== 'pause' && was !== 'result') openSheet('pause');
  }

  function go(mode) {
    sound.unlock();
    if (match && mode !== 'league') { match.dispose(); match = null; }
    closeSheet();
    paused = false;
    screen = mode;
    $('menu').classList.toggle('hide', mode !== 'menu');
    $('show').classList.toggle('hide', mode !== 'show');
    const driving = mode === 'free' || mode === 'ta' || mode === 'league';
    hud.show(driving ? mode : null);
    document.body.classList.toggle('touch', driving && (coarse || input.device === 'touch'));
    $('pauseBtn').style.display = driving && coarse ? 'grid' : '';
    if (mode === 'menu') { drive.menuPose(); menuSel(0, true); }
    if (mode === 'free') { drive.start('free'); hud.objectives(drive.rules.done); hud.cam(drive.cam.mode); }
    if (mode === 'ta') {
      drive.start('ta');
      hud.medals(drive.best && drive.best.time, worldBest);
      hud.cam(drive.cam.mode);
      if (lobby.live) lobby.board('world').then((r) => { if (r && r.rows[0]) { worldBest = r.rows[0].time; if (screen === 'ta') hud.medals(drive.best && drive.best.time, worldBest); } });
    }
    if (mode === 'show') { if (!show) { show = new Showroom(gfx); bindShowroom(); } syncShowUI(); }
    if (mode === 'league') { hud.cam('chase'); }
    window.__rsa.screen = mode;
  }

  // ---- 主選單 ----
  const modeBtns = [...document.querySelectorAll('#modes button')];
  let sel = 0;
  function menuSel(i, quiet) {
    sel = (i + modeBtns.length) % modeBtns.length;
    modeBtns.forEach((b, k) => b.classList.toggle('on', k === sel));
    if (!quiet) sound.play('move');
  }
  modeBtns.forEach((b, i) => {
    b.addEventListener('pointerenter', () => { if (sel !== i) menuSel(i); });
    b.addEventListener('click', () => { sound.unlock(); sound.play('click'); pickMode(b.dataset.mode); });
  });
  function pickMode(m) {
    if (m === 'board') { openSheet('board'); return; }
    if (m === 'league') { openLobby(); return; }
    go(m);
  }
  $('menuName').textContent = settings.name;

  // ---- 車球聯賽：大廳 ----
  function openLobby() {
    openSheet('lobby');
    const quick = $('lobbyBtns').querySelector('[data-act=quick]');
    quick.disabled = !lobby.live;
    quick.style.opacity = lobby.live ? '' : '0.4';
    $('lobbyNote').textContent = lobby.live
      ? `目前 ${lobby.counts ? lobby.counts.rooms : 0} 個房間、${lobby.counts ? lobby.counts.playing : 0} 人在比賽。一房最多 20 人，人到齊兩人就開賽。`
      : '沒有連到伺服器：在本機執行 npm start，或部署 Cloudflare Worker（見 README）後就能線上對戰。現在可以先和 AI 練習。';
  }
  async function startLeague(online, code = null) {
    if (match) { match.dispose(); match = null; }
    let net = null;
    if (online) {
      const c = code || (await lobby.quick())?.code;
      if (!c) { hud.toast('配對失敗，改成離線練習'); }
      else net = { base: lobby.base, code: c };
    }
    match = new Match(gfx, R, settings, { online: net, name: settings.name });
    match.onEvent = onMatchEvent;
    go('league');
    if (net) { hud.toast(`連線到房間 ${net.code}…`); history.replaceState(null, '', `?room=${net.code}`); }
  }

  // ---- 設定 ----
  function segPick(id, val, on) {
    const el = $(id);
    el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(val)));
    el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sound.play('click'); on(b.dataset.v); segPick(id, b.dataset.v, on); };
  }
  function fillSettings() {
    const n = $('setName');
    n.value = settings.name;
    n.oninput = () => { settings.name = n.value.trim().slice(0, 16) || settings.name; $('menuName').textContent = settings.name; store.saveSettings(settings); };
    segPick('setQ', settings.quality, (v) => { settings.quality = v; store.saveSettings(settings); gfx.setQuality(pickQuality(v)); });
    segPick('setU', settings.units, (v) => { settings.units = v; store.saveSettings(settings); hud.setUnits(v); });
    const vol = $('setVol');
    vol.value = settings.volume;
    vol.oninput = () => { settings.volume = Number(vol.value); sound.setVolume(settings.volume); store.saveSettings(settings); };
  }

  // ---- 排行榜 ----
  let boardKind = 'world';
  segPick('boardTabs', boardKind, (v) => { boardKind = v; loadBoard(v); });
  async function loadBoard(kind) {
    const tb = $('boardTable').querySelector('tbody');
    const note = $('boardNote');
    tb.innerHTML = '';
    const row = (i, name, time, extra, me) => {
      const tr = document.createElement('tr');
      if (me) tr.className = 'me';
      const m = medalFor(time);
      tr.innerHTML = `<td>${i}</td><td></td><td>${m ? `<i class="medal ${m}" title="${MEDAL_NAME[m]}"></i>` : ''}</td><td class="t">${fmtTime(time)}</td>`;
      tr.children[1].textContent = name + (extra ? ` · ${extra}` : '');
      tb.appendChild(tr);
    };
    if (kind === 'mine') {
      const runs = store.runs();
      runs.slice(0, 15).forEach((r, i) => row(i + 1, settings.name, r.time, new Date(r.at).toLocaleDateString('zh-TW'), false));
      note.textContent = runs.length ? '這台裝置上完成的計時賽（前 15 筆）。' : '還沒有完成過計時賽。';
      return;
    }
    if (!lobby.live) { note.textContent = '離線中：世界紀錄與本週最佳要連上伺服器才看得到。「我的紀錄」可以離線查看。'; return; }
    note.textContent = '讀取中…';
    const r = await lobby.board(kind);
    if (!r) { note.textContent = '讀取失敗。'; return; }
    r.rows.forEach((x, i) => row(i + 1, x.name, x.time, kind === 'week' ? '' : new Date(x.at).toLocaleDateString('zh-TW'), x.name === settings.name));
    note.textContent = r.rows.length ? (kind === 'week' ? `本週（${r.wk}，週一 00:00 UTC 重置）` : '每位車手只列最佳成績。') : '還沒有人上榜，第一名等你。';
  }

  // ---- 展示間 ----
  const SPECS = [['0.8', 's', '0–60 mph（冷氣推進）'], ['1.4', 's', '0–60 mph（只靠馬達）'], ['150', 'mph', '極速（推進全開 220+）'], ['4', '噴口', '冷氣推進，空中可懸停飛行'], ['1,500', 'kg', '車重']];
  function bindShowroom() {
    $('specs').innerHTML = SPECS.map(([v, u, l]) => `<div><b>${v}<small>${u}</small></b><span>${l}</span></div>`).join('');
    $('paints').innerHTML = PAINTS.map((p) => `<button data-v="${p.id}" title="${p.name}" style="background:${p.color}"></button>`).join('');
    $('liveries').innerHTML = LIVERIES.map((l) => `<button data-v="${l.id}">${l.name}</button>`).join('');
    $('paints').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sound.play('click'); settings.paint = b.dataset.v; store.saveSettings(settings); applyPaint(); syncShowUI(); };
    segPick('liveries', settings.livery, (v) => { settings.livery = v; store.saveSettings(settings); applyPaint(); });
    segPick('sDoors', 1, (v) => { show.doorTarget = Number(v); });
    segPick('sLights', 1, (v) => { show.car.setLights(Number(v)); });
    segPick('sAero', 'stowed', (v) => show.setAero(v));
    $('showBack').onclick = () => { sound.play('click'); go('menu'); };
    // 拖曳環繞、滾輪與雙指縮放
    const pts = new Map();
    let pinch = 0;
    const cv = $('view');
    cv.addEventListener('pointerdown', (e) => { if (screen !== 'show') return; pts.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (screen !== 'show' || !pts.has(e.pointerId)) return;
      const [x0, y0] = pts.get(e.pointerId);
      if (pts.size === 1) show.drag(e.clientX - x0, e.clientY - y0);
      else {
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) show.zoom(pinch / d);
        pinch = d;
        return;
      }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { if (screen === 'show') { e.preventDefault(); show.zoom(Math.exp(e.deltaY * 0.001)); } }, { passive: false });
  }
  function applyPaint() {
    if (show) show.car.setPaint(settings.paint, settings.livery);
    drive.model.setPaint(settings.paint, settings.livery);
  }
  function syncShowUI() {
    document.querySelectorAll('#paints button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings.paint));
  }

  // ---- 面板按鈕 ----
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.open) { sound.play('click'); if (b.dataset.open === 'settings' && screen === 'menu') openSheet('settings'); else openSheet(b.dataset.open); return; }
    if (b.hasAttribute('data-close')) { sound.play('click'); closeSheet(); return; }
    const a = b.dataset.act;
    if (!a) return;
    sound.play('click');
    if (a === 'resume') resume();
    else if (a === 'restart') { if (screen === 'ta') go('ta'); else if (screen === 'free') { drive.start('free'); hud.objectives(drive.rules.done); resume(); } else resume(); }
    else if (a === 'respawn') { resume(); doAction('respawn'); }
    else if (a === 'menu') go('menu');
    else if (a === 'board') openSheet('board');
    else if (a === 'quick') startLeague(true);
    else if (a === 'practice') startLeague(false);
    else if (['aero', 'suction', 'lights', 'cam'].includes(a)) doAction(a);
  });
  $('pauseBtn').addEventListener('click', () => pause());

  function pause() { if (!['free', 'ta', 'league'].includes(screen) || overlay === 'result') return; paused = true; $('pauseSub').textContent = { free: 'Free Ride', ta: `Time Attack · ${TA.name}`, league: match && match.rc ? `Roadster League · 房號 ${match.code}（連線中，比賽不會暫停）` : 'Roadster League · 離線練習' }[screen]; $('pRestart').classList.toggle('hide', screen === 'league'); openSheet('pause'); }
  function resume() { paused = false; closeSheet(); }

  function doAction(a) {
    if (screen === 'league' && match) {
      match.action(a);
      if (a === 'cam') hud.cam(match.camMode);
    } else if (screen === 'free' || screen === 'ta') drive.action(a);
  }

  // ---- 遊戲事件 → HUD／音效 ----
  drive.onEvent = (e) => {
    switch (e.type) {
      case 'trick': hud.trick(e.name, e.mult > 1 ? `COMBO ×${e.mult}` : 'TRICK', `+${e.pts.toLocaleString('en-US')}`); sound.play('trick'); break;
      case 'landed': {
        const title = e.lines.length ? e.lines[0].name : (e.tricks.length ? e.tricks[e.tricks.length - 1] : 'LANDED');
        const sub = [`AIR ${e.air.toFixed(2)} S`, ...e.tricks].join(' · ');
        hud.trick(title, `LANDED ×${e.mult}`, `+${e.total.toLocaleString('en-US')}`, sub);
        sound.play('landed');
        break;
      }
      case 'bail': hud.trick('BAIL', '落地翻車，分數作廢', e.lost ? `−${e.lost.toLocaleString('en-US')}` : '', '', true); sound.play('bail'); break;
      case 'drift': hud.trick('DRIFT', `${e.t.toFixed(1)} S`, `+${e.pts.toLocaleString('en-US')}`); break;
      case 'speed88': hud.toast('88 MPH · 火焰胎痕'); break;
      case 'objective': hud.completeObjective(e.id, e.count); hud.toast(`任務完成 · ${e.text}`); sound.play('objective'); break;
      case 'ring': hud.toast(`紅環 ${e.n}/6`); sound.play('ring'); break;
      case 'pad': hud.toast('加速墊 · 補充冷氣'); sound.play('pad'); break;
      case 'sixty': hud.toast(`0–60 mph · ${e.t.toFixed(2)} 秒`); break;
      case 'land': if (e.impact > 4) sound.play('land', e.impact); break;
      case 'jump': sound.play('jump'); break;
      case 'respawn': hud.toast('重生'); break;
      case 'cam': hud.cam(e.mode); break;
      case 'aero': hud.toast(`主動空力 · ${e.mode}`); break;
      case 'suction': hud.toast(`吸附 · ${e.mode}`); break;
      case 'count': hud.count(e.n); sound.play('count'); break;
      case 'go': {
        hud.count(0); sound.play('go');
        const g = TA.gates[0];
        hud.hint(g.first[0], g.first[1]);
        break;
      }
      case 'gate': {
        hud.split(e.i, e.time, e.delta);
        sound.play('gate');
        const nx = TA.gates[e.i + 1] || TA.finish;
        hud.hint(nx.hint[0], nx.hint[1]);
        break;
      }
      case 'wrongway': hud.wrong(e.on); if (e.on) sound.play('wrong'); break;
      case 'finish': finishTA(e); break;
    }
  };

  async function finishTA(e) {
    sound.play('finish');
    hud.wrong(false);
    $('resTime').textContent = fmtTime(e.time);
    const m = e.medal;
    $('resMedal').innerHTML = m ? `<i class="medal ${m}"></i><span>${MEDAL_NAME[m]}</span>` : '<span>差一點就有銅牌（' + fmtTime(TA.medals.bronze) + '）</span>';
    const prev = e.prev;
    let note = prev == null ? '第一次完賽，幽靈車已記錄。' : e.improved ? `刷新個人紀錄，快了 ${(prev - e.time).toFixed(3)} 秒。幽靈車已更新。` : `比個人紀錄慢 ${(e.time - prev).toFixed(3)} 秒。`;
    const names = ['THE CURL 環', '整排車', '長左彎', '大迴圈', '天空環', '終點'];
    const bs = drive.best && !e.improved ? drive.best.splits : null;
    $('resSplits').innerHTML = e.splits.map((t, i) => {
      const d = bs && bs[i] != null ? t - bs[i] : null;
      return `<tr><td>${names[i]}</td><td>${fmtTime(t)}</td><td class="${d == null ? '' : d < 0 ? 'up' : 'down'}" style="width:80px">${d == null ? '' : (d < 0 ? '−' : '+') + Math.abs(d).toFixed(3)}</td></tr>`;
    }).join('');
    $('resNote').textContent = note;
    openSheet('result');
    if (lobby.live) {
      $('resNote').textContent = note + ' 上傳排行榜中…';
      const r = await lobby.submit(settings.name, e.time, e.splits);
      if (overlay !== 'result') return;
      if (r && r.ok) $('resNote').textContent = `${note} 世界排名第 ${r.rank} 名（${settings.name}）。`;
      else $('resNote').textContent = `${note} 排行榜：${(r && r.error) || '上傳失敗'}。`;
    } else $('resNote').textContent = note + ' 離線中，成績只存在這台裝置。';
  }

  function onMatchEvent(e) {
    switch (e.type) {
      case 'count': hud.count(e.n); sound.play('count'); break;
      case 'go': hud.count(0); sound.play('go'); break;
      case 'goal': {
        const tn = TEAM_NAMES[e.team];
        hud.banner(e.warmup ? 'NICE' : e.own ? 'OWN GOAL' : 'GOAL', e.warmup ? '熱身中：等第二位車手加入就開賽' : `${e.by || '?'} · ${tn} 得分 · ${e.score[0]} : ${e.score[1]}`, e.team, 3.2);
        sound.play('goal');
        break;
      }
      case 'end': hud.banner(`${TEAM_NAMES[e.winner]} WINS`, `${e.score[0]} : ${e.score[1]} · 下一場馬上開始`, e.winner, 7); sound.play('finish'); break;
      case 'overtime': hud.banner('OVERTIME', '延長賽：先進球的隊伍獲勝', null, 2.6); break;
      case 'hit': sound.play('hit', e.speed); break;
      case 'pad': hud.toast('加速墊 · 補充冷氣'); sound.play('pad'); break;
      case 'roster': hud.roster([...match.roster.entries()].map(([id, r]) => ({ id, ...r })), match.myId); break;
      case 'toast': hud.toast(e.text); break;
      case 'aero': hud.toast(`主動空力 · ${e.mode}`); break;
      case 'suction': hud.toast(`吸附 · ${e.mode}`); break;
      case 'net':
        if (e.state === 'joined') hud.toast(`已加入房間 ${e.code} · 網址可以分享給朋友`, 4);
        else if (e.state === 'full') { hud.toast('房間滿了（20 人）'); setTimeout(() => go('menu'), 1500); }
        else if (e.state === 'lost') { hud.toast('連線中斷，回到選單', 3); setTimeout(() => { if (screen === 'league') go('menu'); }, 2000); }
        break;
    }
  }

  // ---- 鍵盤：選單與面板 ----
  addEventListener('keydown', (e) => {
    sound.unlock();
    if (e.target && /INPUT/.test(e.target.tagName)) { if (e.key === 'Escape') closeSheet(); return; }
    if (overlay) {
      if (e.key === 'Escape') { e.preventDefault(); if (overlay === 'pause') resume(); else if (overlay === 'result') go('menu'); else closeSheet(); }
      else if (e.key === 'Enter' && overlay === 'result') { e.preventDefault(); go('ta'); }
      return;
    }
    if (screen === 'menu') {
      if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); menuSel(sel + 1); }
      else if (['ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); menuSel(sel - 1); }
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); sound.play('click'); pickMode(modeBtns[sel].dataset.mode); }
    } else if (screen === 'show' && e.key === 'Escape') go('menu');
  });
  addEventListener('pointerdown', () => sound.unlock(), { once: false, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (screen === 'free' || screen === 'ta' || (screen === 'league' && match && !match.rc)) && !overlay) pause(); });

  // ---- 每幀 ----
  let last = performance.now();
  let slow = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const acts = input.drain();
    input.read(inp);
    if (window.__rsa.auto) Object.assign(inp, window.__rsa.auto);
    const driving = screen === 'free' || screen === 'ta' || screen === 'league';
    for (const a of acts) {
      if (overlay && a !== 'pause' && a !== 'controls') continue;
      if (a === 'pause') { if (driving && !overlay) pause(); continue; }
      if (a === 'controls') { if (overlay === 'controls') closeSheet(); else if (!overlay || overlay === 'pause') openSheet('controls'); continue; }
      if (a === 'restart' && screen === 'ta') { go('ta'); continue; }
      if (driving && !paused) doAction(a);
    }
    if (driving && input.device === 'touch' && !document.body.classList.contains('touch')) document.body.classList.add('touch');
    if (screen === 'menu' || !screen) {
      menuT += dt;
      drive.menuFrame(dt);
      // 慢慢繞著車轉；桌機版把車擺在畫面右邊
      const portrait = innerWidth < innerHeight;
      const a = 0.6 + menuT * 0.05, r = portrait ? 12.5 : 9.4;
      const fov = portrait ? 46 : 34;
      if (menuCam.fov !== fov) { menuCam.fov = fov; menuCam.updateProjectionMatrix(); }
      const c = drive.model.group.position;
      menuCam.position.set(c.x + Math.sin(a) * r, 1.55 + Math.sin(menuT * 0.2) * 0.25, c.z + Math.cos(a) * r);
      menuCam.lookAt(c.x, 0.85, c.z);
      const w = innerWidth, h = innerHeight;
      if (w > 760) menuCam.setViewOffset(w, h, -w * 0.2, 0, w, h); else menuCam.setViewOffset(w, h, 0, h * 0.2, w, h);
      gfx.render(drive.scene, menuCam, dt);
      sound.drive(null, false);
    } else if (screen === 'show') {
      show.update(dt, now / 1000);
      // 直式螢幕：鏡頭放寬、車往上移，讓出下方的控制面板
      const cam = show.camera, portrait = innerWidth < innerHeight;
      const fov = portrait ? 50 : 32;
      if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
      if (portrait) cam.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.1, innerWidth, innerHeight); else if (cam.view) cam.clearViewOffset();
      gfx.render(show.scene, show.camera, dt);
      sound.drive(null, false);
    } else if (screen === 'free' || screen === 'ta') {
      if (!paused) drive.update(dt, inp);
      drive.draw(dt);
      const R0 = drive.rules;
      hud.frame(dt, drive.car.state, { cam: drive.cam.mode, score: screen === 'free' ? R0.score : null, ta: screen === 'ta' ? R0 : null });
      sound.drive(drive.car.state, !paused);
    } else if (screen === 'league' && match) {
      // 連線中不暫停（別人還在玩）
      if (!paused || match.rc) match.update(dt, paused ? emptyInput() : inp);
      match.draw(dt);
      const L = match.lg;
      const st = match.me ? match.me.car.state : drive.car.state;
      const sub = match.rc ? (L.phase === 'warmup' ? `熱身 · ${match.code}` : `房號 ${match.code}`) : '離線練習 3v3';
      hud.frame(dt, st, { cam: match.camMode, league: { score: L.score, clock: L.clock, overtime: L.overtime, sub } });
      sound.drive(match.me ? st : null, !!match.me && !paused);
    }
    // 自動畫質：連續 4 秒低於 40 fps 就降一級
    if (settings.quality === 'auto' && driving && !paused) {
      slow = dt > 1 / 40 ? slow + dt : Math.max(0, slow - dt * 0.5);
      if (slow > 4) { slow = 0; const next = gfx.q === 'high' ? 'mid' : gfx.q === 'mid' ? 'low' : null; if (next) { gfx.setQuality(next); hud.toast(`畫質自動調成「${next === 'mid' ? '中' : '低'}」`); } }
    }
    requestAnimationFrame(frame);
  }

  // ---- 測試與除錯用 ----
  window.__rsa = {
    gfx, drive, R, input, hud, lobby, settings, ready: false, auto: null, screen: null,
    get match() { return match; }, get show() { return show; },
    go, startLeague, openSheet, closeSheet, pause, resume,
  };
  const start = q.get('mode');
  const room = q.get('room');
  if (room && /^[A-Za-z2-9]{5}$/.test(room)) { go('menu'); setTimeout(() => { if (lobby.live) startLeague(true, room.toUpperCase()); else lobby.on('status', function once(s) { if (s.live && screen === 'menu') startLeague(true, room.toUpperCase()); }); }, 300); }
  else if (start === 'league') startLeague(false);
  else if (start === 'board') { go('menu'); openSheet('board'); }
  else go(['free', 'ta', 'show'].includes(start) ? start : 'menu');
  $('boot').classList.add('gone');
  requestAnimationFrame(frame);
  window.__rsa.ready = true;
}

main().catch((e) => {
  const m = document.getElementById('bootMsg');
  if (m) m.textContent = '啟動失敗：' + (e && e.message ? e.message : e) + '。請換用最新版的 Chrome、Edge、Safari 或 Firefox。';
  throw e;
});
