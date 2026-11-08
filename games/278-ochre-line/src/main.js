// 赭線 OCHRE LINE：開機、主迴圈、測試介面。
import { POSES, flushAll, vm, selectWeapon as vmSelect } from './game/viewmodel.js';
import { nav, nearest, tagged } from './map/nav.js';
import { step } from './game/mover.js';
import { snapshotActive } from './core/tmp.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Bone as B0 } from '@babylonjs/core/Bones/bone.pure.js';
import { Skeleton as S0 } from '@babylonjs/core/Bones/skeleton.js';
import '@babylonjs/loaders/glTF/2.0/index.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Materials/standardMaterial.js';
import { createEngine } from './core/engine.js';
import { LAYOUT } from './map/layout.js';
import { buildMap } from './map/build.js';
import { buildCollision } from './map/collide.js';
import { buildNav } from './map/nav.js';
import { initCollision } from './game/mover.js';
import { you, teleport, look } from './game/player.js';
import { buildViewmodel } from './game/viewmodel.js';
import { finishNewGuns } from './game/guns/load.js';
import { buildSoldiers, buildWorldGuns, updateSoldiers, clipDebug, chargePos, pool, ik } from './game/soldiers.js';
import { G, WEAPONS, OPT } from './game/state.js';
import { addMatch } from './game/record.js';
import { world, giveWeapon, fire, clear, spreadOf } from './game/weapons.js';
import { initBots } from './game/bots.js';
import { setupMatch, leaveMatch, onKill, buy, startRound, nextRound } from './game/round.js';
import { tick, frame } from './game/loop.js';
import { buildFx, updateFx, fx } from './fx/particles.js';
import { input, bindInput, lockPointer } from './core/input.js';
import { initAudio, setListener, preloadSfx, sfxStatus } from './audio/sfx.js';
import { initHud, frameHud } from './ui/hud.js';
import { initMenu, showMenu, hideMenu, showPause, hidePause, showResult, hideResult, openTab } from './ui/menu.js';
import { SYNC, endMatch, netBuy } from './net/sync.js';
import { NET, join as netJoin, leave as netLeave, savedName } from './net/client.js';
import { netNotice } from './ui/net.js';
import { initBuy, toggleBuy, frameBuy } from './ui/buy.js';
import { initScore, frameScore } from './ui/score.js';
import { initTouch } from './ui/touch.js';
import { selectWeapon as import_select } from './game/viewmodel.js';
import { stage, startStage, stopStage, frameStage, fitStage, setStage, asideStage, pointStage, tuneStage } from './game/stage.js';
window.__keep = [B0, S0];

const q = new URLSearchParams(location.search);
let canvas = document.getElementById('view');

function placeCam(cam, s) {
  const D = Math.PI / 180;
  cam.position.set(s.x, s.y, s.z); cam.rotation.set(-(s.pitch || 0) * D, (s.yaw || 0) * D, 0);
  if (s.fov) cam.fov = s.fov;
}

/** GPU 裝置遺失：回到開機狀態是唯一安全的路。連續三次就退回 WebGL，別讓壞驅動卡在重載迴圈。這一局的進度會消失，戰績本來就只在打完才記。 */
const LOST_KEY = 'ochre-line.gpulost';
function onGpuLost() {
  const ctx = window.__ol?.ctx; ctx?.engine.stopRenderLoop();
  const n = +(sessionStorage.getItem(LOST_KEY) || 0) + 1; sessionStorage.setItem(LOST_KEY, n);
  const m = document.createElement('p'); m.id = 'gpulost'; m.textContent = '顯示裝置重設了，正在重新載入';
  m.style.cssText = 'position:fixed;inset:0;margin:0;display:grid;place-items:center;background:#16120d;color:#e9e0cf;font-size:18px;z-index:99'; document.body.append(m);
  setTimeout(() => { if (n >= 3 && !q.has('gfx')) { q.set('gfx', 'webgl'); location.search = q; } else location.reload(); }, 900);
}

async function boot() {
  const t0 = performance.now();
  preloadSfx();   // 只抓 bytes，不等、不算進度；解碼在 initAudio
  const ctx = await createEngine(canvas, { forceWebGL: q.get('gfx') === 'webgl' });
  canvas = ctx.canvas;   // WebGPU 初始化失敗時畫布會換一張
  ctx.gpuLost.then(onGpuLost);
  const info = await buildMap(ctx, LAYOUT, +(q.get('seed') || 278));
  buildCollision(ctx, LAYOUT); initCollision(LAYOUT); buildNav(LAYOUT); initBots();
  world.ctx = ctx; world.onKill = onKill;
  await Promise.all([buildViewmodel(ctx, ctx.snapshot), buildSoldiers(ctx), buildWorldGuns(ctx)]);
  await finishNewGuns();
  buildFx(ctx);
  await ctx.scene.whenReadyAsync();

  const ui = document.getElementById('ui');
  const actions = {
    start({ side }) { if (NET.status !== 'off') netLeave(); initAudio(); hideMenu(); lastSide = side; begin(side); lockPointer(canvas); },   // 在房間裡開單機：先離開房間
    again() { if (SYNC.role) { backToRoom(''); return; } hideResult(); initAudio(); begin(lastSide); lockPointer(canvas); },
    resume() { initAudio(); hidePause(); G.paused = false; lockPointer(canvas); },
    toMenu,
    buy: id => SYNC.role === 'client' ? netBuy(id) : buy(id),
    netWarm() { initAudio(); },
    stage(side, cur) { setStage(side ?? stage.side, cur); }, aside: asideStage, point: pointStage,
    fps: () => ctx.engine.getFps(), viewFov: () => ctx.camera.fov, backend: ctx.isWebGPU ? 'WebGPU' : 'WebGL',
    // 渲染解析度：相對裝置像素（上限 2 倍）。改縮放會走 engine.resize，和改視窗大小同一條路
    res(k) { const l = 1 / (Math.min(devicePixelRatio || 1, 2) * k); if (Math.abs(ctx.engine.getHardwareScalingLevel() - l) > 1e-6) ctx.engine.setHardwareScalingLevel(l); },
  };
  let lastSide = 'atk', overShown = false;
  const endStage = () => { if (stage.on) { stopStage(); ctx.fitFov(); } };
  const begin = side => { endStage(); overShown = false; setupMatch(side === 'rand' ? (Math.random() < 0.5 ? 'atk' : 'def') : side); free = null; };
  function toMenu() {
    if (SYNC.role || NET.status !== 'off') { endMatch(); netLeave(); }   // 連線對戰：離開房間（席位立刻交給電腦）
    hidePause(); hideResult(); leaveMatch();
    vmSelect('knife'); if (vm.cur) { vm.cur.holder.scaling.set(1e-5, 1e-5, -1e-5); flushAll(); vm.cur = null; }   // 第一人稱槍收起來，開機時也是這個狀態；z 負號見 CLAUDE.md
    document.exitPointerLock?.(); input.fire = input.alt = false; input.fwd = input.side = 0;
    showMenu(); startStage(); free = stage.cam;
  }
  { const b = LAYOUT.sites.B, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; LAYOUT.spots.siteBOverview = { x: cx + 15, y: b.y + 17, z: cz - 15, yaw: -45, pitch: -38 }; }
  let free = LAYOUT.spots[q.get('spot') || 'key'] ?? LAYOUT.spots.key;
  initHud(ui, G, LAYOUT, actions); initMenu(ui, actions); initBuy(ui, G, actions); initScore(ui, G); initTouch(ui, input, canvas);
  if (!q.has('clean')) { showMenu(); startStage(); free = stage.cam; addEventListener('resize', () => { if (stage.on) fitStage(); }); }
  bindInput(canvas, locked => { if (!locked && G.me && G.phase !== 'over' && !G.buyOpen) { G.paused = true; showPause(!!SYNC.role); } });
  // 連線對戰：伺服器說開賽（或中途接手電腦席位）就進場；游標鎖定要使用者點一下，先停在暫停畫面
  SYNC.onBegin = () => { endStage(); hideMenu(); hideResult(); overShown = false; free = null; initAudio(); G.paused = true; showPause(true); };
  /** 比賽結束或被迫中止，回到房間（連線分頁）。why 空字串是正常打完。 */
  function backToRoom(why) {
    endMatch(); hidePause(); hideResult(); leaveMatch();
    vmSelect('knife'); if (vm.cur) { vm.cur.holder.scaling.set(1e-5, 1e-5, -1e-5); flushAll(); vm.cur = null; }
    document.exitPointerLock?.(); input.fire = input.alt = false; input.fwd = input.side = 0;
    showMenu(); openTab('net'); netNotice(why); startStage(); free = stage.cam;
  }
  SYNC.onEnd = why => backToRoom(why);
  // 邀請網址 ?room=123456：打開連線分頁，記得名字就直接進房
  { const room = q.get('room'); if (room && /^\d{6}$/.test(room) && !q.has('clean')) { openTab('net'); if (savedName()) netJoin(room, savedName()); } }
  canvas.addEventListener('click', () => { if (G.me && !input.locked) { initAudio(); hidePause(); G.paused = false; lockPointer(canvas); } });

  const DT = 1 / 64; let speed = 1, acc = 0, frames = 0;
  const scene = ctx.scene, cam = ctx.camera;
  const alloc = window.__alloc;
  scene.onBeforeRenderObservable.add(() => advance(Math.min(0.1, ctx.engine.getDeltaTime() / 1000)));
  // 連線的主機切到背景分頁：requestAnimationFrame 停了，改由 Worker 計時器推進（不渲染），別人的比賽才不會跟著停
  let bgWorker = null, bgLast = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && SYNC.role === 'host' && !bgWorker) {
      bgWorker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' })));
      bgLast = performance.now();
      bgWorker.onmessage = () => { if (!document.hidden) return; const now = performance.now(), dt = Math.min(0.1, (now - bgLast) / 1000); bgLast = now; advance(dt); };
    } else if (!document.hidden && bgWorker) { bgWorker.terminate(); bgWorker = null; }
  });
  function advance(dt) {
    if (alloc) alloc.on = true;
    // 滑鼠位移在 tick 之前消耗：這一幀裡開的槍用的是最新的視角，不是上一幀的
    if (G.me && !free) look(G.me.alive && !G.paused);
    if (!G.paused || SYNC.role) { acc += dt * speed; while (acc >= DT) { tick(DT, cam); acc -= DT; } }
    if (input.buy) { input.buy = false; if (G.canBuy) toggleBuy(); }
    G.scoreOpen = input.score;
    if (G.me && !free) { frame(acc / DT, dt, cam); updateSoldiers(dt * speed, cam); setListener(you.x, you.y + 1.6, you.z, you.yaw); }
    else { input.dx = input.dy = 0; const sdt = stage.on ? frameStage(dt) : dt; placeCam(cam, free); cam.computeWorldMatrix(true); if (G.me || stage.on) updateSoldiers(sdt, cam); }
    updateFx(dt, cam);
    frameHud(dt); frameBuy(); frameScore();
    if (G.phase === 'over' && !overShown) {
      overShown = true; document.exitPointerLock?.();
      const m = G.me, win = G.winner === m.team, my = G.score[m.team], opp = G.score[1 - m.team];
      addMatch(win, my, opp, m.kills, m.deaths); showResult(win, my, opp, m.kills, m.deaths, !!SYNC.role);
    }
    if (alloc) alloc.on = false;
  }
  ctx.engine.runRenderLoop(() => scene.render());
  setTimeout(() => sessionStorage.removeItem(LOST_KEY), 60000);   // 撐過一分鐘就算恢復正常
  if (!q.has('nosnap')) scene.onAfterRenderObservable.add(() => { if (++frames === (+q.get('snapAt') || 4) && ctx.isWebGPU) { ctx.snapshot.enable(); snapshotActive.on = true; flushAll(); } });

  const api = window.__ol = {
    ready: true, ctx, info, G, OPT, you, input, LAYOUT, chargePos, weapons: WEAPONS, boot: performance.now() - t0, sfx: sfxStatus, NET, SYNC,
    net: { join: netJoin, leave: netLeave }, buyNet: id => actions.buy(id),
    state: () => ({ phase: G.phase, time: G.time, round: G.round, score: [...G.score], hp: G.me?.hp, money: G.me?.money, alive: G.agents.map(a => a.alive), pos: [you.x, you.y, you.z], charge: G.charge }),
    teleport(x, y, z, yaw = 0, pitch = 0) { free = null; const D = Math.PI / 180; teleport(x, y, z, yaw * D, pitch * D); },
    tuneStage, pool, ik, stageGun(id, side = 'atk') { setStage(side, id); }, benchSoldiers(n = 2000) { const t = performance.now(); for (let i = 0; i < n; i++) updateSoldiers(0.016, cam); return (performance.now() - t) / n; }, spot(n) { endStage(); free = LAYOUT.spots[n] ?? null; }, fps() { endStage(); free = null; },
    setClean(b) { ui.style.display = b ? 'none' : ''; },
    startMatch(o = {}) { hideMenu(); begin(o.side ?? 'atk'); if (o.skipBuy) { G.time = 0; } },
    fire(n = 1) { input.fire = true; setTimeout(() => { input.fire = false; }, n * 90); },
    /** 繞過輸入直接扣一次扳機，走真正的 fire()：tools/balance.mjs 量擊殺時間用。 */
    shoot(yaw, pitch) { return fire(G.me, yaw, pitch, cam); }, los: clear, spreadOf, fx,
    giveWeapon(id) { const m = G.me; giveWeapon(m, id); m.cur = id; api.select(id); },
    forceClip(name, t = -1) { clipDebug.name = name; clipDebug.t = t; },
    select(id) { import_select(id); },
    killBots() { for (const a of G.agents) if (a.bot && a.team !== G.me.team) { a.hp = 0; onKill(G.me, a, 'ar5', false); } },
    setRound(p) { G.phase = p; }, skip(s) { G.time -= s; },
    /** 倍速跑遊戲（仍經過渲染，骨架與命中判定才是真的）。 */
    speed(k) { speed = k; },
    /** 同步推進遊戲時間，不經過渲染。驗收跑完整比賽用。 */
    sim(sec) { const n = Math.round(sec / DT); for (let i = 0; i < n && G.phase !== 'over'; i++) tick(DT, cam); },
    /** 用真實移動與碰撞沿導航圖走到炸點，回傳秒數。 */
    walk(sp, tag) {
      const fromV = new Vector3(), toV = new Vector3();
      const a = { x: sp.x, y: sp.y, z: sp.z, vx: 0, vy: 0, vz: 0, h: 1.8, ground: true, crouch: false }; let cur = nearest(a.x, a.y, a.z), goal = -1, best = 1e9;
      for (const g of tagged(tag)) { const d = nav.dist[cur * nav.n + g]; if (d < best) { best = d; goal = g; } }
      let t = 0, stuck = 0; const S = LAYOUT.sites[tag.slice(-1)];
      while (t < 60) {
        if (a.x >= S.x0 && a.x <= S.x1 && a.z >= S.z0 && a.z <= S.z1 && Math.abs(a.y - S.y) < 1.5) return { t, ok: true };   // 與 check-layout 同定義：踏進炸點範圍
        if (cur === goal) return { t, ok: false, at: [a.x, a.y, a.z], why: 'goal' };
        const nx = nav.next[cur * nav.n + goal], dx = nav.x[nx] - a.x, dz = nav.z[nx] - a.z, d = Math.hypot(dx, dz);
        if (d < 0.7) { cur = nx; continue; }
        // 玩家會抄直線：下下個節點看得到、高差不大就直接朝它走
        if (nx !== goal) { const nn = nav.next[nx * nav.n + goal]; fromV.set(a.x, a.y + 0.9, a.z); toV.set(nav.x[nn], nav.y[nn] + 0.9, nav.z[nn]); if (Math.abs(nav.y[nn] - a.y) < 0.6 && !ctx.ray(fromV, toV).hasHit) { cur = nx; continue; } }
        const ox = a.x, oz = a.z; step(a, dx / d, dz / d, 5.4, false, DT); t += DT;
        stuck = Math.hypot(a.x - ox, a.z - oz) < 0.002 ? stuck + 1 : 0; if (stuck > 64) return { t, ok: false, at: [a.x, a.y, a.z], next: LAYOUT.nav.nodes[nx].id };
      }
      return { t, ok: false, at: [a.x, a.y, a.z] };
    },
    /** 量每幀 CPU：scene.render 內的主執行緒時間。 */
    cpu(n = 120) {
      return new Promise(ok => {
        const t = [], render = scene.render, end = ctx.engine.endFrame; let t0 = 0;
        scene.render = function (...a) { t0 = performance.now(); return render.apply(this, a); };
        ctx.engine.endFrame = function (...a) {
          const r = end.apply(this, a); t.push(performance.now() - t0);
          if (t.length >= n) { delete scene.render; delete ctx.engine.endFrame; t.sort((x, y) => x - y); const lo = t.length * 0.1 | 0, hi = t.length * 0.9 | 0; let sum = 0; for (let i = lo; i < hi; i++) sum += t[i]; ok({ frames: t.length, median: t[t.length >> 1], trim: sum / (hi - lo), p95: t[t.length * 0.95 | 0] }); }
          return r;
        };
      });
    },
    /**
     * 同一頁交錯量快照開與關（ABBA）。macOS 會把主執行緒放在效能核或節能核，換一頁速度就差一倍，
     * 所以比的是相鄰區塊，不是兩頁各自的中位。切換後略過 skip 幀，等快照重錄、JIT 回穩。
     */
    cpuAB({ blocks = 24, n = 60, skip = 40 } = {}) {
      return new Promise(ok => {
        const set = on => { if (on) { ctx.snapshot.enable(); snapshotActive.on = true; flushAll(); } else { snapshotActive.on = false; ctx.snapshot.disable(); } };
        const render = scene.render, end = ctx.engine.endFrame, med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
        const order = i => (i % 4 === 0 || i % 4 === 3), meds = [], t = []; let t0 = 0, b = 0, wait = skip;
        set(order(0));
        scene.render = function (...a) { t0 = performance.now(); return render.apply(this, a); };
        ctx.engine.endFrame = function (...a) {
          const r = end.apply(this, a), dt = performance.now() - t0;
          if (ctx.engine.snapshotRendering !== order(b) || !ctx.snapshot.helper.isReady) return r;   // 還沒切完
          if (wait > 0) { wait--; return r; }
          t.push(dt);
          if (t.length >= n) {
            meds.push(med(t)); t.length = 0; wait = skip;
            if (++b >= blocks) { delete scene.render; delete ctx.engine.endFrame; set(true); const on = meds.filter((_, i) => order(i)), off = meds.filter((_, i) => !order(i)), rs = on.map((x, i) => 1 - x / off[i]); ok({ on: med(on), off: med(off), reduction: med(rs), rs, meds, stable: ctx.engine.snapshotRendering }); return r; }
            set(order(b));
          }
          return r;
        };
      });
    },
    /** 俯視正交雷達相機：只用於 ?nosnap 下截圖。 */
    orthoTop() {
      const b = LAYOUT.bounds, D = (b.x1 - b.x0) / 2; free = { x: (b.x0 + b.x1) / 2, y: 120, z: (b.z0 + b.z1) / 2, yaw: 0, pitch: -90 };
      cam.mode = 1; cam.orthoLeft = -D; cam.orthoRight = D; cam.orthoTop = D; cam.orthoBottom = -D; cam.maxZ = 400;
      scene.fogMode = 0;
    },
    stats: () => ({ fps: ctx.engine.getFps(), snapshot: ctx.engine.snapshotRendering, meshes: scene.meshes.length, webgpu: ctx.isWebGPU, draws: ctx.engine._drawCalls?.current ?? 0, frame: ctx.engine.frameId }),
  };
  window.__GAME_MCP__ = {
    poses: POSES, vm, switchToKeyArtCam() { api.setClean(true); api.spot('key'); }, switchToSiteBOverview() { api.setClean(true); api.spot('siteBOverview'); }, switchToFpsCam() { api.fps(); },
    teleportFpsCam(x, y, z, yaw, pitch) { api.teleport(x, y, z, yaw, pitch); },
    setHudState(on) { api.setClean(!on); }, getPerformanceStats: api.stats,
  };
  console.log('boot', Math.round(performance.now() - t0), JSON.stringify(info, (k, v) => k === 'kit' ? undefined : v));
}
boot().catch(e => { console.error(e?.stack || e); document.title = 'ERR ' + e; });
