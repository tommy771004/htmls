// 墨嶺行 · Ink Ridge（作品 277）：水墨風第三人稱 3D 平台解謎原型。
// 規格見 ../SPEC.md；測試 API：window.__ink
import * as THREE from 'three';
import { buildLevel as level1 } from './levels/l1.js';
import { buildLevel as level2 } from './levels/l2.js';
import { makeHero } from './hero.js';
import { makePlayer } from './player.js';
import { makeCamera } from './camera.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { makeSky, makeClouds, makeSnow } from './sky.js';
import { makePost } from './post.js';
import { makeVFX } from './vfx.js';
import { inkUniforms, inkMaterial } from './ink.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const coarse = matchMedia('(pointer: coarse)').matches;
if (coarse) document.body.classList.add('touch');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = false;

const LV = new URLSearchParams(location.search).get('lv') === '2' ? 2 : 1;
const scene = new THREE.Scene();
const level = (LV === 2 ? level2 : level1)(scene);
const env = level.env || {};
scene.fog = new THREE.Fog(...(env.fog || [0xddd2bd, 50, 260]));
scene.background = new THREE.Color(env.bg ?? 0xe4d6b8);

const hemi = new THREE.HemisphereLight(...(env.hemi || [0xeee2c8, 0x5d6372, 1.25]));
scene.add(hemi);
const sun = new THREE.DirectionalLight(...(env.sun || [0xfff0d8, 2.4]));
const sunDir = new THREE.Vector3(0.55, 1.0, 0.42).normalize();
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 6, far: 88 });
sun.shadow.bias = -0.0009; sun.shadow.normalBias = 0.052;
scene.add(sun, sun.target);

const sky = makeSky(env.sky); scene.add(sky);
const clouds = makeClouds(); clouds.visible = env.clouds !== false; scene.add(clouds);
const snow = env.snow ? makeSnow() : null; if (snow) { snow.material.uniforms.uPx.value = renderer.getPixelRatio(); scene.add(snow); }
const hero = makeHero(scene);
const sfx = makeAudio();
level.sfx = sfx;
const vfx = makeVFX(scene);
level.vfx = vfx;
const player = makePlayer(level, sfx);
// 以音效事件為觸發點串接視覺演出（腳步揚塵、落地氣浪、抓壁碎屑、出刀飛墨、鐘聲音波）
{
  const snowy = !!env.snow;
  const wrap = (name, fn) => { const o = sfx[name]; sfx[name] = (...a) => { fn(...a); return o?.(...a); }; };
  wrap('step', (v = 1) => { const s = player.s; if (s.mode === 'ground' && v > 0.55) vfx.footstep(s.pos.x, s.pos.y, s.pos.z, snowy); });
  wrap('land', (v = 0.5) => { const s = player.s; vfx.landBurst(s.pos.x, s.pos.y, s.pos.z, snowy, 0.55 + v * 0.8); });
  wrap('grab', () => { const s = player.s; vfx.grabSparks(s.pos.x, s.pos.y + 1.9, s.pos.z, snowy); });
  wrap('swish', () => { const s = player.s; vfx.slashInk(s.pos.x, s.pos.y, s.pos.z, s.yaw); });
}
const camera = makeCamera(level.world, innerWidth / innerHeight);
const post = makePost(renderer);
const input = makeInput(canvas, $('pad'));

// ---------- 遊戲狀態 ----------
const G = { started: false, paused: false, done: false, time: 0, checkpoint: null, fade: 0, deathT: 0, manual: false, lastLockLoss: 0, hint: null, hintT: 0, hintsDone: new Set(), section: '', frameMs: 16.7, birdsT: 0 };
const startCP = { pos: level.start.pos.clone(), spawn: level.start.pos.clone(), kind: 'start' };
G.checkpoint = startCP;
const visual = { y: player.s.pos.y };

function placeHeroNow() {
  hero.root.position.copy(player.s.pos); hero.root.rotation.y = player.s.yaw; visual.y = player.s.pos.y;
}
placeHeroNow();
hero.root.updateMatrixWorld(true);

// ---------- 腳底接觸水墨影（在背光區仍穩固貼地） ----------
const footShadow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 6, 64, 64, 60);
  rg.addColorStop(0, 'rgba(20,21,28,0.52)');
  rg.addColorStop(0.55, 'rgba(20,21,28,0.22)');
  rg.addColorStop(1, 'rgba(20,21,28,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 0.96),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  );
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  return m;
})();

// ---------- 烏鴉群（遠景）：一個 InstancedMesh ----------
const NB = 16;
const birdGeo = new THREE.BufferGeometry();
birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([
  // 鳥身與分叉尾羽
  0, 0.01, 0.18, -0.055, 0, -0.04, 0.055, 0, -0.04,
  -0.055, 0, -0.04, 0, -0.01, -0.22, 0.055, 0, -0.04,
  // 左內翼＋左外翼尖
  -0.04, 0, 0.08, -0.32, 0.05, 0.02, -0.05, 0, -0.08,
  -0.32, 0.05, 0.02, -0.58, -0.03, -0.10, -0.26, 0.02, -0.08,
  // 右內翼＋右外翼尖
  0.04, 0, 0.08, 0.05, 0, -0.08, 0.32, 0.05, 0.02,
  0.32, 0.05, 0.02, 0.26, 0.02, -0.08, 0.58, -0.03, -0.10,
], 3));
const birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshBasicMaterial({ color: 0x17171c, side: THREE.DoubleSide, fog: true }), NB);
birds.frustumCulled = false;
birds.visible = env.birds !== false;
scene.add(birds);
const birdData = Array.from({ length: NB }, () => ({ ph: Math.random() * 6, r: 16 + Math.random() * 12, h: 22 + Math.random() * 10, sp: 0.22 + Math.random() * 0.12, off: Math.random() * 6 }));
const bM = new THREE.Matrix4(), bQ = new THREE.Quaternion(), bP = new THREE.Vector3(), bS = new THREE.Vector3(), bY = new THREE.Vector3(0, 1, 0);
function updateBirds(t) {
  birdData.forEach((u, i) => {
    const a = t * u.sp + u.off;
    bP.set(Math.cos(a) * u.r - 4, u.h + Math.sin(t * 0.7 + u.ph) * 1.5, -60 + Math.sin(a) * u.r * 1.4);
    bQ.setFromAxisAngle(bY, -a);
    bS.set(1.6, 1.6 * (0.3 + Math.abs(Math.sin(t * 7 + u.ph))), 1.6);
    birds.setMatrixAt(i, bM.compose(bP, bQ, bS));
  });
  birds.instanceMatrix.needsUpdate = true;
}

// ---------- HUD ----------
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function showHint(h) {
  G.hint = h; G.hintT = 0;
  const el = $('hint');
  if (h) { el.textContent = document.body.classList.contains('touch') ? h.t : h.k; el.classList.add('on'); } else el.classList.remove('on');
}
let hintClock = 0;
function updateHints(dt) {
  hintClock += dt;
  if (G.hint) {
    G.hintT += dt;
    const still = G.hint.when(player.s.pos, player.s.mode, player.s.ledge);
    if ((G.hintT > 6 && !G.hint.sticky) || (!still && G.hintT > 1.2)) { G.hintsDone.add(G.hint.id); showHint(null); return; }
    // 緊急提示（橫木、石塊卡住、冰縫）不排隊
    const u = G.hint.urgent ? null : level.hints.find((h) => h.urgent && !G.hintsDone.has(h.id) && h.when(player.s.pos, player.s.mode, player.s.ledge));
    if (u) { G.hintsDone.add(G.hint.id); showHint(u); }
    return;
  }
  if (hintClock < 0.2) return;
  hintClock = 0;
  for (const h of level.hints) if (!G.hintsDone.has(h.id) && h.when(player.s.pos, player.s.mode, player.s.ledge)) { showHint(h); break; }
}

function litCount() { return level.lanterns.filter((l) => l.lit).length; }
function setPaused(p) {
  if (!G.started || G.done) return;
  G.paused = p; $('pause').hidden = !p; $('veil').classList.toggle('on', p);
  if (p && document.pointerLockElement) document.exitPointerLock();
  input.clear();
}
function resetGame() {
  level.reset();
  for (const l of level.lanterns) { l.lit = false; l.setLit(false); }
  G.checkpoint = startCP; G.time = 0; G.done = false; player.s.falls = 0; G.hintsDone.clear(); showHint(null);
  respawn(startCP, true);
}
function respawn(cp, hard = false) {
  if (cp.pos) level.onRespawn?.(cp);
  const old = player.s.pos.clone();
  player.teleport(cp.spawn, Math.PI);
  placeHeroNow(); hero.root.updateMatrixWorld(true);
  const d = player.s.pos.clone().sub(old);
  hero.shiftCloth(d.x, d.y, d.z);
  camera.snapBehind(player);
  if (!hard) G.fade = 1;
}

$('startBtn').addEventListener('click', start);
function start() {
  if (G.started) return;
  sfx.init();
  G.started = true; $('intro').hidden = true;
  for (const id of ['sec', 'meta']) $(id).classList.add('on');
  $('pauseBtn').classList.add('on'); $('pad').classList.add('on');
  input.st.allowLock = !document.body.classList.contains('touch');
}
addEventListener('keydown', (e) => { if (!G.started && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); start(); } });
$('pauseBtn').addEventListener('click', () => setPaused(!G.paused));
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('cpBtn').addEventListener('click', () => { setPaused(false); respawn(G.checkpoint); });
$('restartBtn').addEventListener('click', () => { setPaused(false); resetGame(); });
$('againBtn').addEventListener('click', () => { $('done').hidden = true; $('veil').classList.remove('on'); resetGame(); });
$('nextBtn').addEventListener('click', () => { location.search = '?lv=2'; });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && G.started && !G.done && !G.paused) { G.lastLockLoss = performance.now(); setPaused(true); }
});
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !document.body.classList.contains('touch')) document.body.classList.add('touch'); }, { capture: true });

// ---------- 模擬 ----------
const STEP = 1 / 60;
function simStep(dt) {
  const inp = input.read();
  if (input.takePause()) { if (performance.now() - G.lastLockLoss > 400) setPaused(!G.paused); }
  if (G.paused || !G.started) return;
  level.update(dt, G.time, player.s.pos, player.s);
  const s = player.s;
  if (s.mode !== 'dead') player.update(dt, inp, camera.fwd, camera.right);
  if (!G.done) G.time += dt;

  // 檢查點與終點
  for (const l of level.lanterns) {
    if (l.lit) continue;
    const dx = l.pos.x - s.pos.x, dz = l.pos.z - s.pos.z;
    if ((dx * dx + dz * dz < 2.6 * 2.6 || (l.line && s.pos.z < l.pos.z)) && Math.abs(l.pos.y - s.pos.y) < 1.6 && s.mode === 'ground') {
      l.lit = true; l.setLit(true); sfx.lantern(); vfx.lanternIgnite(l.pos.x, l.pos.y, l.pos.z);
      if (l.kind === 'finish') finish(); else G.checkpoint = l;
    }
  }
  // 墜落
  if (s.mode !== 'dead' && level.kill(s.pos, G.checkpoint)) { s.mode = 'dead'; G.deathT = 0; s.falls++; if (env.water) sfx.splash(); else sfx.fall(); }
  if (s.mode === 'dead') {
    G.deathT += dt;
    G.fade = Math.min(1, G.deathT / 0.55);
    if (G.deathT > 0.75) respawn(G.checkpoint);
  } else G.fade = Math.max(0, G.fade - dt * 1.6);

  // 角色外觀
  const grounded = s.mode === 'ground';
  visual.y = grounded ? visual.y + (s.pos.y - visual.y) * Math.min(1, dt * 22) : s.pos.y;
  if (Math.abs(visual.y - s.pos.y) > 0.6) visual.y = s.pos.y;
  hero.root.position.set(s.pos.x, visual.y, s.pos.z);
  const dy = s.yaw - hero.root.rotation.y;
  hero.root.rotation.y += Math.atan2(Math.sin(dy), Math.cos(dy)) * Math.min(1, dt * 16);
  const grip = s.mode === 'hang' || s.mode === 'mantle' ? { L: s.ledge, t: s.lt } : s.mode === 'hop' ? { L: s.ledge, t: s.lt, L2: s.tween.L, t2: s.tween.lt, k: s.tween.t } : null;
  hero.animate({ state: s.mode === 'dead' ? 'air' : s.mode, speed: Math.hypot(s.vel.x, s.vel.z), vy: s.vel.y, shimmy: s.shimmyV, prog: s.tween ? s.tween.t : 0, strike: s.strike, land: s.land, hangSwing: s.hangSwing, grip, push: s.pushT > 0 }, dt);
  hero.stepCloth(dt, s.vel, visual.y);

  // 區段與提示
  const sec = level.section(s.pos);
  if (sec !== G.section) { G.section = sec; $('secName').textContent = sec; }
  updateHints(dt);
}

function finish() {
  G.done = true; sfx.finish();
  setTimeout(() => {
    $('dTime').textContent = fmt(G.time); $('dFalls').textContent = player.s.falls; $('dLant').textContent = `${litCount()}/${level.lanterns.length}`;
    $('done').hidden = false; $('veil').classList.add('on');
    if (document.pointerLockElement) document.exitPointerLock();
  }, 1400);
}

// ---------- 畫面 ----------
let tAll = 0, emberT = 0;
function render(dt, now) {
  tAll += dt;
  inkUniforms.uTime.value = tAll;
  const look = input.takeLook();
  camera.update(dt, player, look, now, document.body.classList.contains('touch'));
  hero.syncCloth();
  if (G.heroMixer && !G.paused) G.heroMixer(dt);
  sky.position.copy(camera.cam.position);
  for (const l of clouds.userData.layers) { l.material.uniforms.uTime.value = tAll; l.material.uniforms.uCam.value.copy(camera.cam.position); l.position.x = camera.cam.position.x; l.position.z = camera.cam.position.z; }
  sky.material.uniforms.uTime.value = tAll;
  if (birds.visible) updateBirds(tAll);
  if (snow) snow.update(tAll, camera.cam.position);
  vfx.update(Math.min(dt, 0.05), tAll);
  emberT += dt;
  if (emberT > 0.16) {
    emberT = 0;
    const lit = level.lanterns.filter((l) => l.lit);
    if (lit.length) { const l = lit[Math.floor(Math.random() * lit.length)]; if (l.pos.distanceToSquared(camera.cam.position) < 1600) vfx.ambientEmber(l.pos.x, l.pos.y, l.pos.z); }
  }
  const p = player.s.pos;
  footShadow.position.set(p.x, visual.y + 0.018, p.z);
  const wantSh = player.s.mode === 'ground' ? 0.55 : 0;
  footShadow.material.opacity += (wantSh - footShadow.material.opacity) * Math.min(1, dt * 14);
  footShadow.visible = footShadow.material.opacity > 0.02;
  sun.target.position.set(p.x, p.y, p.z);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 44);
  post.uniforms.uFade.value = G.fade;
  renderer.info.reset();
  post.render(scene, camera.cam, tAll);
  $('tm').textContent = fmt(G.time); $('falls').textContent = player.s.falls;
  if (sfx.running) sfx.setWind(Math.min(1, Math.max(0, (p.y - 2) / 16)));
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  G.frameMs += ((dt * 1000) - G.frameMs) * 0.05;
  if (!G.manual) {
    const n = Math.max(1, Math.ceil(dt / STEP - 0.01));
    for (let i = 0; i < n; i++) simStep(Math.min(STEP, dt / n) || STEP);
  }
  render(dt, now);
}

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  if (snow) snow.material.uniforms.uPx.value = renderer.getPixelRatio();
  camera.cam.aspect = innerWidth / innerHeight;
  camera.cam.fov = innerWidth < innerHeight ? 62 : 50;
  camera.cam.updateProjectionMatrix();
  post.setSize();
}
addEventListener('resize', resize);
resize();

// ---------- 關卡文字與選關 ----------
if (level.meta) {
  document.title = `墨嶺行 · ${level.meta.name}`;
  $('intro').querySelector('.seal').textContent = level.meta.seal;
  $('lvSub').textContent = level.meta.sub; $('lvText').textContent = level.meta.text;
  $('doneTitle').textContent = `${level.meta.name} · 完`; $('doneText').textContent = level.meta.done;
}
$('nextBtn').hidden = LV !== 1;
document.querySelectorAll('.lvs a').forEach((a) => a.classList.toggle('on', a.dataset.lv === String(LV)));
$('secName').textContent = level.section(player.s.pos);

// ---------- 素材插槽：assets/hero.glb、assets/scene.glb（build 時內嵌，沒有就跳過） ----------
async function loadGLB(name) {
  const el = document.getElementById('glb-' + name);
  if (!el) return null;
  const bin = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0));
  const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  return new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
}
const inkify = (root) => root.traverse((o) => {
  if (!o.isMesh) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  o.material = inkMaterial({ color: m?.color?.getHex?.() ?? 0xb9b4a7, map: m?.map ?? null, streak: 0.4, wash: 0.7 });
  o.castShadow = o.receiveShadow = true;
});
async function loadSlots() {
  try {
    const h = await loadGLB('hero');
    if (h) {
      const m = h.scene;
      if (m.userData.rig) {
        // 有骨架的模型：程序動畫驅動骨頭
        let sk = null;
        m.traverse((o) => { if (o.isSkinnedMesh) { sk = o; const s = o.material; o.material = inkMaterial({ color: 0xffffff, map: s.map, normalMap: s.normalMap, side: THREE.DoubleSide, wash: 0.42, grain: 0.56, desat: 0.58 }); o.receiveShadow = true; } });
        hero.useModel(m, sk);
      } else {
      inkify(m);
      const box = new THREE.Box3().setFromObject(m); const k = 1.75 / Math.max(0.01, box.max.y - box.min.y);
      m.scale.setScalar(k); m.position.y = -box.min.y * k;
      hero.root.add(m); hero.hideBody(false);
      if (h.animations.length) {
        const mixer = new THREE.AnimationMixer(m);
        const clips = Object.fromEntries(h.animations.map((c) => [c.name.toLowerCase(), mixer.clipAction(c)]));
        let curA = null;
        G.heroMixer = (dt) => {
          const s = player.s; const sp = Math.hypot(s.vel.x, s.vel.z);
          const want = s.strike >= 0 ? 'strike' : s.mode === 'hang' ? (Math.abs(s.shimmyV) > 0.2 ? 'shimmy' : 'hang') : s.mode === 'mantle' || s.mode === 'hop' ? 'climb' : s.mode === 'air' ? (s.vel.y > 0 ? 'jump' : 'fall') : sp > 0.6 ? 'run' : 'idle';
          const a = clips[want] || clips.idle;
          if (a && a !== curA) { a.reset().fadeIn(0.15).play(); curA?.fadeOut(0.15); curA = a; }
          mixer.update(dt);
        };
      }
      }
    }
    const sc = await loadGLB('scene');
    if (sc) {
      const m = sc.scene; inkify(m); scene.add(m); m.updateMatrixWorld(true);
      m.traverse((o) => {
        if (!o.isMesh) return;
        const n = o.name.toLowerCase(); const b = new THREE.Box3().setFromObject(o);
        if (n.startsWith('col_')) { level.world.addBox(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z); o.visible = false; }
        if (n.startsWith('ledge_')) {
          const nz = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld); nz.y = 0; nz.normalize();
          const alongX = b.max.x - b.min.x > b.max.z - b.min.z;
          const c = b.getCenter(new THREE.Vector3());
          if (alongX) level.world.addLedge(b.min.x, b.max.y, c.z + nz.z * (b.max.z - b.min.z) / 2, b.max.x, c.z + nz.z * (b.max.z - b.min.z) / 2, [0, Math.sign(nz.z) || 1], { top: n.includes('top') });
          else level.world.addLedge(c.x + nz.x * (b.max.x - b.min.x) / 2, b.max.y, b.min.z, c.x + nz.x * (b.max.x - b.min.x) / 2, b.max.z, [Math.sign(nz.x) || 1, 0], { top: n.includes('top') });
        }
      });
      camera.invalidate();
    }
  } catch (e) { console.warn('素材插槽載入失敗', e); }
}

// ---------- 測試 API ----------
window.__ink = {
  ready: false,
  start,
  state() {
    const s = player.s;
    return {
      started: G.started, paused: G.paused, done: G.done, mode: s.mode, pos: [s.pos.x, s.pos.y, s.pos.z], vel: [s.vel.x, s.vel.y, s.vel.z], yaw: s.yaw,
      ledge: s.ledge ? (s.ledge.name || `#${s.ledge.id}`) : null, section: G.section, lit: litCount(), checkpoint: G.checkpoint.kind === 'start' ? -1 : level.lanterns.indexOf(G.checkpoint),
      ...level.debug(), lv: LV, pushing: s.pushT > 0, falls: s.falls, time: G.time,
      hint: G.hint ? G.hint.id : null, frameMs: G.frameMs, draws: renderer.info.render.calls, tris: renderer.info.render.triangles,
      clothOK: hero.cloths.every((c) => c.p.every(Number.isFinite)), cam: camera.cam.position.toArray(),
    };
  },
  manual(on) { G.manual = !!on; },
  reset() { resetGame(); },
  input(o) { input.setOverride(o); },
  step(n = 1) { for (let i = 0; i < n; i++) simStep(STEP); render(STEP, performance.now()); return this.state(); },
  teleport(x, y, z, yaw = Math.PI) { respawn({ spawn: new THREE.Vector3(x, y, z) }, true); player.s.yaw = yaw; hero.root.rotation.y = yaw; camera.snapBehind(player); return this.state(); },
  lanterns: () => level.lanterns.map((l) => [l.pos.x, l.pos.y, l.pos.z, l.kind, l.lit]),
  setCamYaw(y) { camera.c.yaw = y; camera.c.lastInput = performance.now(); },
  heroDbg: () => hero.debugHands(),
  setFov(v) { camera.cam.fov = v; camera.cam.updateProjectionMatrix(); },
};

loadSlots().finally(() => {
  requestAnimationFrame((t) => { last = t; frame(t); window.__ink.ready = true; });
});
