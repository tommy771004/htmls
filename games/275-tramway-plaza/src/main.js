// 作品 275：白城環線 · BELVEDERE LOOP — 主程式入口（Three.js r187 全程序建模與即時渲染）
import * as THREE from 'three';
import { CAMERA_PRESETS } from './config.js';
import { ContactDecals } from './kit.js';
import { createCityMaterials } from './materials.js';
import { createCityStage } from './renderer.js';
import { buildPlinthAndRoads } from './zones/plinthRoads.js';
import { buildPlazaAndClockTower } from './zones/plazaClock.js';
import { buildEuropeanBuildings } from './zones/buildings.js';
import { buildViaductAndTrain } from './zones/viaductTrain.js';
import { buildWestPark } from './zones/westPark.js';
import { buildFoliageSystem } from './zones/foliage.js';

const params = new URLSearchParams(window.location.search);
const forceWebGL = params.get('gfx') === 'webgl';
const isCoarseTouch = window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 768;
const lowQuality = params.get('q') === 'low' || (params.get('q') !== 'high' && isCoarseTouch);

if (params.get('clean') === '1') {
  document.body.classList.add('clean-mode');
}

async function boot() {
  const viewport = document.getElementById('viewport');
  const canvas = document.createElement('canvas');
  viewport.appendChild(canvas);

  const stage = await createCityStage(canvas, { forceWebGL, lowQuality });
  const materials = createCityMaterials();
  const decals = new ContactDecals();
  const treeSlots = [];
  const shrubSlots = [];
  const rooftopPlantSlots = [];

  // 依序組裝五大程序化城市區塊（零外部 3D 模型）
  const cityRoot = new THREE.Group();
  cityRoot.name = 'miniature_city_root';

  const roadsGroup = buildPlinthAndRoads(materials, decals, treeSlots);
  const plazaZone = buildPlazaAndClockTower(materials, decals);
  const buildingsGroup = buildEuropeanBuildings(materials, decals, rooftopPlantSlots);
  const viaductZone = buildViaductAndTrain(materials, decals, treeSlots);
  const parkGroup = buildWestPark(materials, decals, treeSlots, shrubSlots);
  const foliageGroup = buildFoliageSystem(materials, treeSlots, shrubSlots, rooftopPlantSlots);
  const contactMesh = decals.build(materials.contactDecal);

  cityRoot.add(
    roadsGroup,
    plazaZone.group,
    buildingsGroup,
    viaductZone.group,
    parkGroup,
    foliageGroup,
    contactMesh,
  );
  stage.scene.add(cityRoot);

  stage.resize(window.innerWidth, window.innerHeight);

  // 利用 r187 優化的非同步管線預編譯排程器預熱著色器，消除首幀卡頓
  try {
    await stage.renderer.compileAsync(stage.scene, stage.camera);
  } catch {
    // 部分後端退回環境可能略過預編譯，直接由首幀編譯
  }

  // ── UI 綁定與狀態同步 ──
  const elRev = document.getElementById('revBadge');
  const elBackend = document.getElementById('stBackend');
  const elCalls = document.getElementById('stCalls');
  const elTris = document.getElementById('stTris');
  const elFps = document.getElementById('stFps');
  const btnGtao = document.getElementById('btnGtao');
  const btnLight = document.getElementById('btnLight');
  const btnTrain = document.getElementById('btnTrain');
  const btnClean = document.getElementById('cleanToggle');
  const presetBtns = [...document.querySelectorAll('.preset-btn')];

  elRev.textContent = `Three.js r${THREE.REVISION}`;
  elBackend.textContent = stage.backendName.replace(' (r187)', '');
  btnGtao.setAttribute('aria-pressed', String(stage.isGTAO()));

  function syncPresetUI(activeKey) {
    for (const b of presetBtns) {
      b.setAttribute('aria-pressed', String(b.dataset.preset === activeKey));
    }
  }

  for (const b of presetBtns) {
    b.addEventListener('click', () => {
      const key = b.dataset.preset;
      stage.goToPreset(key, false);
      syncPresetUI(key);
    });
  }

  btnGtao.addEventListener('click', () => {
    const next = !stage.isGTAO();
    stage.setGTAO(next);
    btnGtao.setAttribute('aria-pressed', String(next));
  });

  const lightCycle = [
    { key: 'softStudio', label: '光線：柔光棚' },
    { key: 'goldenAfternoon', label: '光線：暖午後' },
    { key: 'overcastMaquette', label: '光線：漫射天光' },
  ];
  let lightIdx = 0;
  btnLight.addEventListener('click', () => {
    lightIdx = (lightIdx + 1) % lightCycle.length;
    const item = lightCycle[lightIdx];
    stage.setLightingMode(item.key);
    btnLight.textContent = item.label;
    btnLight.setAttribute('aria-pressed', String(lightIdx !== 0));
  });

  const speedCycle = [
    { mult: 1.0, label: '列車：行駛', pressed: true },
    { mult: 1.8, label: '列車：快轉', pressed: true },
    { mult: 0.0, label: '列車：暫停', pressed: false },
  ];
  let speedIdx = 0;
  let trainSpeedMult = 1.0;
  btnTrain.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % speedCycle.length;
    const item = speedCycle[speedIdx];
    trainSpeedMult = item.mult;
    btnTrain.textContent = item.label;
    btnTrain.setAttribute('aria-pressed', String(item.pressed));
  });

  function toggleClean(force) {
    const next = typeof force === 'boolean' ? force : !document.body.classList.contains('clean-mode');
    document.body.classList.toggle('clean-mode', next);
    btnClean.textContent = next ? '顯示介面 · H' : '純淨畫面 · H';
  }
  btnClean.addEventListener('click', () => toggleClean());

  const presetOrder = Object.keys(CAMERA_PRESETS);
  window.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'h' || e.key === 'H') {
      toggleClean();
    } else if (e.key >= '1' && e.key <= '7') {
      const key = presetOrder[Number(e.key) - 1];
      if (key) {
        stage.goToPreset(key, false);
        syncPresetUI(key);
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      btnTrain.click();
    }
  });

  window.addEventListener('resize', () => {
    stage.resize(window.innerWidth, window.innerHeight);
  });

  // ── 動畫主迴圈與效能統計 ──
  let simTime = 0;
  let lastNow = performance.now();
  let fpsFrames = 0;
  let fpsAccum = 0;
  let currentFps = 60;
  let pausedLoop = false;

  function countSceneStats() {
    let meshes = 0;
    let triangles = 0;
    cityRoot.traverse((obj) => {
      if (obj.isMesh && obj.visible) {
        meshes += 1;
        const g = obj.geometry;
        const tri = g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
        const inst = obj.isInstancedMesh ? obj.count : 1;
        triangles += Math.round(tri * inst);
      }
    });
    return { meshes, triangles };
  }
  const sceneGeometryStats = countSceneStats();

  function stepSimulation(dt) {
    simTime += dt;
    plazaZone.update(simTime);
    const trainPos = viaductZone.updateTrain(dt, trainSpeedMult);
    stage.updateCamera(dt, trainPos);
  }

  function animate(now) {
    requestAnimationFrame(animate);
    if (pausedLoop) {
      lastNow = now;
      return;
    }
    const rawDt = Math.min(0.05, Math.max(0.0001, (now - lastNow) / 1000));
    lastNow = now;

    stepSimulation(rawDt);
    stage.renderFrame();

    fpsFrames += 1;
    fpsAccum += rawDt;
    if (fpsAccum >= 0.45) {
      currentFps = Math.round(fpsFrames / fpsAccum);
      fpsFrames = 0;
      fpsAccum = 0;
      const rInfo = stage.renderer.info?.render;
      const calls = rInfo?.calls || sceneGeometryStats.meshes;
      elCalls.textContent = String(calls);
      elTris.textContent = `${(sceneGeometryStats.triangles / 1000).toFixed(1)}k`;
      elFps.textContent = String(currentFps);
    }
  }

  // 先渲染首幀並更新統計，讓無頭截圖與測試立即可讀
  stepSimulation(0);
  stage.renderFrame();
  elCalls.textContent = String(stage.renderer.info?.render?.calls || sceneGeometryStats.meshes);
  elTris.textContent = `${(sceneGeometryStats.triangles / 1000).toFixed(1)}k`;
  elFps.textContent = '60';

  requestAnimationFrame(animate);

  // ── 驗收與分區檢視測試 API ──
  window.__city = {
    ready: true,
    revision: THREE.REVISION,
    backend: stage.backendName,
    preset(key, instant = true) {
      stage.goToPreset(key, instant);
      syncPresetUI(key);
      stage.updateCamera(0, viaductZone.getFocusPosition());
      stage.renderFrame();
    },
    setCamera({ pos, target, fov }) {
      if (pos) stage.camera.position.set(...pos);
      if (target) stage.controls.target.set(...target);
      if (fov) {
        stage.camera.fov = fov;
        stage.camera.updateProjectionMatrix();
      }
      stage.controls.update();
      stage.renderFrame();
    },
    setGTAO(on) {
      stage.setGTAO(on);
      btnGtao.setAttribute('aria-pressed', String(stage.isGTAO()));
      stage.renderFrame();
    },
    setLighting(modeKey) {
      stage.setLightingMode(modeKey);
      stage.renderFrame();
    },
    setClean(on, hideButton = false) {
      toggleClean(Boolean(on));
      document.body.classList.toggle('screenshot-mode', Boolean(on && hideButton));
      stage.renderFrame();
    },
    setTrainU(u) {
      viaductZone.setTrainU(u);
      stage.renderFrame();
    },
    advance(sec = 1.0) {
      pausedLoop = true;
      const steps = Math.max(1, Math.ceil(sec / (1 / 60)));
      const dt = sec / steps;
      for (let i = 0; i < steps; i++) stepSimulation(dt);
      stage.renderFrame();
    },
    resume() {
      pausedLoop = false;
    },
    info() {
      return {
        revision: THREE.REVISION,
        backend: stage.backendName,
        gtao: stage.isGTAO(),
        calls: stage.renderer.info?.render?.calls || sceneGeometryStats.meshes,
        meshes: sceneGeometryStats.meshes,
        triangles: sceneGeometryStats.triangles,
        fps: currentFps,
        trainU: Number(viaductZone.getTrainU().toFixed(4)),
        preset: stage.getActivePreset(),
      };
    },
  };
}

boot().catch((err) => {
  console.error(err);
  const box = document.getElementById('bootError');
  if (box) {
    box.style.display = 'block';
    box.textContent = `場景啟動失敗：${err?.message || err}`;
  }
});
