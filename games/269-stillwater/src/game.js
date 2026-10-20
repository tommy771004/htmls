// 遊戲主迴圈：划船、鏡頭、時鐘、燈樁、釣點偵測、釣魚流程、存檔、面板動作與 window.__st 測試 API。
import * as THREE from 'three';
import { report } from './view/assets.js';
import { buildGrid } from './core/grid.js';
import { current, zoneAt, CHECKPOINTS, SPOTS, SPOT_R, SPOT_SLOW, spotPos, FALLS, BERTH, DOCK, nearest, SAMPLES } from './core/map.js';
import { createBoat, stepBoat } from './core/boat.js';
import { TIMES, byId, FISH } from './core/fishdb.js';
import { MIN_PER_SEC, PERIODS, periodOf, clockText, claimChapter, chapterReady, ensureBoard, deliverQuest, matches, CHAPTERS, valueOf, speciesCount } from './core/quests.js';
import { load, store, fresh, recordCatch, makeCatch, CREEL_MAX, SAVE_KEY } from './core/save.js';
import { mulberry } from './core/rng.js';
import { U } from './view/shared.js';
import { buildTerrain, heightTexture } from './view/terrain.js';
import { buildWater, buildFalls } from './view/water.js';
import { createSky } from './view/sky.js';
import { buildScatter, CUT } from './view/scatter.js';
import { buildBoat } from './view/boatview.js';
import { createFishPools } from './view/fishview.js';
import { createShoals } from './view/shoals.js';
import { createFx } from './view/fx.js';
import { createFishing } from './view/fishing.js';
import { portrait } from './view/portrait.js';
import { audio } from './audio.js';
import { createInput } from './input.js';
import { createUI } from './ui/ui.js';

const $ = (id) => document.getElementById(id);
const ls = (() => { try { const s = window.localStorage; s.getItem('x'); return s; } catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; } })();
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const NORTH = Math.PI;                 // 船頭朝 −Z（上游）
const SPOT_REST = 120;                 // 一個釣點連釣 3 條後休息的遊戲分鐘數

export function startGame(renderer) {
  const rng = mulberry((Date.now() & 0xffff) ^ 0x269);
  const save = load(ls, rng);
  const G = { save, muted: false, act: {}, portrait };
  try { G.muted = ls.getItem('st269.mute') === '1'; } catch { /* 無痕模式 */ }

  // ---------- 場景 ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 900);
  const grid = buildGrid(2);
  scene.add(buildTerrain(grid));
  const water = buildWater(grid, heightTexture(grid));
  scene.add(water.mesh);
  scene.add(buildFalls());
  const sky = createSky(scene, renderer);
  const world = buildScatter(scene, grid);
  const boatView = buildBoat(scene);
  const pools = createFishPools(scene);
  const shoals = createShoals(pools, grid, water);
  const fx = createFx(scene);
  const winMats = [];
  for (const obj of [world.cabin, world.dock]) obj.traverse((o) => { if (o.isMesh && (o.userData.special === 'win_glow' || o.userData.special === 'lamp_glow')) { o.material.emissive = new THREE.Color('#ffb866'); o.material.emissiveIntensity = 0; winMats.push(o.material); } });
  for (const b of world.buoys) {
    b.lampMats = [];
    b.obj.traverse((o) => { if (o.isMesh && o.userData.special === 'lamp_glow') { o.material.emissive = new THREE.Color('#ffc46b'); o.material.emissiveIntensity = 0; b.lampMats.push(o.material); } });
    b.lit = save.cps[b.cp.k] ? 1 : 0;
    b.flagY = b.flag ? b.flag.position.y : 1.2;
  }
  const wakeL = boatView.hull.getObjectByName('wake_L'), wakeR = boatView.hull.getObjectByName('wake_R');

  // ---------- 介面與輸入 ----------
  const ui = createUI(G);
  const input = createInput({ joy: $('joy'), knob: $('knob'), act: $('act') });
  const touchUI = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
  document.body.classList.toggle('touch', touchUI);
  audio.setMuted(G.muted); ui.setMute(G.muted);

  // ---------- 狀態 ----------
  const start = CHECKPOINTS[save.at] || CHECKPOINTS[0];
  const boat = createBoat(start.berth.x, start.berth.z, NORTH);
  const spotStat = SPOTS.map(() => ({ n: 0, until: -1 }));
  const st = { mode: 'intro', t: 0, zone: 0, spot: null, nearCp: null, nearDock: false, fishingYaw: null, timeScale: 1, camDist: 24, camTarget: new THREE.Vector3(boat.x, 0, boat.z), toast: 0, hazeT: 0, mistT: 0, wakeT: 0, lastSave: 0 };
  const absMin = () => save.day * 1440 + save.clock;
  const timeKey = () => TIMES[periodOf(save.clock)];
  const timeIdx = () => periodOf(save.clock);
  const resting = (k) => spotStat[k].until > absMin();
  const persist = () => store(ls, save);
  boatView.setPaint(save.paint); boatView.setRibbon(save.ribbon); boatView.setLantern(!!save.upgrades.lantern);

  const fishing = createFishing({
    scene, boatView, water, fx, audio, shoals, grid, camera, ui,
    onCatch(c, j) {
      const info = recordCatch(save, c);
      save.creel.push(c);
      if (save.creel.length > CREEL_MAX) save.creel.length = CREEL_MAX;
      const sp = fishing.S.spot;
      if (sp) {
        const ss = spotStat[sp.k];
        ss.n++;
        if (ss.n >= 3) { ss.n = 0; ss.until = absMin() + SPOT_REST; }
        if (sp.kind === 'legend') save.pity[sp.k] = byId(c.id).rarity === 'L' ? 0 : Math.min(40, (save.pity[sp.k] || 0) + 0.6);
      }
      ui.showTag(c, info, j);
      if (info.milestone) setTimeout(() => { ui.banner('Field guide milestone', `圖鑑 ${info.milestone.n} 種：解鎖${info.milestone.zh}`, 3.6); audio.reward(); }, 900);
      if (chapterReady(save) && !st.readyShown) { st.readyShown = true; setTimeout(() => ui.pop('主線目標達成：回木屋碼頭回報', 'gold'), 1400); }
      if (save.creel.length >= CREEL_MAX) setTimeout(() => ui.pop('魚簍滿了：回碼頭卸貨，或在燈樁放生', 'warn'), 2000);
      persist();
    },
    onDone(why) {
      if (why === 'snap') save.stats.snap++;
      if (why === 'escape') save.stats.escape++;
      st.fishingYaw = null;
      persist();
    },
  });

  // ---------- 動作（面板按鈕） ----------
  const fade = (fn) => { const f = $('fade'); f.classList.add('on'); setTimeout(() => { fn(); f.classList.remove('on'); }, 380); };
  const place = (x, z, yaw = NORTH) => {
    fishing.reset(); boatView.stopFishing(); boatView.faceRow();
    Object.assign(boat, createBoat(x, z, yaw));
    st.camTarget.set(x, 0, z); st.fishingYaw = null;
  };
  const restTo = (p) => {
    const cur = periodOf(save.clock);
    if (p <= cur) save.day++;
    save.clock = PERIODS[p].from;
    sky.update(save.clock, st.camTarget);
  };
  G.onSheetClose = () => { input.clear(); };
  const reservedForChapter = () => {
    const ch = CHAPTERS[save.chapter]; const keep = new Set();
    if (!ch) return keep;
    for (const g of ch.goals) if (g.kind === 'deliver') save.creel.map((c, i) => [c, i]).filter(([c]) => matches(g, c)).slice(0, g.n).forEach(([, i]) => keep.add(i));
    return keep;
  };
  Object.assign(G.act, {
    book() {
      if (ui.sheetOpen) { ui.close(); return; }
      if (!save.upgrades.book) { ui.pop('完成第一章後解鎖魚種圖鑑', 'warn'); return; }
      audio.ui(); ui.openBook(save, zoneAt(boat.x, boat.z));
    },
    pause() { if (ui.sheetOpen) { ui.close(); return; } audio.ui(); ui.openPause(save, G.muted); },
    mute() { G.muted = !G.muted; audio.setMuted(G.muted); ui.setMute(G.muted); try { ls.setItem('st269.mute', G.muted ? '1' : '0'); } catch { /* 略 */ } },
    creel() { if (ui.sheetOpen) return; ui.sheet('魚簍', 'Creel', null, null, ui.creelHTML(save) + '<p class="note">回木屋碼頭可以卸貨換積分；在點亮的燈樁可以放生。</p>', () => {}); },
    interact() {
      if (fishing.busy || ui.sheetOpen) return;
      if (st.nearDock) { audio.ui(); save.at = 0; persist(); ui.openDock(save, 'main'); return; }
      if (st.nearCp) { audio.ui(); save.at = st.nearCp.k; persist(); ui.openCheckpoint(save, st.nearCp); }
    },
    claim() {
      const r = claimChapter(save);
      if (!r) return;
      st.readyShown = false;
      if (r === 'book') ensureBoard(save, rng);
      if (r === 'lantern') boatView.setLantern(true);
      audio.reward();
      const ch = CHAPTERS[save.chapter - 1];
      ui.banner('Chapter complete', `${ch.zh}・${ch.rewardZh}`, 4);
      persist(); ui.openDock(save, 'main');
    },
    deliver(i) { const q = deliverQuest(save, i, rng); if (q) { audio.reward(); ui.pop(`委託完成 +${q.reward}`, 'gold'); persist(); } ui.openDock(save, 'board'); },
    sell() {
      const keep = reservedForChapter();
      let sum = 0;
      save.creel = save.creel.filter((c, i) => { if (keep.has(i)) return true; sum += valueOf(c); return false; });
      save.points += sum;
      audio.creel(); ui.pop(`卸貨 +${sum} 積分${keep.size ? `（留下主線要交的 ${keep.size} 條）` : ''}`, 'gold');
      persist(); ui.openDock(save, 'creel');
    },
    paint(i) { save.paint = i; boatView.setPaint(i); persist(); ui.openDock(save, 'look'); },
    ribbon(i) { save.ribbon = i; boatView.setRibbon(i); persist(); ui.openDock(save, 'look'); },
    rest(p) { ui.close(); fade(() => { restTo(p); ui.pop(`休息到${PERIODS[p].zh} ${clockText(PERIODS[p].from)}`, ''); persist(); }); },
    travel(k) {
      const c = CHECKPOINTS[k];
      ui.close();
      fade(() => { place(c.berth.x, c.berth.z, k === 0 ? NORTH : NORTH); save.at = k; save.clock = Math.min(1199, save.clock + 25); persist(); ui.pop(k === 0 ? '順流返航，回到木屋碼頭' : `抵達 ${c.zh}`, ''); });
    },
    release(i) {
      const c = save.creel[i]; if (!c) return;
      save.creel.splice(i, 1); save.stats.released++;
      fx.splash(boat.x + 1.2, boat.z, 8, 0.6); audio.splash(0.6);
      ui.pop(`放生了 ${byId(c.id).zh}`, ''); persist();
      ui.openCheckpoint(save, st.nearCp || CHECKPOINTS[save.at], 'release');
    },
    wipe() { try { ls.removeItem(SAVE_KEY); } catch { /* 略 */ } location.reload(); },
  });

  // ---------- 拋竿 ----------
  function tryCast() {
    if (save.creel.length >= CREEL_MAX) { ui.pop('魚簍滿了：回碼頭卸貨，或在燈樁放生', 'warn'); return; }
    const sp = st.spot;
    if (!sp) { ui.pop('這裡沒有魚群：找水面有魚影和漣漪的釣點', ''); return; }
    if (boat.speed > SPOT_SLOW + 0.4) { ui.pop('船太快了，先放開划槳讓船慢下來', ''); return; }
    if (resting(sp.k)) { ui.pop('這裡的魚被驚擾了，換個釣點或晚點再來', 'warn'); return; }
    const at = spotPos(sp, timeIdx());
    audio.unlock();
    // 船尾轉向釣點（漁夫面向船尾坐）
    st.fishingYaw = Math.atan2(boat.x - at.x, boat.z - at.z);
    boat.vx *= 0.3; boat.vz *= 0.3; boat.w = 0;
    fishing.cast(sp, at, { time: timeKey(), timeIdx: timeIdx(), day: save.day, upgrades: save.upgrades, pity: save.pity[sp.k] || 0 }, rng);
  }

  // ---------- 輸入事件 ----------
  function handle(ev) {
    if (ev.type !== 'act' || ev.down) audio.unlock();
    if (st.mode === 'intro') { if (ev.down && (ev.type === 'enter' || ev.type === 'act')) begin(); return; }
    if (ev.type === 'esc') {
      if (ui.sheetOpen) ui.close();
      else if (ui.tagOpen) ui.hideTag();
      else if (!fishing.cancel()) G.act.pause();
      return;
    }
    if (ui.sheetOpen) {
      if (ev.type === 'book' && ev.down) G.act.book();
      if (ev.type === 'pause' && ev.down) ui.close();
      if (ev.type === 'mute') G.act.mute();
      return;
    }
    if (ev.type === 'act') {
      if (ev.down && ui.tagOpen && !fishing.busy) { ui.hideTag(); return; }
      if (fishing.busy) fishing.press(ev.down);
      else if (ev.down) tryCast();
      return;
    }
    if (!ev.down) return;
    if (ev.type === 'enter' && ui.tagOpen) ui.hideTag();
    else if (ev.type === 'interact' || ev.type === 'enter') G.act.interact();
    else if (ev.type === 'book') G.act.book();
    else if (ev.type === 'pause') G.act.pause();
    else if (ev.type === 'mute') G.act.mute();
    else if (ev.type === 'time') {
      if (fishing.busy) return;
      if (st.nearCp || st.nearDock) G.act.rest((periodOf(save.clock) + 1) % 3);
      else ui.pop('在點亮的燈樁或木屋碼頭才能休息', '');
    } else if (ev.type === 'release' && st.nearCp && save.creel.length) ui.openCheckpoint(save, st.nearCp, 'release');
  }

  function begin() {
    if (st.mode !== 'intro') return;
    audio.unlock();
    st.mode = 'play';
    $('intro').classList.add('hidden');
    ui.show(true);
    st.zone = zoneAt(boat.x, boat.z); ui.zone(st.zone);
    if (!save.stats.caught && save.chapter === 0) setTimeout(() => ui.pop('W 往前划，A／D 轉向；划到北邊的燈樁把它點亮', ''), 1200);
  }
  $('start').onclick = begin;
  $('introKeys').innerHTML = touchUI ? '左下搖桿划船 · 右下圓鈕拋竿／提竿／按住收線' : $('introKeys').innerHTML;

  // ---------- 鏡頭 ----------
  addEventListener('wheel', (e) => { if (ui.sheetOpen || st.mode !== 'play') return; st.camDist = THREE.MathUtils.clamp(st.camDist + e.deltaY * 0.02, 16, 40); }, { passive: true });
  const PITCH = THREE.MathUtils.degToRad(52);
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  function updateCamera(dt) {
    const portrait = innerHeight > innerWidth;
    let dist = st.camDist * (portrait ? 1.3 : 1);
    if (fishing.busy) dist *= 0.8;
    if (st.mode === 'intro') dist *= 0.75;
    st.curDist = st.curDist == null ? dist : st.curDist + (dist - st.curDist) * Math.min(1, dt * 2);
    const lead = fishing.busy ? 0 : 1.1;
    let tx = boat.x + boat.vx * lead, tz = boat.z + boat.vz * lead;
    if (fishing.busy) { tx = (boat.x * 2 + fishing.S.target.x) / 3; tz = (boat.z * 2 + fishing.S.target.z) / 3; }
    if (portrait) tz += 3;
    const k = Math.min(1, dt * 3);
    st.camTarget.x += (tx - st.camTarget.x) * k; st.camTarget.z += (tz - st.camTarget.z) * k;
    const yawOff = st.mode === 'intro' ? Math.sin(st.t * 0.08) * 0.35 - 0.25 : 0;
    camPos.set(st.camTarget.x + Math.sin(yawOff) * Math.cos(PITCH) * st.curDist, Math.sin(PITCH) * st.curDist, st.camTarget.z + Math.cos(yawOff) * Math.cos(PITCH) * st.curDist);
    camera.position.copy(camPos);
    look.set(st.camTarget.x, 0, st.camTarget.z);
    camera.lookAt(look);
    CUT.uCutA.value.copy(camPos);
    CUT.uCutB.value.set(boat.x, 1.0, boat.z);
  }

  // ---------- 每幀 ----------
  const v = new THREE.Vector3();
  function update(dt) {
    st.t += dt;
    U.uTime.value += dt;
    for (const ev of input.drain()) handle(ev);
    const playing = st.mode === 'play' && !ui.sheetOpen;
    if (playing) {
      save.clock += dt * MIN_PER_SEC;
      if (save.clock >= 1200) { save.clock = 360; save.day++; ui.banner('A new day', `第 ${save.day} 天・清晨的河面起了霧`, 3); persist(); }
    }
    const w = sky.update(save.clock, st.camTarget);
    const dusk = sky.state.dusk;

    // 船
    let ax = { fwd: 0, turn: 0 };
    if (playing && !fishing.busy) ax = input.axes();
    if (playing && fishing.busy && ['wait', 'cast'].includes(fishing.S.phase)) {
      const a = input.axes();
      if (a.fwd || a.turn) { fishing.cancel(); ui.pop('收竿', ''); }
    }
    if (fishing.busy && st.fishingYaw != null) {
      // 下錨：船慢慢停下，轉到船尾朝釣點
      boat.vx *= Math.max(0, 1 - dt * 2.5); boat.vz *= Math.max(0, 1 - dt * 2.5);
      boat.x += boat.vx * dt; boat.z += boat.vz * dt;
      boat.yaw += angDiff(st.fishingYaw, boat.yaw) * Math.min(1, dt * 1.8);
      boat.mode = 'idle'; boat.speed = Math.hypot(boat.vx, boat.vz);
      boat.pitch *= 0.95; boat.roll *= 0.95;
      boat.sway = fishing.S.phase === 'reel' ? fishing.S.sway : 0;
      const tgt = fishing.S.phase === 'reel' ? fishing.S.fishPos : fishing.S.target;
      boatView.root.updateMatrixWorld();
      boatView.faceTo(tgt.x, tgt.z);
    } else if (st.mode !== 'intro') {
      boat.sway = 0;
      const evs = stepBoat(boat, ax, { sample: grid.sample, current, obstacles: world.obstacles }, Math.min(dt, 0.033));
      for (const e of evs) {
        if (e === 'stroke') {
          audio.stroke(0.8 + Math.random() * 0.3);
          const fx0 = Math.sin(boat.yaw), fz0 = Math.cos(boat.yaw);
          for (const s of [1, -1]) { const px = boat.x + fz0 * 1.9 * s - fx0 * 0.4, pz = boat.z - fx0 * 1.9 * s - fz0 * 0.4; water.ripple(px, pz, 0.55); fx.splash(px, pz, 3, 0.35); }
        }
        if (e === 'bump') { audio.bump(); ui.pop('擦到岸邊了', ''); }
      }
    }
    boatView.update(dt, boat, fishing.busy, Math.max(dusk, sky.state.mist * 0.25));
    water.setBoat(boat.x, boat.z, boat.yaw, boat.speed);
    const lampOn = save.upgrades.lantern ? dusk : 0;
    water.uniforms.uLamp.value.set(boat.x + Math.sin(boat.yaw) * 1.7, boat.z + Math.cos(boat.yaw) * 1.7, lampOn * 0.55, 0);

    // 船尾白沫
    st.wakeT -= dt;
    if (boat.ground > 0.7 && st.wakeT <= 0 && !fishing.busy) {
      st.wakeT = 0.06;
      for (const m of [wakeL, wakeR]) {
        if (m) m.getWorldPosition(v); else v.set(boat.x - Math.sin(boat.yaw) * 1.6, 0, boat.z - Math.cos(boat.yaw) * 1.6);
        fx.foam(v.x, v.z, -boat.vx, -boat.vz);
      }
    }

    // 區域、燈樁、碼頭、釣點
    const z = zoneAt(boat.x, boat.z);
    if (z !== st.zone && st.mode === 'play') { st.zone = z; ui.zone(z); }
    st.nearCp = null;
    for (const cp of CHECKPOINTS) {
      if (cp.k === 0) continue;
      const d = Math.hypot(boat.x - cp.x, boat.z - cp.z);
      if (!save.cps[cp.k] && d < 6 && playing) {
        save.cps[cp.k] = true; audio.chime();
        ui.banner('Lantern lit', `${cp.zh}的燈樁點亮了・可以在這裡停泊、休息與快速移動`, 3.4);
        if (save.upgrades.book) ensureBoard(save, rng);
        persist();
      }
      if (save.cps[cp.k] && d < 7.5) st.nearCp = cp;
    }
    st.nearDock = Math.hypot(boat.x - BERTH.x, boat.z - BERTH.z) < 9 || Math.hypot(boat.x - DOCK.x, boat.z - (DOCK.z - 7)) < 7;
    st.spot = null;
    let best = Infinity;
    for (const s of SPOTS) {
      const p = spotPos(s, timeIdx()), d = Math.hypot(boat.x - p.x, boat.z - p.z);
      if (d < SPOT_R + 2.5 && d < best) { best = d; st.spot = s; }
      if (d < SPOT_R && boat.speed < SPOT_SLOW && !save.seen[s.k] && playing) {
        save.seen[s.k] = true; persist();
        ui.banner('New fishing spot', `${s.zh}・${s.kind === 'legend' ? '深水釣點，傳說魚王出沒' : '按空白鍵拋竿'}`, 2.6);
      }
    }
    for (const b of world.buoys) {
      const lit = save.cps[b.cp.k] ? 1 : 0;
      b.lit += (lit - b.lit) * Math.min(1, dt * 1.5);
      if (b.flag) b.flag.position.y = b.flagY + b.lit * 1.2;
      const glow = b.lit * (0.35 + dusk * 2.2 + Math.max(0, Math.sin(st.t * 2)) * 0.05);
      for (const m of b.lampMats) m.emissiveIntensity = glow;
      b.light.intensity = b.lit * dusk * 6;
    }
    for (const m of winMats) m.emissiveIntensity = 0.1 + dusk * 1.6;
    for (const l of world.lights) l.light.intensity = dusk * l.max;

    // 魚、粒子、釣魚
    shoals.update(dt, U.uTime.value, timeKey(), timeIdx(), st.camTarget, resting, (k) => Math.hypot(SPOTS[k].x - boat.x, SPOTS[k].z - boat.z) < 30);
    pools.end();
    fishing.update(dt, U.uTime.value, camera.position);
    if (fishing.S.phase === 'reel' && fishing.S.reel) ui.reel(fishing.S.reel, fishing.S.fish);
    if (fishing.S.phase === 'bite') ui.biteAt(fishing.bobberScreen(camera, innerWidth, innerHeight));
    const df = Math.hypot(boat.x - FALLS.x, boat.z - FALLS.z);
    st.mistT -= dt;
    if (df < 140 && st.mistT <= 0) { st.mistT = 0.08; fx.mist(FALLS.x + (Math.random() - 0.5) * FALLS.width, 0.6, FALLS.z + 2 + Math.random() * 3, 1); }
    st.hazeT -= dt;
    if (sky.state.mist > 0.3 && st.hazeT <= 0) { st.hazeT = 0.5 / sky.state.mist; fx.haze(st.camTarget.x + (Math.random() - 0.5) * 50, 0.8, st.camTarget.z + (Math.random() - 0.5) * 40); }
    fx.update(dt);
    updateCamera(dt);

    // 聲音
    const ni = nearest(boat.x, boat.z).i;
    audio.ambient(dt, { rapids: z === 4 ? Math.min(1, SAMPLES.cur[ni] / 1.2) : 0, falls: Math.max(0, 1 - df / 110), w, speed: Math.min(1, boat.speed / 3) });

    // HUD
    if (st.mode === 'play') {
      ui.hud(save, { boat });
      ui.tick(dt);
      hintsFor();
    }
    st.lastSave += dt;
    if (st.lastSave > 20 && playing) { st.lastSave = 0; persist(); }
  }

  function hintsFor() {
    const P = fishing.S.phase;
    const H = [];
    let act = '拋竿', use = '';
    if (P === 'cast') { act = '…'; }
    else if (P === 'wait') { H.push(['空白', '浮標沉下去再提竿'], ['W', '收竿']); act = '提竿'; }
    else if (P === 'bite') { H.push(['空白', '提竿！']); act = '提竿！'; }
    else if (P === 'hook' || P === 'reel') { H.push(['按住空白', '收線'], ['放開', '張力降下來']); act = '收線'; }
    else if (P === 'land' || P === 'retrieve') { act = '…'; }
    else {
      H.push(['W+A+S+D', '划船']);
      if (st.spot) H.push(['空白', resting(st.spot.k) ? `${st.spot.zh}（魚群休息中）` : `在「${st.spot.zh}」拋竿`]);
      if (st.nearDock) { H.push(['E', '木屋碼頭']); use = '碼頭'; }
      else if (st.nearCp) { H.push(['E', '停泊燈樁'], ['T', '休息']); use = '停泊'; }
      if (save.upgrades.book) H.push(['Tab', '圖鑑']);
      if (!st.spot) act = '拋竿';
    }
    ui.hints(H);
    ui.touchLabels(act, use);
  }

  // ---------- 視窗與迴圈 ----------
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    fx.setScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
  }
  addEventListener('resize', resize); resize();
  document.addEventListener('visibilitychange', () => { audio.suspend(document.hidden); if (document.hidden) { input.clear(); persist(); } });
  addEventListener('pagehide', persist);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) * st.timeScale;
    last = now;
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  update(0.016); renderer.render(scene, camera);
  requestAnimationFrame(frame);
  $('intro').classList.remove('hidden');
  const q = new URLSearchParams(location.search);
  if (q.has('play')) begin();

  // ---------- 測試 API ----------
  window.__st = {
    ready: true,
    scene, camera, renderer, boat, fishing, ui, save: () => save,
    report: () => ({ loaded: [...report.loaded], missing: [...report.missing], placeholders: [...report.placeholders] }),
    state: () => ({ mode: st.mode, sheet: ui.sheetOpen, tag: ui.tagOpen, phase: fishing.S.phase, boat: { x: boat.x, z: boat.z, yaw: boat.yaw, speed: boat.speed, mode: boat.mode }, zone: st.zone, spot: st.spot && st.spot.k, nearCp: st.nearCp && st.nearCp.k, nearDock: st.nearDock, clock: save.clock, day: save.day, creel: save.creel.length, caught: save.stats.caught, chapter: save.chapter, species: speciesCount(save), tension: fishing.S.reel ? fishing.S.reel.tension : 0, progress: fishing.S.reel ? fishing.S.reel.progress : 0, fish: fishing.S.fish && fishing.S.fish.id }),
    start: begin,
    place(x, z, yaw = NORTH) { place(x, z, yaw); updateCamera(1); },
    toSpot(k, off = 3) { const s = SPOTS[k], p = spotPos(s, timeIdx()); place(p.x, p.z + off, NORTH); updateCamera(1); return p; },
    toCp(k) { const c = CHECKPOINTS[k]; place(c.berth.x, c.berth.z); updateCamera(1); },
    setTime(min) { save.clock = min; sky.update(min, st.camTarget); },
    timeScale(s) { st.timeScale = s; },
    act(type, down = true) { handle({ type, down }); },
    give(id, tier = 2, n = 1) { for (let i = 0; i < n; i++) { const c = makeCatch(byId(id), { tier, mult: 1 + tier * 0.12, flawless: false }, { time: timeKey(), perfect: false, day: save.day }); recordCatch(save, c); if (save.creel.length < CREEL_MAX) save.creel.push(c); } persist(); },
    unlockAll() { save.cps = save.cps.map(() => true); for (const k of Object.keys(save.upgrades)) save.upgrades[k] = true; save.chapter = 5; ensureBoard(save, rng); boatView.setLantern(true); persist(); },
    fillBook(n = 55, tier = 3) { for (const f of FISH.slice(0, n)) if (!save.book[f.id]) save.book[f.id] = { n: 1, tier: (f.id * 7) % 5 === 0 ? 4 : tier, len: f.len * 1.2, kg: f.kg * 1.3 }; persist(); },
    reset() { Object.assign(save, fresh()); persist(); },
    hud(on) { $('hud').style.visibility = on ? '' : 'hidden'; },
  };
  return window.__st;
}
