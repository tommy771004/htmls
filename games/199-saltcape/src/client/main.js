// 鹽岬大逃殺前端：大廳／配對、客戶端預測與伺服器校正、其他玩家內插、鏡頭、特效與 HUD。
import * as THREE from 'three';
import { getMap } from '../core/map.js';
import { raycastWorld, groundAt, terrainAt } from '../core/physics.js';
import { newPlayer, stepPlayer, applySelf, MODE, eyeHeight, planePos, currentSpread } from '../core/player.js';
import { TICK, DT, WEAPONS, WEAPON_KEYS, BITS, PLANE_ALT, MATCH, decodeLoot, RARITY, lootLabel } from '../core/rules.js';
import { unpackStorm, stormAt, stormRemaining } from '../core/storm.js';
import { buildWorld, FOG } from './world.js';
import { makeSoldier, poseSoldier, makePlane } from './actors.js';
import { makeViewmodel } from './viewmodel.js';
import { makeFx } from './fx.js';
import { makeAudio } from './audio.js';
import { makeHud, mapImage, esc, fmt } from './hud.js';
import { makeInput } from './input.js';
import { NetClient, LocalClient, serverURL } from './net.js';
import { makeGrass } from './grass.js';

const $ = (id) => document.getElementById(id);
const canvas = $('gl');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window && innerWidth < 900;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const W = getMap();
const world = buildWorld(W, renderer);
const scene = world.scene;
const camera = new THREE.PerspectiveCamera(78, 1, 0.08, 9000);
const vm = makeViewmodel();
const fx = makeFx(scene);
const audio = makeAudio();
const img = mapImage(W);
const hud = makeHud(W, img);
const input = makeInput(canvas);
const plane = makePlane(); plane.visible = false; scene.add(plane);
const grass = makeGrass(W, scene);
const mySoldier = makeSoldier(0); mySoldier.root.visible = false; scene.add(mySoldier.root);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------------- 狀態 ----------------
const G = {
  screen: 'lobby', net: null, myId: 0, room: null, solo: false,
  match: null,       // { plane, players: Map, started, over, alive }
  me: newPlayer(0, ''), pending: [], seq: 0, sendBuf: [], acc: 0,
  prevPos: new THREE.Vector3(), curPos: new THREE.Vector3(), corr: new THREE.Vector3(),
  yaw: 0, pitch: 0, recoil: 0, tp: false,
  others: new Map(), loot: new Map(), storm: null, alive: 0,
  offset: null, lastSnapAt: 0, watch: -1, dead: null, result: null, hurtFlash: 0,
  aimLoot: null, aimT: 0, zone: '', stepT: 0, lastNet: 0,
};
const tmp = newPlayer(0, '');

// 伺服器時間估計：取最小延遲的 (tick 時間 − 收到時間)
function noteServerTick(k) {
  const now = performance.now(), off = k * (1000 / TICK) - now;
  if (G.offset === null || off > G.offset) G.offset = off;
  else G.offset += (off - G.offset) * 0.02; // 慢慢跟上漂移
}
const estTick = () => (G.offset === null ? 0 : (performance.now() + G.offset) / (1000 / TICK));
const renderTick = () => estTick() - 3.4;

// ---------------- 大廳 UI ----------------
const nameInput = $('name'), codeInput = $('code');
try { nameInput.value = localStorage.getItem('saltcape.name') || ''; } catch { /* */ }
const params = new URLSearchParams(location.search);
const urlRoom = (params.get('room') || location.hash.replace('#', '')).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
if (urlRoom) codeInput.value = urlRoom;
const SERVER = serverURL();
function setStatus(cls, text) { const s = $('status'); s.className = 'status ' + cls; $('statusText').textContent = text; const s2 = $('status2'); s2.className = 'status ' + cls; $('statusText2').textContent = text; }
if (!SERVER) { setStatus('off', '以檔案開啟：沒有連線伺服器，可離線練習'); for (const id of ['bQuick', 'bCreate', 'bJoin']) $(id).disabled = true; }
else setStatus('', urlRoom ? `收到邀請：房號 ${urlRoom}` : '線上伺服器待命');
const playerName = () => { const n = nameInput.value.trim().slice(0, 14) || '旅人' + Math.floor(Math.random() * 900 + 100); try { localStorage.setItem('saltcape.name', n); } catch { /* */ } return n; };

function connect(mode, code) {
  audio.init();
  if (G.net) G.net.close();
  G.solo = mode === 'solo';
  const onMsg = (m) => handle(m);
  const onState = (s) => {
    if (s === 'open') { setStatus('on', G.solo ? '離線練習（只有 AI）' : '已連線'); $('netWarn').classList.add('hidden'); }
    if (s === 'drop') { setStatus('off', '連線中斷，正在重新連線…'); $('netWarn').classList.remove('hidden'); }
    if (s === 'fail') { setStatus('off', '無法連線伺服器：可改用離線練習'); $('netWarn').classList.add('hidden'); showPick(); }
  };
  G.net = G.solo ? new LocalClient(onMsg, onState) : new NetClient(SERVER, onMsg, onState);
  setStatus('', G.solo ? '準備離線練習…' : '連線中…');
  const name = playerName();
  if (G.solo) G.net.nameCache = name;
  G.net.connect({ t: 'hello', mode, code, name });
}
$('bQuick').onclick = () => connect('quick');
$('bCreate').onclick = () => connect('create');
$('bJoin').onclick = () => { const c = codeInput.value.trim().toUpperCase(); if (c.length < 4) { codeInput.focus(); return; } connect('join', c); };
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('bJoin').click(); });
$('bSolo').onclick = () => connect('solo');
$('bLaunch').onclick = () => { G.net?.send({ t: 'start' }); audio.ui(); };
$('bShare').onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${G.room?.code || ''}`;
  try { await navigator.clipboard.writeText(url); $('shareHint').textContent = '已複製'; } catch { $('shareHint').textContent = url; }
  setTimeout(() => { $('shareHint').textContent = '朋友開網址即加入'; }, 2400);
};
$('bLeave').onclick = () => { leaveRoom(); };
function leaveRoom() {
  G.net?.close(); G.net = null; G.room = null; G.match = null;
  try { history.replaceState(null, '', location.pathname); } catch { /* */ }
  showPick(); setStatus(SERVER ? '' : 'off', SERVER ? '線上伺服器待命' : '以檔案開啟：可離線練習');
  toLobbyScreen();
}
function showPick() { $('pickView').classList.remove('hidden'); $('roomView').classList.add('hidden'); $('flightNo').textContent = 'SC-199'; }
function showRoom(room) {
  $('pickView').classList.add('hidden'); $('roomView').classList.remove('hidden');
  $('roomCode').textContent = room.kind === 'solo' ? '離線' : room.code;
  $('flightNo').textContent = room.kind === 'solo' ? 'SOLO' : 'SC-' + room.code;
  const ms = room.ends || 0;
  $('countdown').textContent = room.state === 'lobby' ? fmt(ms / 1000) : room.state === 'match' ? '飛行中' : '結算中';
  const humans = room.players.length;
  $('roomNote').textContent = room.state === 'match' && room.live ? `對局進行中：存活 ${room.live.alive}，運輸機離島後加入者先觀戰` : `乘客名單 · ${humans} 名真人，其餘 ${Math.max(0, (room.target || MATCH.target) - humans)} 席由 AI 補滿`;
  $('roster').innerHTML = room.players.map((p, i) => `<li class="${p.c ? '' : 'off'}${p.id === G.myId ? ' me' : ''}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(p.n)}${p.id === room.host ? ' · 機長' : ''}</li>`).join('');
  const host = room.host === G.myId;
  $('bLaunch').disabled = !(host && room.state === 'lobby');
  $('bLaunch').querySelector('small').textContent = host ? 'AI 補滿 48 人' : room.kind === 'quick' ? '倒數結束自動起飛' : '等待機長起飛';
  $('bShare').disabled = room.kind === 'solo';
}

// ---------------- 訊息處理 ----------------
function handle(m) {
  G.lastNet = performance.now();
  if (m.t === 'welcome') {
    G.myId = m.id; G.room = m.room;
    if (G.screen === 'lobby') showRoom(m.room);
    if (m.room.kind === 'private') { try { history.replaceState(null, '', `${location.pathname}?room=${m.room.code}`); } catch { /* */ } }
  } else if (m.t === 'lobby') {
    G.room = m.room;
    if (G.screen === 'lobby') showRoom(m.room);
    if (m.room.state === 'lobby' && G.screen === 'game' && G.match?.over) {
      // 伺服器已回到大廳：關掉結算，回登機證
      toLobbyScreen(); showRoom(m.room);
    }
  } else if (m.t === 'err') {
    setStatus('off', m.msg || '發生錯誤');
    if (m.code === 'notfound' || m.code === 'full' || m.code === 'lost') {
      G.net?.close(); G.net = null;
      if (G.screen === 'game') { toLobbyScreen(); hud.toast(m.msg || '連線中斷', 4000); }
      showPick(); setStatus('off', m.msg || '發生錯誤');
    }
  } else if (m.t === 'start') startMatch(m);
  else if (m.t === 'snap') onSnap(m);
}

function startMatch(m) {
  const players = new Map(m.players.map((p) => [p.id, { name: p.n, bot: !!p.b }]));
  G.match = { plane: m.plane, players, over: false, startTick: m.tick };
  G.myId = m.you;
  G.loot = new Map(m.loot.map((l) => [l[0], { id: l[0], code: l[1], amt: l[2], x: l[3], y: l[4], z: l[5] }]));
  G.storm = unpackStorm(m.storm);
  for (const o of G.others.values()) scene.remove(o.s.root);
  G.others.clear();
  fx.clearLoot();
  G.offset = null; noteServerTick(m.tick);
  if (!m.resumed) {
    G.me = newPlayer(G.myId, players.get(G.myId)?.name || ''); G.pending = []; G.seq = 0; G.sendBuf = [];
    const pp = planePos(m.plane, m.tick * DT);
    G.me.x = pp.x; G.me.z = pp.z; G.me.y = PLANE_ALT - 2;
    G.yaw = Math.atan2(-(m.plane.bx - m.plane.ax), -(m.plane.bz - m.plane.az)); G.pitch = -0.25;
    G.dead = null; G.result = null; G.watch = -1; G.specShown = false;
    $('feed').innerHTML = '';
  }
  G.prevPos.set(G.me.x, G.me.y, G.me.z); G.curPos.copy(G.prevPos);
  toGameScreen();
  if (!m.resumed) hud.banner('鹽岬島', '運輸機已起飛 · 選好落點後跳傘', '', 3200);
}

function onSnap(m) {
  if (!G.match) return;
  noteServerTick(m.k);
  G.alive = m.n;
  // 其他玩家
  const seen = new Set();
  for (const e of m.e) {
    const id = e[0]; if (id === G.myId) continue;
    seen.add(id);
    let o = G.others.get(id);
    if (!o) { o = { id, snaps: [], s: makeSoldier(id), corpse: 0 }; scene.add(o.s.root); G.others.set(id, o); }
    o.snaps.push([m.k, e[1] / 20, e[2] / 20, e[3] / 20, e[4] / 1000, e[5] / 1000, e[6], e[7]]);
    if (o.snaps.length > 12) o.snaps.shift();
    o.corpse = 0;
  }
  for (const [id, o] of G.others) if (!seen.has(id) && !o.corpse) { if (o.snaps.length && performance.now() - (o.goneAt || 0) > 0) { o.goneAt = o.goneAt || performance.now(); if (performance.now() - o.goneAt > 1500) { scene.remove(o.s.root); G.others.delete(id); } } }
  // 自己：校正並重播尚未確認的輸入
  if (m.me) {
    const wasDead = G.me.mode === MODE.DEAD;
    applySelf(tmp, m.me);
    tmp.id = G.myId; tmp.yaw = G.me.yaw; tmp.pitch = G.me.pitch;
    G.pending = G.pending.filter((i) => i.s > m.a);
    for (const i of G.pending) stepPlayer(tmp, i, { W, dt: DT, time: i.time, plane: G.match.plane }, null);
    const dx = G.me.x - tmp.x, dy = G.me.y - tmp.y, dz = G.me.z - tmp.z, err = Math.hypot(dx, dy, dz);
    if (tmp.mode === G.me.mode && err < 6 && tmp.mode !== MODE.PLANE) G.corr.add(new THREE.Vector3(dx, dy, dz));
    else G.corr.set(0, 0, 0);
    const kills = G.me.kills;
    applySelf(G.me, tmp);
    G.me.yaw = tmp.yaw; G.me.pitch = tmp.pitch;
    if (G.corr.length() < 0.02) G.corr.set(0, 0, 0);
    if (wasDead && G.me.mode !== MODE.DEAD) G.dead = null;
    void kills;
  }
  if (m.ev) for (const ev of m.ev) onEvent(ev);
}

const nameOf = (id) => (id === G.myId ? '你' : G.match?.players.get(id)?.name || '玩家');
const WNAME = (w) => (w === 'storm' ? '毒圈' : WEAPONS[w]?.name || '');
function onEvent(ev) {
  const me = G.me;
  switch (ev.e) {
    case 's': {
      // 其他人的射擊：曳光彈、槍口閃光、槍聲
      const o = new THREE.Vector3(ev.o[0], ev.o[1], ev.o[2]);
      for (const t of ev.t) { const b = new THREE.Vector3(t[0], t[1], t[2]); fx.tracer(o, b, 0.8); fx.puff(b, '#b8a888', 2, 0.25, 0.8); }
      fx.muzzle(o);
      const dist = o.distanceTo(camera.position);
      const rel = new THREE.Vector3().subVectors(o, camera.position).applyQuaternion(camera.quaternion.clone().invert());
      audio.shot(ev.w, dist, Math.max(-1, Math.min(1, rel.x / Math.max(4, dist))));
      break;
    }
    case 'h': {
      hud.hit(ev.hs, ev.k, ev.br); audio.hit(ev.hs, ev.br); if (ev.br) audio.armorBreak(); if (ev.k) audio.kill();
      const o = G.others.get(ev.v);
      if (o) {
        const p = o.s.root.position.clone().add(new THREE.Vector3(0, 1.9, 0)).project(camera);
        if (p.z < 1) hud.dmgNum((p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight, ev.d, ev.hs, ev.br);
        fx.puff(o.s.root.position.clone().add(new THREE.Vector3(0, ev.hs ? 1.65 : 1.1, 0)), ev.br ? '#9cc3d8' : '#7a1a10', 5, 0.3, 1.6);
      }
      break;
    }
    case 'd': {
      G.hurtFlash = 0.5; audio.hurt();
      if (ev.x != null) { const a = Math.atan2(ev.x - me.x, ev.z - me.z); hud.dirHit(-(a - Math.atan2(-Math.sin(G.yaw), -Math.cos(G.yaw)))); }
      break;
    }
    case 'k': {
      const kn = ev.k >= 0 ? nameOf(ev.k) : '', vn = nameOf(ev.v);
      const html = ev.w === 'storm' ? `<span class="v">${esc(vn)}</span><span class="w">被毒圈吞噬</span>` : `<span class="a">${esc(kn)}</span><span class="w">${esc(WNAME(ev.w))}</span>${ev.hs ? '<span class="hs">爆頭</span>' : ''}<span class="v">${esc(vn)}</span>`;
      hud.feed(html, ev.k === G.myId || ev.v === G.myId);
      const o = G.others.get(ev.v);
      if (o) { o.corpse = performance.now(); }
      if (ev.k === G.myId) hud.banner('擊殺', `${vn} · ${ev.d} 公尺${ev.hs ? ' · 爆頭' : ''}`, '', 1600);
      break;
    }
    case 'dead': {
      G.dead = ev; G.watch = ev.k >= 0 ? ev.k : -1;
      showDead();
      break;
    }
    case 'end': onEnd(ev); break;
    case 'l+': for (const l of ev.l) G.loot.set(l[0], { id: l[0], code: l[1], amt: l[2], x: l[3], y: l[4], z: l[5] }); fx.updateLoot(G.loot, camera, 0, true); break;
    case 'l-': for (const id of ev.i) G.loot.delete(id); fx.updateLoot(G.loot, camera, 0, true); break;
    case 'l~': { const it = G.loot.get(ev.i); if (it) it.amt = ev.a; break; }
    case 'st': {
      const prev = G.storm;
      G.storm = unpackStorm(ev.s);
      if (prev && (prev.phase !== G.storm.phase || prev.state !== G.storm.state)) {
        if (G.storm.state === 'shrink') { hud.banner('毒圈開始收縮', `第 ${G.storm.phase + 1}／8 圈`, 'storm'); audio.storm(); }
        else if (G.storm.next) hud.banner('下一個安全區已標示', `第 ${G.storm.phase + 1}／8 圈 · 查看地圖`, 'storm');
      }
      break;
    }
    case 'got': { audio.pickup(); if (!ev.a) hud.toast(`撿起 ${lootLabel(ev.c, '')}`.replace(' ×', ''), 1200); break; }
    case 'fx': { const o = G.others.get(ev.i); const d = o ? o.s.root.position.distanceTo(camera.position) : 99; if (ev.f === 'land' && d < 60) audio.land(); break; }
    case 'dc': hud.feed(`<span class="a">${esc(nameOf(ev.i))}</span><span class="w">已斷線</span>`); break;
  }
}

function showDead() {
  const d = G.dead; if (!d) return;
  const box = $('deadBox');
  const by = d.k >= 0 ? `淘汰者 <b>${esc(nameOf(d.k))}</b> · ${esc(WNAME(d.w))}${d.hs ? ' <span class="hs">爆頭</span>' : ''} · ${d.d} 公尺` : '被毒圈吞噬';
  box.innerHTML = `<div class="pl">淘汰 <em>#${d.place}</em> <small>/ ${G.match.players.size}</small></div><div class="by pnl">${by}</div>
    <div class="row" id="specRow"></div><div class="acts" style="display:flex;gap:10px"><button class="btn alt" id="bSum">結算並離開</button></div>`;
  box.classList.remove('hidden');
  $('bSum').onclick = () => showResult(null);
  hud.banner('', '');
}

function onEnd(ev) {
  G.match.over = true;
  G.result = ev;
  const won = ev.win === G.myId;
  if (won) { audio.win(); hud.banner('鹽岬最後的生還者', '你贏了這一局', '', 4000); }
  setTimeout(() => showResult(ev), won ? 2600 : 900);
}

function showResult(ev) {
  if (document.pointerLockElement) document.exitPointerLock();
  const me = G.me, total = G.match?.players.size || 0;
  const row = ev?.stand.find((r) => r.id === G.myId);
  const spect = !row && !G.dead && me.mode === MODE.SPECT;
  const place = row?.pl || G.dead?.place || G.alive || 0;
  const won = ev && ev.win === G.myId;
  const winner = ev && ev.win >= 0 ? ev.stand.find((r) => r.id === ev.win) : null;
  $('resultCard').innerHTML = `
    <div class="head"><div><div class="verdict">${won ? '鹽岬最後的生還者' : spect ? '觀戰結束' : '本局結束'}</div><div class="place">${spect ? '觀戰' : `#${place}<small> / ${total}</small>`}</div></div>
      <div class="stats"><div><b>${row ? row.k : me.kills || 0}</b><span>擊殺</span></div><div><b>${row ? row.d : Math.round(me.dmg || 0)}</b><span>傷害</span></div><div><b>${fmt((G.match ? estTick() - G.match.startTick : 0) * DT)}</b><span>存活時間</span></div></div></div>
    ${winner ? `<div class="win">勝者 <b style="color:var(--ochre)">${esc(winner.n)}</b>，${winner.k} 殺</div>` : '<div class="win">對局仍在進行，結束後名次表會出現在這裡。</div>'}
    <div class="acts">${G.solo ? '<button class="btn primary" id="rAgain">再來一場 <small>離線練習</small></button>' : '<button class="btn primary" id="rAgain">再來一場 <small>留在這個房間</small></button>'}<button class="btn alt" id="rLeave">回到大廳</button></div>
    ${ev ? `<div class="tbl">${hud.standings(ev.stand, G.myId)}</div>` : ''}`;
  $('result').classList.remove('hidden'); $('hud').classList.add('hidden');
  $('rAgain').onclick = () => {
    $('result').classList.add('hidden');
    if (G.solo) { connect('solo'); return; }
    toLobbyScreen(); if (G.room) showRoom(G.room);
  };
  $('rLeave').onclick = () => { $('result').classList.add('hidden'); leaveRoom(); };
}

function toGameScreen() {
  G.screen = 'game';
  $('lobby').classList.add('hidden'); $('hud').classList.remove('hidden'); $('result').classList.add('hidden'); $('deadBox').classList.add('hidden');
  input.enabled = true;
  if (isTouch) { $('touch').classList.remove('hidden'); $('menuHint').classList.add('hidden'); if (!input.touch) input.setupTouch($('touch')); }
  else { $('menuHint').classList.remove('hidden'); }
}
function toLobbyScreen() {
  G.screen = 'lobby'; G.match = null;
  $('lobby').classList.remove('hidden'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('menu').classList.add('hidden'); $('bigmap').classList.add('hidden'); $('board').classList.add('hidden');
  input.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock();
  for (const o of G.others.values()) scene.remove(o.s.root);
  G.others.clear(); fx.clearLoot(); plane.visible = false; mySoldier.root.visible = false;
}

// 選單、地圖、名次
input.onLock = (locked) => {
  if (!locked && G.screen === 'game' && !input.touch && $('result').classList.contains('hidden')) $('menu').classList.remove('hidden');
  if (locked) $('menu').classList.add('hidden');
};
input.onKey = (code, down) => {
  if (G.screen !== 'game') return;
  if (code === 'KeyM') $('bigmap').classList.toggle('hidden', !down);
  if (code === 'Tab') {
    const b = $('board');
    if (down) {
      const rows = [...G.match.players.entries()].map(([id, p]) => ({ id, n: p.name, b: p.bot ? 1 : 0, k: id === G.myId ? G.me.kills : '–', d: id === G.myId ? Math.round(G.me.dmg) : '–', pl: 0 }));
      b.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><b>存活 ${G.alive} / ${G.match.players.size}</b><span style="color:var(--mute);font-size:12px">${G.solo ? '離線練習' : '房號 ' + (G.room?.code || '')}</span></div>${hud.standings(rows.filter((r) => r.id === G.myId).concat(rows.filter((r) => r.id !== G.myId).slice(0, 30)), G.myId)}`;
    }
    b.classList.toggle('hidden', !down);
  }
  if (code === 'KeyV' && down) { G.tp = !G.tp; $('tpv').checked = G.tp; }
  if (code === 'Escape' && down && input.touch) $('menu').classList.toggle('hidden');
};
$('bResume').onclick = () => { $('menu').classList.add('hidden'); if (!input.touch) { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* */ } } };
$('bQuit').onclick = () => { $('menu').classList.add('hidden'); leaveRoom(); };
$('sens').oninput = (e) => { input.sens = +e.target.value; try { localStorage.setItem('saltcape.sens', e.target.value); } catch { /* */ } };
$('vol').oninput = (e) => { audio.setVolume(+e.target.value); };
$('tpv').onchange = (e) => { G.tp = e.target.checked; };
try { const s = localStorage.getItem('saltcape.sens'); if (s) { input.sens = +s; $('sens').value = s; } } catch { /* */ }
canvas.addEventListener('click', () => {
  audio.init();
  if (G.screen === 'game' && (G.me.mode === MODE.DEAD || G.me.mode === MODE.SPECT)) cycleWatch();
});
function cycleWatch() {
  const ids = [...G.others.keys()].filter((id) => !G.others.get(id).corpse);
  if (!ids.length) return;
  const i = ids.indexOf(G.watch);
  G.watch = ids[(i + 1) % ids.length];
  G.net?.send({ t: 'spec', i: G.watch });
}

// ---------------- 本機預測：固定 30 Hz ----------------
const localFx = {
  fire(p, w, r, dirs) {
    const eye = new THREE.Vector3(p.x, p.y + eyeHeight(p), p.z);
    const muzzle = camera.position.clone().add(new THREE.Vector3(0.12, -0.1, -0.6).applyQuaternion(camera.quaternion));
    for (const [dx, dy, dz] of dirs) {
      const t = raycastWorld(W, eye.x, eye.y, eye.z, dx, dy, dz, Math.min(520, WEAPONS[w].r2 * 2.6));
      const end = eye.clone().addScaledVector(new THREE.Vector3(dx, dy, dz), Math.min(t, 520));
      fx.tracer(muzzle, end, 1);
      if (t < 500) fx.puff(end, '#c9b996', 3, 0.22, 1);
    }
    fx.muzzle(muzzle);
    vm.fire(w);
    audio.shot(w, 0, 0);
    const kick = { p9: 0.018, smg: 0.009, ar: 0.014, sg: 0.05, dmr: 0.03, sr: 0.06 }[w] || 0.01;
    G.recoil += kick * (1 - p.ads * 0.35);
    G.yaw += (Math.random() - 0.5) * kick * 0.6;
  },
  event(p, e) {
    if (e === 'chute') audio.chute();
    if (e === 'land' || e === 'thud') audio.land();
    if (e === 'reload') audio.reload();
    if (e === 'plate') audio.plate();
    if (e === 'jump') hud.banner('', '');
  },
};
function stepLocal() {
  const me = G.me;
  let b = input.bits();
  input.consumePulses();
  if (me.mode === MODE.DEAD || me.mode === MODE.SPECT) b = 0;
  const useId = b & BITS.USE && G.aimLoot ? G.aimLoot.id : 0;
  const time = estTick() * DT;
  const inp = { b, yaw: G.yaw, pitch: G.pitch, u: useId, vt: Math.round(renderTick() * 10) / 10, time };
  G.prevPos.set(me.x, me.y, me.z);
  stepPlayer(me, inp, { W, dt: DT, time, plane: G.match.plane }, localFx);
  G.curPos.set(me.x, me.y, me.z);
  G.seq++;
  const rec = { s: G.seq, b, y: Math.round(G.yaw * 10000) / 10000, p: Math.round(G.pitch * 10000) / 10000 };
  if (useId) rec.u = useId;
  rec.vt = inp.vt;
  G.pending.push({ s: G.seq, b, yaw: rec.y, pitch: rec.p, u: useId, time });
  if (G.pending.length > 90) G.pending.shift();
  G.sendBuf.push(rec);
  if (G.sendBuf.length >= 2) { G.net?.send({ t: 'in', l: G.sendBuf }); G.sendBuf = []; }
  // 腳步聲
  if (me.mode === MODE.GROUND && me.og) {
    const sp = Math.hypot(me.vx, me.vz);
    G.stepT -= DT * sp;
    if (G.stepT <= 0 && sp > 1) { G.stepT = me.spr ? 2.6 : 1.9; if (!me.cr) audio.step(0, 0, 0); }
  }
}

// ---------------- 畫面 ----------------
const clock = new THREE.Clock();
let lobbyT = 0, pingT = 0;
const tv = new THREE.Vector3(), tq = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, clock.getDelta());
  const time = clock.elapsedTime;
  if (G.screen === 'game' && G.match) gameFrame(dt, time);
  else lobbyFrame(dt, time);
  world.update(camera, time);
  grass.update(camera, time, G.screen === 'game' && camera.position.y - terrainAt(W, camera.position.x, camera.position.z) < 60);
  renderer.clear();
  renderer.render(scene, camera);
  if (G.screen === 'game' && vm.rig.visible) { renderer.clearDepth(); renderer.render(vm.scene, vm.cam); }
  pingT -= dt; if (pingT <= 0) { pingT = 2; G.net?.ping(); }
}

function lobbyFrame(dt, time) {
  lobbyT += dt;
  const a = lobbyT * 0.035 + 2.2;
  camera.fov = 52; camera.updateProjectionMatrix();
  camera.position.set(Math.cos(a) * 260 - 20, 120 + Math.sin(lobbyT * 0.05) * 12, Math.sin(a) * 260 + 40);
  camera.lookAt(-20, 20, 40);
  fx.update(dt, time, null, null, camera.position);
  audio.ambient(0, 0, 0);
}

function gameFrame(dt, time) {
  const me = G.me;
  // 視角：滑鼠
  const [mx, my] = input.takeMouse();
  const sl = me.slots[me.cur];
  if (my > 0) G.kickAcc = Math.max(0, (G.kickAcc || 0) - my * 0.0022);
  const zoom = sl && me.mode === MODE.GROUND ? 1 + (WEAPONS[sl[0]].zoom - 1) * me.ads : 1;
  const sens = 0.0022 * input.sens / Math.pow(zoom, 0.8);
  G.yaw -= mx * sens; G.pitch -= my * sens;
  // 後座力：往上踢；停火後自動拉回約七成
  const rec = G.recoil * Math.min(1, dt * 18);
  G.pitch += rec; G.recoil -= rec; G.kickAcc = (G.kickAcc || 0) + rec * 0.7;
  if (!(input.bits() & BITS.FIRE) || (sl && sl[2] === 0)) { const back = G.kickAcc * Math.min(1, dt * 5); G.pitch -= back; G.kickAcc -= back; }
  G.pitch = Math.max(-1.45, Math.min(1.45, G.pitch));
  // 固定步長推進
  G.acc += dt;
  let n = 0;
  while (G.acc >= DT && n < 5) { G.acc -= DT; n++; stepLocal(); }
  if (G.acc > 0.25) G.acc = 0;
  const alpha = G.acc / DT;
  G.corr.multiplyScalar(Math.max(0, 1 - dt * 12));
  const pos = G.prevPos.clone().lerp(G.curPos, alpha).add(G.corr);
  if (me.mode === MODE.PLANE) { const pp = planePos(G.match.plane, estTick() * DT); pos.set(pp.x, PLANE_ALT - 2, pp.z); }
  // 其他玩家內插
  const rt = renderTick();
  for (const o of G.others.values()) updateOther(o, rt, dt);
  // 運輸機
  const ppos = planePos(G.match.plane, estTick() * DT);
  plane.visible = ppos.u < 1.08 && ppos.u > -0.05;
  if (plane.visible) {
    plane.position.set(ppos.x, PLANE_ALT, ppos.z);
    plane.rotation.set(0, Math.atan2(-ppos.dx, -ppos.dz), 0);
    plane.traverse((o) => { if (o.userData.prop) o.rotation.z += dt * 40; });
  }
  // 鏡頭
  const alive = me.mode !== MODE.DEAD && me.mode !== MODE.SPECT;
  let fp = false, focus = { x: pos.x, z: pos.z, yaw: G.yaw };
  if (!alive) {
    let t = G.others.get(G.watch);
    if (!t || t.corpse) { const alt = [...G.others.values()].find((o) => !o.corpse); if (alt) { G.watch = alt.id; t = alt; G.net?.send({ t: 'spec', i: alt.id }); } }
    if (t) {
      const p = t.s.root.position;
      const o = new THREE.Vector3(p.x, p.y + 1.6, p.z);
      const dir = new THREE.Vector3(Math.sin(G.yaw) * Math.cos(G.pitch), -Math.sin(G.pitch) + 0.08, Math.cos(G.yaw) * Math.cos(G.pitch)).normalize();
      const hit = raycastWorld(W, o.x, o.y, o.z, dir.x, dir.y, dir.z, 5.8);
      camera.position.copy(o).addScaledVector(dir, Math.max(0.4, Math.min(5.5, hit - 0.35)));
      camera.lookAt(p.x, p.y + 1.4, p.z);
      focus = { x: p.x, z: p.z, yaw: t.s.root.rotation.y };
      $('specRow') && ($('specRow').innerHTML = `觀戰 <b>${esc(nameOf(t.id))}</b> · 點擊畫面切換 · 移動滑鼠繞看`);
    }
    mySoldier.root.visible = false;
  } else if (me.mode === MODE.PLANE) {
    const d = 46;
    camera.position.set(ppos.x + Math.sin(G.yaw) * Math.cos(G.pitch) * d, PLANE_ALT + 6 - Math.sin(G.pitch) * d, ppos.z + Math.cos(G.yaw) * Math.cos(G.pitch) * d);
    camera.lookAt(ppos.x, PLANE_ALT, ppos.z);
    mySoldier.root.visible = false;
  } else if (me.mode === MODE.FALL || me.mode === MODE.CHUTE) {
    const d = me.mode === MODE.CHUTE ? 10 : 6.5;
    camera.position.set(pos.x + Math.sin(G.yaw) * Math.cos(G.pitch) * d, pos.y + 2.2 - Math.sin(G.pitch) * d, pos.z + Math.cos(G.yaw) * Math.cos(G.pitch) * d);
    camera.lookAt(pos.x, pos.y + (me.mode === MODE.CHUTE ? 2.5 : 0.6), pos.z);
    mySoldier.root.visible = true;
  } else {
    const eye = pos.y + (me.cr ? 1.12 : 1.62);
    if (G.tp) {
      const back = 3.1, right = 0.65;
      const fwd = new THREE.Vector3(-Math.sin(G.yaw) * Math.cos(G.pitch), Math.sin(G.pitch), -Math.cos(G.yaw) * Math.cos(G.pitch));
      const rgt = new THREE.Vector3(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
      const origin = new THREE.Vector3(pos.x, eye + 0.15, pos.z);
      const want = origin.clone().addScaledVector(fwd, -back).addScaledVector(rgt, right);
      const dir = want.clone().sub(origin); const L = dir.length(); dir.normalize();
      const hit = raycastWorld(W, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, L + 0.3);
      camera.position.copy(origin).addScaledVector(dir, Math.max(0.3, Math.min(L, hit - 0.3)));
      camera.rotation.set(G.pitch, G.yaw, 0, 'YXZ');
      mySoldier.root.visible = true;
    } else {
      camera.position.set(pos.x, eye, pos.z);
      camera.rotation.set(G.pitch, G.yaw, 0, 'YXZ');
      fp = true;
      mySoldier.root.visible = false;
    }
  }
  if (mySoldier.root.visible) {
    mySoldier.root.position.copy(pos); mySoldier.root.rotation.y = G.yaw;
    const w = me.slots[me.cur];
    poseSoldier(mySoldier, { mode: me.mode, cr: me.cr, speed: Math.hypot(me.vx, me.vz), spr: me.spr, pitch: G.pitch, w: w ? WEAPON_KEYS.indexOf(w[0]) : -1, reload: me.rt > 0 }, dt);
  }
  // 視野
  const baseFov = 78;
  const scope = fp && sl && me.ads > 0.85 && WEAPONS[sl[0]].zoom > 3;
  camera.fov = baseFov / (fp ? zoom : 1) - (me.spr && fp ? -4 : 0);
  if (me.mode === MODE.FALL) camera.fov = 84;
  camera.updateProjectionMatrix();
  // 第一人稱槍
  if (fp && sl) vm.setWeapon(sl[0]); else if (!fp) vm.setWeapon(sl ? sl[0] : '');
  const moving = Math.hypot(me.vx, me.vz) > 0.6 && me.og;
  vm.update(dt, { aspect: camera.aspect, ads: me.ads, moving, sprint: !!me.spr, reload: me.rt > 0, reloadT: sl ? 1 - me.rt / WEAPONS[sl[0]].reload : 0, mouseDX: mx, mouseDY: my, plate: me.pt > 0, visible: fp && alive && !scope });
  // 毒圈
  const st = G.storm ? stormAt(G.storm, estTick() * DT) : null;
  const inStorm = st && alive && me.mode !== MODE.PLANE && Math.hypot(pos.x - st.x, pos.z - st.z) > st.r;
  fx.update(dt, time, st, G.storm?.next, camera.position);
  scene.fog.color.copy(FOG).lerp(new THREE.Color('#b8542e'), inStorm ? 0.55 : 0);
  scene.fog.density = inStorm ? 0.004 : me.mode === MODE.GROUND ? 0.0011 : 0.00032;
  scene.background.copy(scene.fog.color);
  fx.updateLoot(G.loot, camera, dt);
  // 撿取目標
  G.aimT -= dt;
  if (G.aimT <= 0) { G.aimT = 0.08; G.aimLoot = alive && me.mode === MODE.GROUND ? findAimLoot() : null; }
  // 目前所在地
  let zone = '鹽岬島野外';
  for (const t of W.towns) if (Math.hypot(focus.x - t.x, focus.z - t.z) < t.r + 40) zone = t.name;
  // 聲音
  const sp = Math.hypot(me.vx, me.vy, me.vz);
  audio.ambient(me.mode === MODE.FALL ? Math.min(1, sp / 50) : me.mode === MODE.CHUTE ? 0.25 : 0, plane.visible ? Math.max(0, 1 - plane.position.distanceTo(camera.position) / 900) : 0, inStorm ? 1 : 0);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.6);
  const hag = me.y - groundAt(W, me.x, me.z, me.y, 0.34, 0.4);
  hud.update(dt, {
    me, focus, alive: G.alive, storm: G.storm, stormCur: st, stormNext: G.storm?.next, stormRem: G.storm ? stormRemaining(G.storm, estTick() * DT) : 0,
    plane: ppos.u < 1 ? G.match.plane : null, planePos: ppos.u < 1 && ppos.u > 0 ? ppos : null, aimLoot: G.aimLoot, hag, speed: sp, zone,
    canJump: ppos.u > 0.06, inStorm, hurtFlash: G.hurtFlash, scope, spread: me.mode === MODE.GROUND ? currentSpread(me) : 0, touch: input.touch,
  });
  if (!alive) {
    if (me.mode === MODE.SPECT && !G.dead && !G.specShown) {
      G.specShown = true;
      $('deadBox').innerHTML = `<div class="pl" style="font-size:26px">觀戰中</div><div class="by pnl">對局已開始，下一場會自動帶你上機</div><div class="row" id="specRow"></div>`;
    }
    if ($('result').classList.contains('hidden')) $('deadBox').classList.remove('hidden');
  }
  // 網路逾時
  if (!G.solo && performance.now() - G.lastNet > 4000 && G.net) $('netWarn').classList.remove('hidden');
}

function updateOther(o, rt, dt) {
  const S = o.snaps;
  if (!S.length) return;
  let a = S[0], b = S[0];
  for (let i = 0; i < S.length - 1; i++) if (S[i][0] <= rt && S[i + 1][0] >= rt) { a = S[i]; b = S[i + 1]; break; }
  if (rt > S[S.length - 1][0]) a = b = S[S.length - 1];
  const f = b[0] > a[0] ? Math.max(0, Math.min(1, (rt - a[0]) / (b[0] - a[0]))) : 0;
  const x = a[1] + (b[1] - a[1]) * f, y = a[2] + (b[2] - a[2]) * f, z = a[3] + (b[3] - a[3]) * f;
  let dyaw = b[4] - a[4]; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  const yaw = a[4] + dyaw * f, pitch = a[5] + (b[5] - a[5]) * f;
  const flags = b[6], mode = flags & 7;
  const root = o.s.root;
  const prev = root.position.clone();
  if (o.corpse) {
    root.rotation.x = Math.min(Math.PI / 2, root.rotation.x + dt * 5);
    if (performance.now() - o.corpse > 20000) root.visible = false;
    return;
  }
  root.position.set(x, y, z);
  root.rotation.set(0, yaw, 0);
  const spd = dt > 0 ? Math.hypot(root.position.x - prev.x, root.position.z - prev.z) / dt : 0;
  o.spd = (o.spd || 0) * 0.8 + Math.min(12, spd) * 0.2;
  root.visible = mode !== MODE.PLANE;
  poseSoldier(o.s, { mode, cr: (flags >> 3) & 1, speed: o.spd, spr: (flags >> 5) & 1, pitch, w: b[7], reload: (flags >> 7) & 1 }, dt);
}

function findAimLoot() {
  const me = G.me, eye = new THREE.Vector3(me.x, me.y + eyeHeight(me), me.z);
  const f = new THREE.Vector3(-Math.sin(G.yaw) * Math.cos(G.pitch), Math.sin(G.pitch), -Math.cos(G.yaw) * Math.cos(G.pitch));
  let best = null, bs = -1;
  for (const it of G.loot.values()) {
    const dx = it.x - me.x, dz = it.z - me.z;
    if (dx * dx + dz * dz > 2.7 * 2.7) continue;
    const dy = it.y - me.y; if (dy < -1.2 || dy > 2.2) continue;
    tq.set(it.x - eye.x, it.y + 0.1 - eye.y, it.z - eye.z);
    const d = tq.length(); tq.normalize();
    const dot = tq.dot(f);
    const sc = dot - d * 0.05;
    if ((dot > 0.8 || d < 1.3) && sc > bs) { bs = sc; best = it; }
  }
  return best;
}

// ---------------- 測試與截圖用 ----------------
window.__sc = {
  ready: true, G, W, camera, world,
  solo: (name = '測試員') => { nameInput.value = name; connect('solo'); },
  match: () => G.net?.match,
  serverMe: () => G.net?.match?.byId.get(G.myId),
  look: (yaw, pitch) => { G.yaw = yaw; G.pitch = pitch; },
  // 離線練習限定：把自己放到指定位置與模式（0 機上 1 自由落體 2 傘 3 地面）
  place: (x, z, mode = 3, y = null) => {
    const sp = G.net?.match?.byId.get(G.myId); if (!sp) return false;
    sp.x = x; sp.z = z; sp.mode = mode; sp.vx = sp.vz = sp.vy = 0;
    sp.y = y ?? groundAt(W, x, z, 400, 0.34, 0) + (mode === 3 ? 0 : 300);
    if (mode === 3) sp.y = groundAt(W, x, z, y ?? 400, 0.34, 0.6);
    Object.assign(G.me, { x: sp.x, y: sp.y, z: sp.z, mode, vx: 0, vy: 0, vz: 0 });
    G.prevPos.set(sp.x, sp.y, sp.z); G.curPos.copy(G.prevPos); G.pending = [];
    return true;
  },
  give: (w, r = 2) => { const sp = G.net?.match?.byId.get(G.myId); if (!sp) return; sp.slots[1] = [w, r, 40]; sp.cur = 1; sp.ammo.h = sp.ammo.l = 200; sp.ammo.s = 30; sp.ammo.n = 20; sp.vest = 3; sp.ar = 150; sp.pinv = 5; },
};
requestAnimationFrame(frame);
if (urlRoom && SERVER && nameInput.value) setTimeout(() => connect('join', urlRoom), 300);
void decodeLoot; void RARITY; void terrainAt;
