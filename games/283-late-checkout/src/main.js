// 主程式：載入與烘焙 → 標題（兩隊 bot 在背景對打）→ 對戰 → 暫停／槍匠／設定 → 結算。
// 模擬在 sim/（純邏輯），這裡負責輸入、鏡頭、把 game.fx 事件接到特效／音效／介面，以及每幀渲染。
import * as THREE from 'three';
import { buildMap } from './sim/map.js';
import { World } from './sim/world.js';
import { Game, RULES, TEAMS, PARTS } from './sim/game.js';
import { buildHotel } from './gfx/hotel.js';
import { BAKE_U } from './gfx/builder.js';
import { Post } from './gfx/post.js';
import { ViewModel } from './gfx/weapon.js';
import { Soldier, TEAM_LOOK } from './gfx/soldier.js';
import { FX } from './gfx/fx.js';
import { Wreck, BREAK_SND } from './gfx/destroy.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';

const KEY = 'late-checkout-283';
const DEF = { sens: 1, fov: 74, vol: 0.8, quality: '', invert: false, fps: false, hold: false, team: 0, diff: 'normal', lo: { optic: 'reflex', barrel: 'std', mag: 'std' } };
const QUAL = {
  low:  { dpr: 1,   scale: 0.75, msaa: 0, shadow: 0 },
  med:  { dpr: 1,   scale: 1,    msaa: 2, shadow: 512 },
  high: { dpr: 1.5, scale: 1,    msaa: 4, shadow: 1024 },
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth = t => t * t * (3 - 2 * t);
const lum = c => c.r * 0.3 + c.g * 0.55 + c.b * 0.15;
const HARD = { marble: 1, wood: 1, parquet: 1 };
const METAL = { cabinet: 1, cart: 1, hcart: 1, stool: 1 };

export async function boot() {
  const q = new URLSearchParams(location.search), cv = document.getElementById('c');
  const coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  let S; try { S = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { S = { ...DEF }; }
  S.lo = { ...DEF.lo, ...(S.lo || {}) };
  for (const k of ['optic', 'barrel', 'mag']) if (!PARTS[k].some(p => p.id === S.lo[k])) S.lo[k] = DEF.lo[k];
  if (!QUAL[S.quality]) S.quality = coarse ? 'low' : 'high';
  if (QUAL[q.get('quality')]) S.quality = q.get('quality');
  if (q.get('team')) S.team = q.get('team') === '1' || q.get('team') === 'ember' ? 1 : 0;
  if (['easy', 'normal', 'hard'].includes(q.get('diff'))) S.diff = q.get('diff');
  if (q.get('fps')) S.fps = true;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 無痕模式 */ } };

  const lc = window.__lc = { ready: false, cam: null };
  const sound = new Sound(); sound.vol = S.vol;
  let mode = 'loading', paused = false, panel = null, pauseAt = 0, lockTry = 0;
  let game = null, soldiers = [], vm = null, vmTeam = -1, vmKey = '', viewEnt = null, fp = false, specId = -1;
  const view = { yaw: 0, pitch: 0 }, rec = { p: 0, y: 0 }; let camYaw = 0, camPitch = 0, curYaw = 0, roll = 0, hurtKick = 0;
  const K = {}, M = [false, false, false]; let reloadReq = false, crouchT = false, torchOn = true, mdx = 0, mdy = 0, zoomK = 1;
  let fovK = 1, dmgFlash = 0, lowK = 0, fade = 1, dim = 1, dyn = 1, fps = 60, fpsN = 0, fpsAcc = 0, lowN = 0, lastShotSnd = 0, fast = false;

  const ui = new UI({
    start: auto => start({ auto }),
    act: a => { if (a === 'resume') resume(); else if (a === 'gunsmith' || a === 'settings') setPanel(a); else if (a === 'back') setPanel(null); else if (a === 'quit') toTitle(); else if (a === 'again') start({ auto: game.auto }); else if (a === 'menu') { if (paused) resume(); else openPause(); } },
    set: (k, v) => {
      if (k === 'invert' || k === 'fps' || k === 'hold') S[k] = !S[k]; else S[k] = v;
      if (k === 'vol') sound.setVolume(S.vol);
      if (k === 'quality') { dyn = 1; resize(); }
      if (k === 'team' && mode === 'title') newGame({ auto: true });
      save(); ui.sync(S);
    },
    part: (slot, id) => setPart(slot, id),
    sfx: k => sound.ui(k),
  });
  ui.sync(S);

  // ---------- 渲染器與場景 ----------
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }); }
  catch { ui.loading(0, '這個瀏覽器無法啟用 WebGL'); return; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.autoClear = false; renderer.info.autoReset = false;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(S.fov, 1, 0.05, 400);
  camera.rotation.order = 'YXZ';
  const map = buildMap(), world = new World(map);
  const t0 = performance.now();
  await new Promise(r => setTimeout(r, 30));
  const hotel = await buildHotel(map, world, p => ui.loading(0.08 + p * 0.82));
  const bakeMs = performance.now() - t0;
  const Tx = hotel.textures, lights = hotel.lights;
  scene.add(hotel.group, hotel.extras);
  const env = new THREE.PMREMGenerator(renderer).fromScene(hotel.envScene, 0.04).texture; scene.environment = env;
  const post = new Post(renderer), fx = new FX(scene, Tx, lights), wreck = new Wreck(hotel, map, world, lights, scene);
  fx.onTink = p => { if (mode === 'play' && !fast) sound.tink(p.x, p.z); };
  const TORCH_I = 16, torch = new THREE.SpotLight(0xfff0dc, 0, 36, 0.46, 0.7, 1.1);
  const spill = new THREE.PointLight(0xffe2c0, 0, 8, 1.4); scene.add(spill); // 槍燈漏到腳邊與身旁牆面的餘光
  torch.shadow.camera.near = 0.2; torch.shadow.camera.far = 30; torch.shadow.bias = -0.0015; scene.add(torch, torch.target);
  const lamps = map.lamps.filter(l => l.glow > 0), neon = hotel.extras.userData.neon; let lampT = 0;
  const storm = { t: 6 + Math.random() * 8, L: 0, second: 0, thunderAt: 0, creak: 20 };
  const probeCol = new THREE.Color(), vmProbe = new THREE.Color(0.1, 0.08, 0.06), STUDIO = new THREE.Color(1.15, 1.0, 0.8); let probeT = 0;
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  ui.loading(0.95);

  function resize() {
    const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight), Q = QUAL[S.quality];
    const pr = Math.min(window.devicePixelRatio || 1, Q.dpr) * Q.scale * dyn, rw = Math.round(w * pr), rh = Math.round(h * pr);
    renderer.setPixelRatio(1); renderer.setSize(rw, rh, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); fovK = clamp(1.25 / camera.aspect, 1, 1.9); if (vm) { vm.camera.aspect = w / h; vm.fovK = fovK; }
    post.setSize(rw, rh, Q.msaa);
    const sh = Q.shadow > 0;
    if (torch.castShadow !== sh || (sh && torch.shadow.mapSize.x !== Q.shadow)) {
      torch.castShadow = sh; if (sh) torch.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (torch.shadow.map) { torch.shadow.map.dispose(); torch.shadow.map = null; }
      renderer.shadowMap.needsUpdate = true;
    }
  }
  addEventListener('resize', resize);

  // ---------- 對戰的建立與切換 ----------
  function newGame(o) {
    // 舊角色的材質晚幾幀再丟：先丟的話 shader program 的引用數歸零會被刪掉，新角色又得重編一次（開場卡一下）
    const old = soldiers; for (const s of old) scene.remove(s.group); if (old.length) setTimeout(() => { for (const s of old) s.dispose(); }, 400);
    const seed = +q.get('seed') || ((Date.now() ^ (Math.random() * 1e9)) & 0x7fffffff) || 1;
    game = new Game({ map, world, seed, difficulty: S.diff, playerTeam: S.team, auto: !!o.auto, loadout: S.lo });
    soldiers = game.ents.map(e => { const s = new Soldier(e, Tx); scene.add(s.group); return s; });
    if (!vm || vmTeam !== S.team) { vm = new ViewModel(Tx, TEAM_LOOK[S.team].sleeve); vm.scene.environment = env; vm.camera.aspect = camera.aspect; vm.fovK = fovK; vmTeam = S.team; vmKey = ''; }
    fx.clear(); specId = -1; viewEnt = null; dmgFlash = 0; lc.game = game;
    game.startMatch();
  }
  function start(o = {}) {
    const ua = navigator.userActivation; if (!ua || ua.isActive || ua.hasBeenActive) sound.init();
    const canLock = !!cv.requestPointerLock && !coarse, auto = !!o.auto || !canLock;
    if (o.team !== undefined) S.team = o.team ? 1 : 0; if (o.diff) S.diff = o.diff;
    newGame({ auto }); mode = 'play'; paused = false; setPanel(null); clearInput(); torchOn = true;
    document.body.classList.toggle('watch', auto);
    ui.show('title', false); ui.show('over', false); ui.show('pause', false); ui.show('hud', true); ui.clearFeed();
    if (!auto) lock(false); else if (!o.auto) ui.tip('觀戰模式', 2400);
  }
  function toTitle() {
    mode = 'title'; paused = false; setPanel(null); clearInput(); document.body.classList.remove('watch');
    if (document.pointerLockElement) document.exitPointerLock();
    ui.show('pause', false); ui.show('over', false); ui.show('hud', false); ui.show('board', false); ui.show('title', true);
    newGame({ auto: true }); ui.sync(S);
  }
  function setPart(slot, id) {
    if (!PARTS[slot] || !PARTS[slot].some(p => p.id === id)) return;
    S.lo[slot] = id; save(); ui.gunsmith(S.lo);
    const P = game.player; game.setLoadout(P, S.lo);
    const old = soldiers[P.id]; scene.remove(old.group); old.dispose(); soldiers[P.id] = new Soldier(P, Tx); scene.add(soldiers[P.id].group);
  }
  function setPanel(p) {
    panel = p; ui.show('gunsmith', p === 'gunsmith'); ui.show('settings', p === 'settings');
    ui.show('pause', paused && !p); ui.show('hud', mode === 'play' && !paused);
    if (p === 'gunsmith') ui.gunsmith(S.lo); else if (p === 'settings') ui.sync(S);
  }
  function clearInput() { for (const k in K) K[k] = false; M[0] = M[1] = M[2] = false; reloadReq = false; if (game) { const c = game.player.cmd; if (!game.auto) { c.wx = c.wz = 0; c.fire = c.ads = c.sprint = c.jump = c.reload = false; } } }
  function openPause() {
    if (mode !== 'play' || paused) return;
    paused = true; pauseAt = performance.now(); clearInput(); ui.show('board', false);
    ui.ledger('pauseL', game); ui.hint(''); setPanel(null);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function doResume() { if (!paused) return; paused = false; setPanel(null); ui.show('pause', false); ui.show('hud', true); }
  function resume() { if (!paused) return; if (game.auto) doResume(); else lock(false); }
  function lock(retried) {
    if (document.pointerLockElement === cv) { doResume(); return; }
    const id = ++lockTry; let p = null;
    try { p = cv.requestPointerLock(); } catch { p = null; }
    if (p && p.catch) p.catch(() => lockFail(id, retried));
  }
  // 按 ESC 離開後瀏覽器會擋住約一秒內的再次鎖定：自動重試一次
  function lockFail(id, retried) {
    if (id !== lockTry || document.pointerLockElement === cv) return;
    if (!retried) { ui.hint('正在鎖定滑鼠…'); setTimeout(() => { if (id === lockTry && (paused || mode === 'play') && document.pointerLockElement !== cv) lock(true); }, Math.max(150, pauseAt + 1400 - performance.now())); }
    else if (paused) ui.hint('請再點一次 RESUME');
    else ui.tip('點一下畫面', 2400);
  }
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === cv) { if (paused) doResume(); }
    else if (mode === 'play' && !paused && !game.auto) openPause();
  });
  document.addEventListener('pointerlockerror', () => lockFail(lockTry, true));
  addEventListener('blur', () => { if (mode === 'play' && !game.auto) openPause(); else clearInput(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !game.auto) openPause(); });

  // ---------- 輸入 ----------
  addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      if (mode !== 'play') return;
      if (!paused) openPause(); else if (performance.now() - pauseAt > 350) { if (panel) setPanel(null); else resume(); }
      return;
    }
    if (mode !== 'play') return;
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    K[e.code] = true;
    if (paused) return;
    if (e.code === 'Tab') { ui.ledger('boardL', game); ui.show('board', true); }
    else if (e.code === 'KeyR') reloadReq = true;
    else if (e.code === 'KeyF') { torchOn = !torchOn; sound.ui('click'); }
    else if (e.code === 'KeyC' && !S.hold) crouchT = !crouchT;
    else if (e.code === 'Space') crouchT = false;
  });
  addEventListener('keyup', e => { K[e.code] = false; if (e.code === 'Tab') ui.show('board', false); });
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== cv || paused || mode !== 'play') return;
    const k = 0.0022 * S.sens * zoomK;
    view.yaw -= e.movementX * k; view.pitch = clamp(view.pitch - e.movementY * k * (S.invert ? -1 : 1), -1.45, 1.45);
    mdx += e.movementX; mdy += e.movementY;
  });
  cv.addEventListener('mousedown', e => {
    if (mode !== 'play' || paused) return;
    if (game.auto) { if (e.button === 0) cycleSpec(); return; }
    if (document.pointerLockElement !== cv) { lock(false); return; }
    if (e.button < 3) M[e.button] = true;
    if (e.button === 0 && !game.player.alive) cycleSpec();
  });
  addEventListener('mouseup', e => { if (e.button < 3) M[e.button] = false; });
  addEventListener('pointerdown', () => { if (mode === 'play') sound.init(); }, { passive: true });
  addEventListener('contextmenu', e => { if (mode === 'play') e.preventDefault(); });
  function cycleSpec() {
    const P = game.player, mates = game.ents.filter(e => e.team === P.team && e.alive && (game.auto || e !== P)); if (!mates.length) return;
    const i = mates.findIndex(e => e.id === (viewEnt ? viewEnt.id : -1)); specId = mates[(i + 1) % mates.length].id;
  }
  function applyInput() {
    const p = game.player, c = p.cmd, f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), r = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    const sy = Math.sin(view.yaw), cy = Math.cos(view.yaw);
    c.wx = -sy * f + cy * r; c.wz = -cy * f - sy * r;
    c.sprint = !!(K.ShiftLeft || K.ShiftRight); if (c.sprint && f > 0) crouchT = false;
    c.crouch = S.hold ? !!K.KeyC : crouchT; c.jump = !!K.Space; c.fire = M[0]; c.ads = M[2]; c.reload = reloadReq; reloadReq = false;
    p.yaw = view.yaw + rec.y; p.pitch = clamp(view.pitch + rec.p, -1.45, 1.45);
  }

  // ---------- 模擬事件 → 特效／音效／介面 ----------
  function handleFx() {
    const L = game.fx; if (!L.length) return;
    const E = game.ents, P = game.player, snd = mode === 'play' && !fast, hud = mode === 'play';
    for (let i = 0; i < L.length; i++) {
      const f = L[i], e = E[f.id];
      if (f.t === 'shot') {
        const own = fp && viewEnt === e && !!vm.info, w = e.w;
        if (!fast) {
          if (own) {
            vm.kick(w.recoil, e.ads);
            if (e === P && !game.auto) { const k = w.recoil * (1 - 0.35 * e.ads) * (e.crouch > 0.5 ? 0.85 : 1); rec.p = Math.min(0.22, rec.p + 0.0105 * k * (0.7 + Math.min(e.shots, 8) * 0.06)); rec.y += (Math.random() - 0.5) * 0.009 * k; }
            camera.matrixWorld.extractBasis(_r, _u, _f); _f.negate();
            vm.root.updateWorldMatrix(true, true);
            if (vm.scopeMix > 0.5) _v1.copy(camera.position).addScaledVector(_f, 0.7).addScaledVector(_u, -0.06); else vm.toWorld(vm.flash.position, camera, _v1);
            if (!f.sup) fx.light(_v1, 9 * w.flash);
            if (vm.scopeMix < 0.5) { vm.toWorld(vm.info.eject, camera, _v2); fx.shell(_v2, _r, _u, _f, 0.2 + lum(vmProbe) * 3 + (torchOn ? 0.25 : 0)); }
          } else {
            const s = soldiers[f.id]; s.muzzle(_v1); const d = _v1.distanceTo(camera.position);
            if (!f.sup) fx.flash(_v1, 0.34 * w.flash, d < 28);
            if (d < 14) { _r.set(Math.cos(e.yaw), 0, -Math.sin(e.yaw)); _f.set(-Math.sin(e.yaw), 0, -Math.cos(e.yaw)); _v2.copy(_v1).addScaledVector(_f, -0.45); fx.shell(_v2, _r, UP, _f, 0.5); }
          }
          fx.tracer(_v1.x, _v1.y, _v1.z, f.hx, f.hy, f.hz);
          fx.impact(f.hx, f.hy, f.hz, f.nx, f.ny, f.nz, f.kind, f.kind === 'floor' ? (map.zoneAt(f.hx, f.hz) || {}).floor : undefined, f.item);
        }
        if (snd) {
          const now = performance.now();
          if (own) sound.shot({ own: true, sup: f.sup });
          else if (now - lastShotSnd > 28) { lastShotSnd = now; sound.shot({ x: e.x, z: e.z, sup: f.sup, occ: world.blocked(sound.lx, 1.5, sound.lz, e.x, 1.5, e.z) }); }
          if (f.kind === 'piano') sound.pianoNote(f.hx, f.hz);
          else if (f.kind !== 'none' && f.kind !== 'lamp' && Math.random() < 0.6) sound.impact(f.hx, f.hz, f.kind === 'body' ? 'body' : f.kind === 'glass' ? 'glass' : METAL[f.kind] ? 'metal' : 'wall');
        }
      } else if (f.t === 'lamp') { // 燈被打中（亮滅本身由 lights.update 讀 lamp.s，這裡只管火花與聲音）
        const l = map.lamps[f.lamp];
        if (!fast) fx.lampBurst(l.x, l.hy, l.z, f.dead);
        if (snd) sound.lampPop(l.x, l.z, f.dead);
      } else if (f.t === 'break') { // 家具被打壞：藏幾何與重烘一定要做（快轉時也是），碎片與聲音才看情況
        const it = map.items[f.item], b = map.boxes[it.box];
        wreck.breakItem(it, fast); fx.dropHoles(it.id);
        for (const sd of soldiers) sd.wake(); // 靠在這件家具上的屍體要再掉下來
        if (!fast) fx.breakBurst(b, it.h);
        if (snd) sound.smash(it.x, it.z, BREAK_SND[it.type] || 'wood', Math.min(1, 0.45 + it.w * it.d * it.h * 0.5));
      } else if (f.t === 'hurt') {
        soldiers[f.id].hit(); const by = E[f.by];
        if (fp && viewEnt && f.id === viewEnt.id) {
          dmgFlash = Math.min(1, dmgFlash + 0.3 + f.dmg / 70); hurtKick = (Math.random() < 0.5 ? -1 : 1) * 0.02;
          const dx = by.x - e.x, dz = by.z - e.z, cy = Math.cos(curYaw), sy = Math.sin(curYaw);
          if (hud) ui.damage(Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy)); if (snd) sound.hurt();
        }
        if (fp && viewEnt && f.by === viewEnt.id) { if (hud) ui.hit(f.head, f.dead); if (snd) sound.hit(f.head, f.dead); }
      } else if (f.t === 'kill') {
        const by = E[f.by];
        if (hud) {
          ui.feed(game, by, e, f.head, f.assists.map(a => E[a]));
          if (!game.auto) {
            if (by === P) ui.tip(`擊倒 ${e.name}`); else if (f.assists.includes(P.id)) ui.tip(`助攻 ${e.name}`);
          }
        }
      } else if (f.t === 'reload') { if (snd) sound.reload(f.stage, e.x, e.z, fp && viewEnt === e); }
      else if (f.t === 'dry') { if (snd && fp && viewEnt === e) sound.dry(); }
      else if (f.t === 'step' || f.t === 'land') {
        const own = fp && viewEnt === e; if (f.t === 'land' && own) vm.land = 1;
        if (snd) sound.step(e.x, e.z, own, !!HARD[(map.zoneAt(e.x, e.z) || {}).floor], f.t === 'land' ? 1 : f.loud);
      } else if (f.t === 'round') {
        if (f.phase === 'freeze') {
          fx.clear(); wreck.restore(); fade = 0; view.yaw = P.yaw; view.pitch = 0; rec.p = rec.y = 0; crouchT = false; camYaw = P.yaw; camPitch = 0; specId = -1;
          if (hud) { ui.banner(`ROUND ${f.round}`, '', '', 2400); if (snd) sound.bell(1); }
        } else if (f.phase === 'live') { if (hud && snd) sound.bell(2); }
        else if (f.phase === 'post') {
          const w = f.winner;
          if (hud) { ui.banner(w < 0 ? 'DRAW' : TEAMS[w].name, `${game.score[0]} : ${game.score[1]}`, w < 0 ? '' : w ? 'emb' : 'van', 4200); if (snd) sound.stinger(w === P.team); }
        } else if (f.phase === 'over') {
          if (mode === 'play') {
            mode = 'over'; paused = false; setPanel(null); clearInput(); if (document.pointerLockElement) document.exitPointerLock();
            ui.over(game, f.winner === P.team, game.score[0] === game.score[1]); ui.show('pause', false); ui.show('board', false); ui.show('hud', false); ui.show('over', true);
          }
        }
      }
    }
    L.length = 0;
  }

  // ---------- 視角 ----------
  function pickView() {
    const P = game.player;
    if (mode === 'title') { viewEnt = null; fp = false; return; }
    let v = P;
    if (game.auto || (!P.alive && P.deathT > 1.6)) {
      let s = game.ents[specId];
      if (!s || !s.alive || s.team !== P.team) { s = (game.auto && P.alive) ? P : game.ents.find(e => e.team === P.team && e.alive); specId = s ? s.id : -1; }
      if (s) v = s;
    }
    if (v !== viewEnt) { viewEnt = v; camYaw = v.yaw; camPitch = v.pitch; }
    fp = !lc.cam;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now; if (!(dt > 0)) return;
    const t = now / 1000;
    fpsN++; fpsAcc += dt;
    if (fpsAcc >= 0.5) {
      fps = fpsN / fpsAcc; fpsN = 0; fpsAcc = 0;
      // 撐不住 60 FPS 就逐步降低內部解析度
      if (mode === 'play' && !paused && fps < 48) { if (++lowN >= 4 && dyn > 0.62) { dyn -= 0.12; lowN = 0; resize(); } } else lowN = 0;
    }
    renderer.info.reset();
    pickView();
    const running = mode === 'title' || (mode === 'play' && !paused), human = mode === 'play' && !game.auto;
    if (running) {
      const n = Math.max(1, Math.ceil(dt * 60 - 0.25));
      for (let i = 0; i < n; i++) { if (human && game.player.alive) applyInput(); game.step(dt / n); handleFx(); }
      if (mode === 'title' && game.phase === 'over') newGame({ auto: true });
      const k = Math.min(1, dt * (M[0] && game.player.ammo > 0 ? 2.2 : 7)); rec.p -= rec.p * k; rec.y -= rec.y * k;
    }
    for (const s of soldiers) { s.group.visible = !(fp && s.e === viewEnt); s.update(running ? dt : 0, game, lights); }

    // 鏡頭
    const e = viewEnt; let fov = S.fov;
    if (lc.cam) { const c = lc.cam; camera.position.set(c[0], c[1], c[2]); camera.rotation.set((c[4] || 0) * Math.PI / 180, (c[3] || 0) * Math.PI / 180, 0); curYaw = camera.rotation.y; }
    else if (!e) { const a = t * 0.05; camera.position.set(Math.sin(a) * 3.1, 3.1 + Math.sin(a * 0.6) * 0.5, 10.6 + Math.cos(a * 0.8) * 1.1); camera.lookAt(Math.sin(a + 0.8) * 2.2, 1.7, -3); curYaw = camera.rotation.y; }
    else {
      let yaw, pitch;
      if (e === game.player && human && e.alive) { yaw = view.yaw + rec.y; pitch = clamp(view.pitch + rec.p, -1.5, 1.5); camYaw = yaw; camPitch = pitch; }
      else { if (e.alive) { camYaw += wrap(e.yaw - camYaw) * Math.min(1, dt * 14); camPitch += (e.pitch - camPitch) * Math.min(1, dt * 14); } yaw = camYaw; pitch = camPitch; }
      const dk = e.alive ? 0 : smooth(Math.min(1, e.deathT / 0.7));
      const lv = e.alive ? e.vx * Math.cos(yaw) - e.vz * Math.sin(yaw) : 0;
      hurtKick -= hurtKick * Math.min(1, dt * 9);
      roll += ((-lv * 0.0055 + dk * 0.5) - roll) * Math.min(1, dt * 8);
      const mv = e.alive && e.ground ? Math.min(1, e.speed / 4.3) * (1 - e.ads * 0.85) : 0;
      camera.position.set(e.x, game.eyeY(e) - dk * 1.28 - Math.abs(Math.cos(vm.bob)) * 0.014 * mv - vm.land * 0.05, e.z);
      camera.rotation.set(pitch * (1 - dk * 0.6), yaw, roll + hurtKick);
      curYaw = yaw;
      const z = 1 + (e.w.zoom - 1) * smooth(e.ads); zoomK = 1 / z;
      fov = 2 * Math.atan(Math.tan(S.fov * Math.PI / 360) / z) * 180 / Math.PI + e.sprint * 3 * (1 - e.ads);
    }
    if (fovK > 1) fov = 2 * Math.atan(Math.tan(fov * Math.PI / 360) * fovK) * 180 / Math.PI;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    camera.userData.pxScale = post.h / (2 * Math.tan(camera.fov * Math.PI / 360));
    camera.matrixWorld.extractBasis(_r, _u, _f); _f.negate();
    sound.listener(camera.position.x, camera.position.z, curYaw);

    // 槍燈
    const tOn = torchOn && fp && e && e.alive;
    // 不切 visible：燈的數量一變，所有材質都要重編 shader，會卡一大幀。改成亮度歸零並停掉陰影更新。
    torch.intensity = tOn ? TORCH_I : 0; renderer.shadowMap.autoUpdate = !!tOn;
    if (tOn) { torch.position.copy(camera.position).addScaledVector(_r, 0.16).addScaledVector(_f, 0.12).addScaledVector(_u, -0.14); torch.target.position.copy(camera.position).addScaledVector(_f, 10); torch.target.updateMatrixWorld(); }
    spill.intensity = tOn ? 0.9 : 0; spill.position.copy(camera.position).addScaledVector(_f, 0.3);
    post.fog.uniforms.uTorch.value = tOn ? 0.03 : 0;

    // 第一人稱槍模
    const gs = panel === 'gunsmith', showVM = !lc.cam && mode !== 'title' && e && ((fp && e.alive) || gs);
    if (showVM) {
      const src = gs ? game.player : e, lo = src.loadout, key = lo.optic + lo.barrel + lo.mag;
      if (key !== vmKey) { vm.setLoadout(lo); vmKey = key; }
      probeT -= dt; if (probeT <= 0) { probeT = 0.1; lights.probe(camera.position.x, camera.position.y - 0.25, camera.position.z, probeCol); vmProbe.lerp(probeCol, 0.4); }
      vm.torch = torchOn; vm.setProbe(gs ? STUDIO : vmProbe, tOn);
      let dx = mdx, dy = mdy; if (!(human && e === game.player)) { dx = 0; dy = 0; }
      vm.update(dt, { ads: gs ? 0 : e.ads, sprint: gs ? 0 : e.sprint, crouch: e.crouch, speed: running ? e.speed : 0, reload: !gs && e.reloadT > 0 ? 1 - e.reloadT / e.w.reload : -1, ground: e.ground, dx, dy, gunsmith: gs, gx: fovK > 1 ? 0 : 0.2, gy: fovK > 1 ? 0.72 : -0.02, gz: fovK > 1 ? -1.45 : -1.15 });
    }
    mdx = mdy = 0;
    fx.update(running ? dt : 0, camera, soldiers, t, !!tOn); wreck.update(running ? dt : 0);

    // 燈光：閃爍的壁燈、閃電、體積霧用的最近幾盞燈
    storm.t -= dt; if (storm.t <= 0) { storm.t = 13 + Math.random() * 26; storm.L = 5 + Math.random() * 4; storm.second = 0.12 + Math.random() * 0.12; storm.thunderAt = t + 0.5 + Math.random() * 1.8; }
    if (storm.second > 0) { storm.second -= dt; if (storm.second <= 0) storm.L = Math.max(storm.L, 4.5); }
    storm.L *= Math.exp(-dt * 7.5); BAKE_U.uMoon.value = 1 + storm.L; post.fog.uniforms.uMoon.value = 1 + storm.L;
    lights.update(dt, t, 1 + storm.L);
    if (neon) { const s = 0.03 + 0.97 * lights.S[neon.userData.lamp]; neon.material.color.setRGB(5 * s, 1.1 * s, 0.35 * s); }
    if (storm.thunderAt && t > storm.thunderAt) { storm.thunderAt = 0; sound.thunder(0.55 + Math.random() * 0.45); }
    storm.creak -= dt; if (storm.creak <= 0) { storm.creak = 18 + Math.random() * 30; if (mode === 'play') sound.creak(); }
    hotel.extras.userData.rain.uniforms.uT.value = t;
    const U = post.fog.uniforms, C = camera.position;
    lampT -= dt; if (lampT <= 0) { lampT = 0.2; lamps.sort((a, b) => ((a.x - C.x) ** 2 + (a.z - C.z) ** 2) - ((b.x - C.x) ** 2 + (b.z - C.z) ** 2)); sound.setRain(clamp((C.z - 2) / 11, 0, 1) * 0.8 + clamp((-C.z - 13) / 5, 0, 1) * 0.5); }
    for (let i = 0; i < 10; i++) { const l = lamps[i]; if (l) { U.uLampPos.value[i].set(l.x, l.y, l.z); const k = l.I * l.glow * lights.S[l.follow >= 0 ? l.follow : l.id]; U.uLampCol.value[i].set(l.col[0] * k, l.col[1] * k, l.col[2] * k); } else U.uLampCol.value[i].set(0, 0, 0); }

    // 後製參數
    const O = post.out.uniforms;
    dmgFlash = Math.max(0, dmgFlash - dt * 1.6); O.uDamage.value = fp ? dmgFlash : 0;
    const lowT = fp && e ? (e.alive ? clamp((45 - e.hp) / 45, 0, 1) : 1) : 0; lowK += (lowT - lowK) * Math.min(1, dt * 4); O.uLow.value = lowK;
    fade = Math.min(1, fade + dt / 0.7); O.uFade.value = mode === 'title' ? 1 : smooth(fade);
    dim += ((gs ? 0.5 : 1) - dim) * Math.min(1, dt * 8); O.uDim.value = dim;
    O.uScope.value = showVM && !gs ? vm.scopeMix : 0;

    // HUD
    if (mode === 'play') {
      const P = game.player; let spec = '';
      if (e && game.auto) spec = `觀戰 · <b>${e.isPlayer ? TEAMS[e.team].names[0] : e.name}</b>`;
      else if (e && e !== P) spec = `觀戰 · <b>${e.name}</b>`;
      let gap = 8;
      if (e) { let sp = e.w.hip + e.bloom + (e.speed / 4.3) * 0.02 + (e.ground ? 0 : 0.05); if (e.crouch > 0.5) sp *= 0.8; gap = 3 + sp * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)); }
      ui.hud(game, { e, fp, gap, scope: O.uScope.value, spec, panel: panel || paused, fps: S.fps ? `${Math.round(fps)} FPS · ${renderer.info.render.calls} DC · ${post.w}×${post.h}` : undefined });
      let ti = 0;
      if (fp && e && !paused) for (const m of game.ents) {
        if (ti >= 4 || m.team !== e.team || m === e || !m.alive) continue;
        _v1.set(m.x, game.eyeY(m) + 0.42, m.z); const d = _v1.distanceTo(C); _v1.project(camera);
        if (_v1.z < 1 && Math.abs(_v1.x) < 1.02 && Math.abs(_v1.y) < 1.02 && d < 60) ui.tag(ti++, true, (_v1.x * 0.5 + 0.5) * innerWidth, (-_v1.y * 0.5 + 0.5) * innerHeight, m.isPlayer ? TEAMS[m.team].names[0] : m.name, TEAM_LOOK[m.team].css);
      }
      for (; ti < 4; ti++) ui.tag(ti, false);
    }

    post.render(camera, r => { r.render(scene, camera); if (showVM) { r.clearDepth(); r.render(vm.scene, vm.camera); } }, t);
    lc.ready = true;
  }

  // ---------- 測試／截圖用的掛點 ----------
  Object.assign(lc, {
    dbg: { fx, torch, post, scene, hotel, renderer, sound, K, M, view, map, world, lights, wreck, get game() { return game; }, get vm() { return vm; }, get soldiers() { return soldiers; }, set torchOn(v) { torchOn = v; } },
    start, toTitle, openPause, resume: doResume, panel: setPanel, setPart,
    step(sec) { fast = true; const n = Math.round(sec * 60); for (let i = 0; i < n && game.phase !== 'over'; i++) { game.step(1 / 60); handleFx(); } fast = false; },
    info: () => ({ mode, paused, panel, fps: Math.round(fps), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, size: [post.w, post.h], dyn, bakeMs: bakeMs | 0, stats: hotel.stats,
      round: game.round, phase: game.phase, score: game.score.slice(), alive: [game.alive(0), game.alive(1)], view: viewEnt ? viewEnt.name : null, lo: { ...game.player.loadout }, auto: game.auto,
      hp: Math.round(game.player.hp), ammo: game.player.ammo, pos: [+game.player.x.toFixed(1), +game.player.z.toFixed(1)] }),
  });

  resize(); newGame({ auto: true }); mode = 'title';
  // 先把兩個場景的 shader 編好（以 HDR render target 的狀態），開場與第一槍才不會頓
  vm.setLoadout(S.lo); vmKey = S.lo.optic + S.lo.barrel + S.lo.mag; renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(post.rtScene); renderer.compile(scene, camera); renderer.compile(vm.scene, vm.camera); renderer.setRenderTarget(null);
  let tPrev = performance.now();
  ui.loading(1); ui.show('title', true); ui.loaded();
  if (q.get('auto')) start({ auto: true });
  if (q.get('cam')) lc.cam = q.get('cam').split(',').map(Number);
  requestAnimationFrame(frame);
}
