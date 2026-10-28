// 進入點：組舞台、蓋街、主迴圈（固定 1/60 步）、輸入、HUD，以及給驗收用的 window.__ml。
import * as THREE from 'three';
import { BIKE, PAPER, POINTS, CAMERA, CAMERAS, STREET, HAZ } from './core/config.js';
import { makeGame, step, DT, upcoming, summary, throwSide } from './core/game.js';
import { launch } from './core/paper.js';
import { makeStage } from './view/stage.js';
import { makeMovers } from './view/movers.js';
import { dayConfig } from './core/week.js';
import { settle } from './core/settle.js';
import { loadSave, writeSave, applyResult, nextWeek } from './core/save.js';
import { loadAll, setEnv } from './view/assets.js';
import { buildWorld } from './view/world.js';
import { makeRider, poseRider, makePaperMesh } from './view/rider.js';
import { makeHud } from './ui/hud.js';
import { makeInput } from './ui/input.js';
import { unlock, play, onEvent, toggleMute } from './ui/sfx.js';

const $ = (s) => document.querySelector(s);
// 畫質：?q=low|high 指定；沒指定時，觸控＋小螢幕（手機）用 low
const Q = new URLSearchParams(location.search).get('q') || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900 ? 'low' : 'high');
const stage = makeStage($('#view'), Q);
const { scene, camera } = stage;
let game, world, rider, movers, A, day, look;
let save = loadSave();
const paperMeshes = [];
const hud = makeHud();
const input = makeInput();

// 投擲預覽：沿拋物線的一串小點（之後依手感決定要不要保留）
const aimDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#f6eedb', transparent: true, opacity: 0.85, fog: false }), 14);
aimDots.frustumCulled = false; scene.add(aimDots);
const _m = new THREE.Matrix4();

/** 開始第 k 天（0–6）：換時段、蓋那天的街、放狗和車 */
function start(k = 0) {
  if (world) for (const m of world.meshes) { scene.remove(m); if (m.isInstancedMesh) m.dispose(); else if (m.geometry) m.geometry.dispose(); }
  movers?.dispose();
  if (rider) scene.remove(rider);
  for (const p of paperMeshes) scene.remove(p);
  paperMeshes.length = 0;
  day = dayConfig(k, save.subsDelta);
  const t = stage.setTime(day.time); look = t.look; setEnv(t.env);
  game = makeGame(day);
  world = buildWorld(scene, game.street, A, look, stage.low ? 3 : 6, stage.low);
  movers = makeMovers(scene, game.haz, A, game.street, game.taken);
  rider = makeRider(A); scene.add(rider);
  // 黃昏、凌晨：車燈往前打一道暖光，頭頂後方一盞冷色補光讓騎士的剪影跳出來（同參考圖的夜景）
  if (look.lights) {
    const spot = new THREE.SpotLight('#ffd9a0', 34 * look.lights, 26, 0.5, 0.6, 1.3);
    spot.position.set(0, 1.0, -0.8); spot.target.position.set(0, 0, -10);
    const rim = new THREE.PointLight('#9fb6ff', 6 * look.lights, 8, 1.5); rim.position.set(0.5, 3.0, 1.8);
    rider.add(spot, spot.target, rim);
  }
  stage.cam.init = false;
  hud.reset(game, day);
}
function finish(e) {
  const r = settle(e.summary, game.stock, e.missions);
  save = applyResult(save, day.index, { ...r, delivered: e.summary.delivered, subs: e.summary.subs });
  writeSave(save);
  hud.end(e.summary, r, day, save, game.ledger.lines, game);
  play('done');
}

function paperMesh(i) {
  while (paperMeshes.length <= i) { const m = makePaperMesh(A); scene.add(m); paperMeshes.push(m); }
  return paperMeshes[i];
}

function syncView(dt) {
  poseRider(rider, game.bike, dt);
  movers.sync(game.t);
  world.update(game.bike);
  stage.follow(game.bike, dt);
  if (state.look) { const b = game.bike, [e, a] = state.look; camera.position.set(b.x + e[0], (b.y || 0) + e[1], b.z + e[2]); camera.lookAt(b.x + a[0], (b.y || 0) + a[1], b.z + a[2]); }
  // 飛行中的報紙＋已落地的報紙
  const all = [...game.papers.map((p) => ({ ...p, fly: true })), ...game.landed];
  all.forEach((p, i) => {
    const m = paperMesh(i); m.visible = true;
    m.position.set(p.x, p.y, p.z);
    m.rotation.set(0, p.fly ? p.t * 6 : 0.3, p.fly ? p.t * 14 * p.side : 0);
  });
  for (let i = all.length; i < paperMeshes.length; i++) paperMeshes[i].visible = false;
  // 投擲預覽
  const st = input.state();
  let n = 0;
  if (game.mode === 'ride' && game.stock > 0 && state.aim) {
    const p = launch(game.bike, throwSide(game, st.steer));
    for (let t = 0.06; t < 1.0 && n < 14; t += 0.065) {
      const y = p.y + p.vy * t - 0.5 * PAPER.gravity * t * t;
      if (y < 0.05) break;
      _m.makeTranslation(p.x + p.vx * t, y, p.z + p.vz * t);
      aimDots.setMatrixAt(n++, _m);
    }
  }
  aimDots.count = n; aimDots.instanceMatrix.needsUpdate = true;
}

// 網址加 ?fps 會在右上角顯示幀率、三角形數（在手機上自己量效能用）
const fpsEl = new URLSearchParams(location.search).has('fps') ? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'fps' })) : null;

// 主迴圈
const state = { paused: false, acc: 0, last: performance.now(), frames: [], aim: true, started: false };
function frame(now) {
  const dt = Math.min(0.1, (now - state.last) / 1000);
  state.last = now;
  if (!state.paused && state.started) {
    state.acc += dt;
    while (state.acc >= DT) { tick(input.consume()); state.acc -= DT; }
  }
  syncView(dt);
  hud.update(game, camera, dt);
  if (fpsEl) { stage.renderer.info.autoReset = false; stage.renderer.info.reset(); }   // 整幀（含陰影、GTAO、後製）一起算
  stage.composer.render(dt);
  state.frames.push(dt * 1000); if (state.frames.length > 240) state.frames.shift();
  if (fpsEl && (state.fpsT = (state.fpsT || 0) + dt) > 0.5) {
    state.fpsT = 0; const p = window.__ml.perf(), r = stage.renderer.info.render;
    fpsEl.textContent = `${(1000 / p.avg).toFixed(0)} fps  ${p.avg.toFixed(1)} ms（p95 ${p.p95.toFixed(1)}）\n${Q}  ${(r.triangles / 1e6).toFixed(2)}M 三角形（整幀）  ${r.calls} calls  ×${stage.renderer.getPixelRatio().toFixed(2)}`;
  }
  requestAnimationFrame(frame);
}
function tick(inp) {
  step(game, inp);
  for (const e of game.events) {
    if (e.type === 'throw') { rider.userData.throwT = 0.32; rider.userData.throwSide = e.side; }
    hud.event(game, e);
    onEvent(e);
    if (e.type === 'done') finish(e);
  }
}

function resize() {
  const w = innerWidth, h = innerHeight;
  stage.resize(w, h);
}
addEventListener('resize', resize);
input.on('cam', () => { stage.setPreset(stage.cam.preset === 'near' ? 'far' : 'near'); hud.cam(stage.cam.preset); });
input.on('restart', () => { start(day.index); state.started = true; hud.go(); });
input.on('aim', () => { state.aim = !state.aim; });
input.on('mute', () => { unlock(); toggleMute(); });
// 按鈕都會解鎖音效（瀏覽器要求使用者先互動）
addEventListener('pointerdown', unlock, { capture: true }); addEventListener('keydown', unlock, { capture: true });
$('#start').addEventListener('click', () => { state.started = true; hud.go(); play('bell'); });
$('#again').addEventListener('click', () => { start(day.index); state.started = true; hud.go(); });
$('#next').addEventListener('click', () => {
  if (save.weekDone) { save = nextWeek(save); writeSave(save); }
  start(Math.min(save.day, 6)); state.started = true; hud.go();
});
$('#week').addEventListener('click', (e) => {
  const li = e.target.closest('li'); if (!li || li.classList.contains('locked')) return;
  start(+li.dataset.day); state.started = true; hud.go();
});

// 模型解壓、建街景之後才開始畫（開場卡片上的「出發」先停用）
const startBtn = $('#start');
startBtn.disabled = true; startBtn.textContent = '載入中…';
A = await loadAll();
if (save.weekDone) { save = nextWeek(save); writeSave(save); }
start(Math.min(save.day, 6));
resize();
hud.cam(stage.cam.preset);
startBtn.disabled = false; startBtn.textContent = '出發';
requestAnimationFrame(frame);

// 驗收／調參用 API
const cfg = { BIKE, PAPER, POINTS, CAMERA, CAMERAS, STREET, HAZ };
window.__ml = {
  ready: true,
  counts: () => world.counts,
  state: () => ({
    mode: game.mode, started: state.started, t: game.t,
    bike: { x: game.bike.x, z: game.bike.z, v: game.bike.v, yaw: game.bike.yaw },
    stock: game.stock, papers: game.papers.length, ...summary(game.ledger), cam: stage.cam.preset, fov: camera.fov,
    day: day.index, time: day.time, quality: Q, wet: game.wet, save: { day: save.day, week: save.week, subsDelta: save.subsDelta },
    dogs: game.haz.dogs.map((d) => ({ x: d.x, z: d.z, state: d.state })), cars: game.haz.cars.map((c) => ({ x: c.x, z: c.z, state: c.state, v: c.v })),
    next: upcoming(game, 1).map((l) => ({ id: l.id, side: l.side, mz: l.mailbox.z })),
  }),
  start: () => { state.started = true; hud.go(); },
  pause: (v = true) => { state.paused = v; },
  /** 暫停即時迴圈，直接推進 n 步（確定性） */
  advance: (n, inp = {}) => { state.paused = true; for (let i = 0; i < n; i++) { tick({ steer: 0, accel: false, ...inp, throw: i === 0 && !!inp.throw }); stage.follow(game.bike, DT); } syncView(DT); return window.__ml.state(); },
  /** 重騎第 k 天（0＝週一） */
  reset: (k = 0) => { start(k); },
  /** 清掉存檔（從週一開始） */
  wipe: () => { save = nextWeek({ week: 0, best: [] }); writeSave(save); },
  setCam: (name) => { stage.setPreset(name); hud.cam(name); },
  /** 截圖用的特寫：look([眼睛相對騎士], [看向相對騎士])；look(null) 還原追尾鏡頭 */
  look: (eye, at = [0, 1, 0]) => { state.look = eye ? [eye, at] : null; },
  /** 即時改參數：__ml.set('BIKE.yawRate', 2.2) */
  set: (path, v) => { const [g, k] = path.split('.'); if (!(g in cfg) || !(k in cfg[g])) throw new Error('沒有 ' + path); cfg[g][k] = v; stage.setPreset(stage.cam.preset); return cfg[g][k]; },
  cfg,
  gtao: (on) => { stage.gtao.enabled = on; },
  /** 只畫天空（和 Blender 的 sky-* 對照圖比） */
  sky: stage.sky.material,
  movers: () => movers,
  items: () => ({ ramps: game.street.ramps, bundles: game.street.bundles, vip: game.street.lots.filter((l) => l.vip).map((l) => ({ id: l.id, side: l.side, mz: l.mailbox.z })) }),
  /** 資產一覽：名稱 → 零件（標籤、包圍盒中心與尺寸） */
  assets: () => Object.fromEntries(Object.entries(A).map(([k, a]) => [k, a.parts.map((p) => { p.geometry.computeBoundingBox(); const b = p.geometry.boundingBox.clone().applyMatrix4(p.matrix); const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); return [p.tag, c.toArray().map((v) => +v.toFixed(2)), s.toArray().map((v) => +v.toFixed(2)), p.geometry.index ? p.geometry.index.count / 3 : 0]; })])),
  skyOnly: (v = true) => { for (const o of scene.children) if (o.material?.name !== 'sky') o.visible = !v; },
  /** 同步渲染 n 幀、每幀 gl.finish，量實際渲染耗時（不受螢幕更新率 16.7 ms 的上限影響） */
  bench: (n = 60) => { const gl = stage.renderer.getContext(); gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { stage.composer.render(1 / 60); gl.finish(); } return (performance.now() - t0) / n; },
  perf: () => { const f = [...state.frames].sort((a, b) => a - b); return { avg: f.reduce((a, b) => a + b, 0) / (f.length || 1), p95: f[Math.floor(f.length * 0.95)] || 0, n: f.length }; },
  info: () => { stage.renderer.info.autoReset = false; stage.renderer.info.reset(); stage.renderer.render(scene, camera); const r = { calls: stage.renderer.info.render.calls, tris: stage.renderer.info.render.triangles }; stage.renderer.info.autoReset = true; return r; },
};
