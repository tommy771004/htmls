// Main entry point for 260-neon-nightcity (霓虹夜城 // NEON NIGHT CITY)
import * as THREE from 'three';
import { loadAssets } from './assets.js';
import { buildCity } from './city.js';
import { buildAtmosphere } from './atmosphere.js';
import { Soundscape } from './audio.js';
import { GameplayController } from './gameplay.js';
import { CyberHUD } from './ui.js';

async function boot() {
  const container = document.getElementById('canvas-wrap');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingBar = document.getElementById('loading-bar-fill');
  const loadingStatus = document.getElementById('loading-status');

  const setProgress = (pct, text) => {
    if (loadingBar) loadingBar.style.width = `${pct}%`;
    if (loadingStatus) loadingStatus.textContent = text;
  };

  setProgress(18, '解壓縮 Blender 3D 載具、骨架人物與霓虹街景資產...');

  // 1. Renderer setup
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // 2. Scene & Camera & Rainy Night Lighting
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050916);
  scene.fog = new THREE.FogExp2(0x060b1c, 0.0072);

  const hemiLight = new THREE.HemisphereLight(0x4c88f0, 0x281542, 2.35);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0x82bfff, 1.9);
  dirLight.position.set(50, 100, -60);
  scene.add(dirLight);

  const neonBounceLight = new THREE.DirectionalLight(0xff3ca8, 1.05);
  neonBounceLight.position.set(-60, 55, 65);
  scene.add(neonBounceLight);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.25,
    240
  );

  // 3. Load embedded Blender GLB packs
  const assets = await loadAssets();
  setProgress(55, '程序生成 6 大賽博街區、高樓全息廣告與濕地反射...');

  // 4. Build Procedural City & Enterable Venues (PULSE Club, AFTERGLOW Bar, CHROME Garage)
  const city = buildCity(scene, assets);
  setProgress(78, '啟動雨滴粒子、蒸氣孔、車流、飛車與骨骼動畫人群...');

  // 5. Build Rainy Night Atmosphere & Traffic/Crowd
  const atmosphere = buildAtmosphere(scene, assets, city);

  // 6. Initialize WebAudio Soundscape & Gameplay & HUD
  const soundscape = new Soundscape();
  let hud = null;
  const gameplay = new GameplayController(
    scene,
    camera,
    assets,
    city,
    soundscape,
    (msg) => {
      if (hud) hud.showToast(msg);
    }
  );
  hud = new CyberHUD(gameplay, soundscape);

  setProgress(100, 'NEON NIGHT CITY // 系統連線完成');
  setTimeout(() => {
    if (loadingOverlay) loadingOverlay.setAttribute('hidden', '');
  }, 120);

  // --- Input Listeners (Keyboard + Pointer Camera Orbit) ---
  const keyMap = {
    KeyW: 'forward',
    ArrowUp: 'forward',
    KeyS: 'backward',
    ArrowDown: 'backward',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    Space: 'brake',
    ShiftLeft: 'sprint',
    ShiftRight: 'sprint',
  };

  window.addEventListener('keydown', (e) => {
    soundscape.init();
    if (keyMap[e.code]) {
      gameplay.keys[keyMap[e.code]] = true;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) {
        e.preventDefault();
      }
    }
    if (e.repeat) return;

    if (e.code === 'KeyF') {
      gameplay.toggleVehicleMode();
    } else if (e.code === 'KeyV') {
      gameplay.summonCar();
    } else if (e.code === 'KeyG') {
      gameplay.toggleDance();
    } else if (e.code === 'KeyE') {
      gameplay.triggerContextAction();
    } else if (e.code === 'KeyC') {
      gameplay.cycleCarLivery();
    } else if (e.code === 'KeyM') {
      hud.toggleMapModal();
    } else if (e.code === 'Escape') {
      hud.toggleMapModal(false);
    } else if (e.code === 'Digit1') {
      hud.handleTeleport('pulse_street');
    } else if (e.code === 'Digit2') {
      hud.handleTeleport('pulse_inside');
    } else if (e.code === 'Digit3') {
      hud.handleTeleport('bar_inside');
    } else if (e.code === 'Digit4') {
      hud.handleTeleport('garage_inside');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) {
      gameplay.keys[keyMap[e.code]] = false;
    }
  });

  // Pointer drag on canvas to orbit camera around car / character
  let isDragging = false;
  let lastPtrX = 0;
  let lastPtrY = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    soundscape.init();
    isDragging = true;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPtrX;
    const dy = e.clientY - lastPtrY;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    gameplay.camOrbitYawOffset -= dx * 0.0055;
    gameplay.camOrbitPitchOffset = Math.max(
      -0.8,
      Math.min(2.8, gameplay.camOrbitPitchOffset + dy * 0.012)
    );
  });
  window.addEventListener('pointerup', () => {
    isDragging = false;
  });
  renderer.domElement.addEventListener('dblclick', () => {
    gameplay.camOrbitYawOffset = 0;
    gameplay.camOrbitPitchOffset = 0;
  });

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Main Render Loop ---
  let lastTime = performance.now();
  let elapsed = 0;

  function stepFrame(dt) {
    elapsed += dt;
    // Gently decay manual camera orbit offset when moving
    if (Math.abs(gameplay.speedKmh) > 5 && !isDragging) {
      gameplay.camOrbitYawOffset *= Math.max(0, 1 - dt * 2.5);
    }

    gameplay.update(dt);
    atmosphere.update(dt, elapsed, gameplay.activePos, camera);
    soundscape.update(dt, {
      mode: gameplay.mode,
      speedKmh: gameplay.speedKmh,
      boosting: gameplay.boosting,
      drifting: gameplay.drifting,
      pos: gameplay.activePos,
      insideVenue: gameplay.insideVenue,
    });
    hud.update(dt, atmosphere.trafficCars);
    renderer.render(scene, camera);
  }

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    stepFrame(dt);
  }

  // Expose diagnostic & automation API for Playwright verification
  window.__nc = {
    ready: true,
    scene,
    camera,
    renderer,
    assets,
    city,
    atmosphere,
    soundscape,
    gameplay,
    hud,
    step: (dt = 1 / 60) => stepFrame(dt),
    getStats: () => ({
      fps: hud.currentFps,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      mode: gameplay.mode,
      speedKmh: Math.round(gameplay.speedKmh),
      district: gameplay.currentDistrict ? gameplay.currentDistrict.name : '',
      venue: gameplay.insideVenue ? gameplay.insideVenue.name : null,
      pos: {
        x: Number(gameplay.activePos.x.toFixed(2)),
        y: Number(gameplay.activePos.y.toFixed(2)),
        z: Number(gameplay.activePos.z.toFixed(2)),
      },
      dancing: gameplay.dancing,
      drinksOrdered: gameplay.drinksOrdered,
      liveryIndex: gameplay.liveryIndex,
    }),
  };

  // Run one initial frame immediately so first paint is populated
  stepFrame(0.016);
  requestAnimationFrame(animate);
}

boot().catch((err) => {
  console.error('Boot error:', err);
});
