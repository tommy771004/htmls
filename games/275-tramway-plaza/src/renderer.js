// Three.js r187 (0.187.0) WebGPURenderer + RenderPipeline + GTAONode + PMREM 攝影棚柔光管線
import * as THREE from 'three';
import {
  WebGPURenderer,
  RenderPipeline,
  PMREMGenerator,
  MeshBasicNodeMaterial,
} from 'three/webgpu';
import {
  pass,
  mrt,
  normalView,
  screenUV,
  builtinAOContext,
  uniform,
  float,
  mix,
  pow,
  clamp,
  positionLocal,
  color,
  smoothstep,
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA_PRESETS } from './config.js';

export const STUDIO_BG_HEX = '#dcd7d0';

/**
 * 建立程序化建築攝影棚環境圖（r187 新版 CubeRenderTarget PMREMGenerator）：
 * 頂部大型暖白柔光箱、側面柔和天光與米灰桌面反光，營造溫潤不生硬的微縮模型漫射光。
 */
function buildStudioEnvironment(renderer) {
  const envScene = new THREE.Scene();
  const domeMat = new MeshBasicNodeMaterial({ side: THREE.BackSide });
  const py = clamp(positionLocal.normalize().y, -1.0, 1.0);
  const upperMix = smoothstep(float(-0.08), float(0.75), py);
  const bounceMix = smoothstep(float(-0.8), float(-0.05), py);
  const groundCol = mix(color('#bdb5a9'), color('#dcd5ca'), bounceMix);
  const skyCol = mix(groundCol, color('#f8f4ec'), upperMix);
  domeMat.colorNode = skyCol;

  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 20), domeMat);
  envScene.add(dome);

  // 頂部偏左前的暖色主柔光板（讓水池、窗玻璃與欄杆有柔和攝影棚高光）
  const softboxMat = new MeshBasicNodeMaterial({ color: '#fffaf0', side: THREE.DoubleSide });
  const softbox = new THREE.Mesh(new THREE.PlaneGeometry(34, 26), softboxMat);
  softbox.position.set(-14, 26, 12);
  softbox.lookAt(0, 0, 0);
  envScene.add(softbox);

  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0.035);
  dome.geometry.dispose();
  domeMat.dispose();
  softbox.geometry.dispose();
  softboxMat.dispose();
  pmrem.dispose();
  return envRT;
}

export async function createCityStage(canvas, { forceWebGL = false, lowQuality = false } = {}) {
  let renderer = null;
  let backendName = 'WebGPU';
  const configs = forceWebGL ? [true] : [false, true];

  for (const useGL of configs) {
    try {
      const r = new WebGPURenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        forceWebGL: useGL,
      });
      await r.init();
      renderer = r;
      backendName = r.backend?.isWebGPUBackend ? 'WebGPU (r187)' : 'WebGL2 Fallback (r187)';
      break;
    } catch {
      try { renderer?.dispose?.(); } catch { /* ignore */ }
      renderer = null;
    }
  }
  if (!renderer) {
    throw new Error('無法初始化 Three.js r187 WebGPU / WebGL2 渲染器');
  }

  const maxDpr = lowQuality ? 1.35 : 2.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.NeutralToneMapping; // Khronos PBR Neutral：保留奶油白層次不死白
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // r187 ShadowFilterNode 內建 5-sample Vogel Disk × IGN 等效 20-tap 柔影

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STUDIO_BG_HEX);

  const envRT = buildStudioEnvironment(renderer);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.58;

  // 柔和雙層環境與主太陽光（對齊參考圖：左前上方暖陽，右後方投出柔和陰影）
  const hemi = new THREE.HemisphereLight('#fffaf0', '#cfc6b8', 0.62);
  hemi.position.set(0, 40, 0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff1dc', 2.45);
  sun.position.set(-46, 46, 28);
  sun.castShadow = true;
  const shadowRes = lowQuality ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowRes, shadowRes);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 15;
  sun.shadow.camera.far = 135;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.028;
  sun.shadow.radius = 2.8; // 控制 r187 Vogel Disk 柔邊半徑
  scene.add(sun);
  scene.add(sun.target);

  // 右後側微弱補光（避免背光牆面過暗，呈現建築微縮模型的通透感）
  const fillLight = new THREE.DirectionalLight('#eef3fa', 0.36);
  fillLight.position.set(38, 26, -32);
  scene.add(fillLight);

  // 等角長焦透視相機（FOV 20° 兼具等角建築比例與自然景深，並完整支援 GTAONode 深度重建）
  const initPreset = CAMERA_PRESETS.overview;
  const camera = new THREE.PerspectiveCamera(initPreset.fov, 16 / 10, 4.0, 320.0);
  camera.position.set(...initPreset.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...initPreset.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.75;
  controls.screenSpacePanning = false;
  controls.minDistance = 26;
  controls.maxDistance = 175;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = 1.38;
  controls.update();

  // r187 RenderPipeline（取代舊版已棄用的 PostProcessing）+ 二次方近場步進 GTAONode
  const pipeline = new RenderPipeline(renderer);
  const uAoStrength = uniform(lowQuality ? 0.0 : 0.92);

  // 法線與深度預通道（供 GTAO 精確計算牆角、屋簷、樹穴與柱腳環境遮蔽）
  const prePass = pass(scene, camera);
  prePass.setMRT(mrt({ output: normalView }));
  const preNormal = prePass.getTextureNode();
  const preDepth = prePass.getTextureNode('depth');

  const aoPass = ao(preDepth, preNormal, camera);
  aoPass.resolutionScale = lowQuality ? 0.5 : 0.68;
  aoPass.radius.value = 1.35;
  aoPass.scale.value = 1.15;
  aoPass.thickness.value = 1.2;
  aoPass.samples.value = lowQuality ? 8 : 16;
  const aoTex = aoPass.getTextureNode();

  const scenePassAO = pass(scene, camera);
  const aoFactor = clamp(pow(aoTex.sample(screenUV).r, float(1.18)), 0.0, 1.0);
  const blendedAO = mix(float(1.0), aoFactor, uAoStrength);
  scenePassAO.contextNode = builtinAOContext(blendedAO);

  const scenePassDirect = pass(scene, camera);

  let gtaoEnabled = !lowQuality;
  pipeline.outputNode = gtaoEnabled ? scenePassAO : scenePassDirect;

  function setGTAO(enabled, strength = 0.92) {
    gtaoEnabled = Boolean(enabled);
    uAoStrength.value = gtaoEnabled ? strength : 0.0;
    pipeline.outputNode = gtaoEnabled ? scenePassAO : scenePassDirect;
    pipeline.needsUpdate = true;
  }

  // 光線氛圍切換（柔和晨光／午後暖陽／微曦柔霧）
  const LIGHTING_MODES = {
    softStudio: {
      sunColor: '#fff1dc',
      sunInt: 2.45,
      sunPos: [-46, 46, 28],
      hemiSky: '#fffaf0',
      hemiGround: '#cfc6b8',
      hemiInt: 0.62,
      envInt: 0.58,
      bg: '#dcd7d0',
      exposure: 1.02,
    },
    goldenAfternoon: {
      sunColor: '#ffe0b5',
      sunInt: 2.35,
      sunPos: [-52, 38, 30],
      hemiSky: '#fff3e2',
      hemiGround: '#c9bca8',
      hemiInt: 0.76,
      envInt: 0.72,
      bg: '#dfd6ca',
      exposure: 1.0,
    },
    overcastMaquette: {
      sunColor: '#f7f6f2',
      sunInt: 1.35,
      sunPos: [-34, 60, 22],
      hemiSky: '#ffffff',
      hemiGround: '#d4cfc7',
      hemiInt: 1.08,
      envInt: 0.92,
      bg: '#e1ded8',
      exposure: 1.04,
    },
  };

  let currentLighting = 'softStudio';
  function setLightingMode(modeKey) {
    const m = LIGHTING_MODES[modeKey] || LIGHTING_MODES.softStudio;
    currentLighting = modeKey;
    sun.color.set(m.sunColor);
    sun.intensity = m.sunInt;
    sun.position.set(...m.sunPos);
    hemi.color.set(m.hemiSky);
    hemi.groundColor.set(m.hemiGround);
    hemi.intensity = m.hemiInt;
    scene.environmentIntensity = m.envInt;
    scene.background.set(m.bg);
    renderer.toneMappingExposure = m.exposure;
  }

  // 平滑視角切換與列車跟拍
  let tween = null;
  let activePreset = 'overview';
  let followTrain = false;

  controls.addEventListener('start', () => {
    tween = null;
    followTrain = false;
  });

  function goToPreset(key, instant = false) {
    const p = CAMERA_PRESETS[key] || CAMERA_PRESETS.overview;
    activePreset = key;
    followTrain = Boolean(p.followTrain);
    if (instant) {
      tween = null;
      camera.position.set(...p.pos);
      controls.target.set(...p.target);
      camera.fov = p.fov;
      camera.updateProjectionMatrix();
      controls.update();
      return;
    }
    tween = {
      t: 0,
      dur: 0.85,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...p.pos),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...p.target),
      fromFov: camera.fov,
      toFov: p.fov,
    };
  }

  function updateCamera(dt, trainFocusPos = null) {
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const e = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      const destTarget = followTrain && trainFocusPos ? trainFocusPos : tween.toTarget;
      controls.target.lerpVectors(tween.fromTarget, destTarget, e);
      camera.fov = THREE.MathUtils.lerp(tween.fromFov, tween.toFov, e);
      camera.updateProjectionMatrix();
      if (tween.t >= 1) tween = null;
    } else if (followTrain && trainFocusPos) {
      const delta = trainFocusPos.clone().sub(controls.target);
      controls.target.addScaledVector(delta, Math.min(1, dt * 6.5));
      camera.position.addScaledVector(delta, Math.min(1, dt * 6.5));
    }
    controls.update();
  }

  function resize(w, h) {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // 直式手機螢幕自動微調 FOV 以完整納入橫向微縮底座
    const baseFov = (CAMERA_PRESETS[activePreset] || CAMERA_PRESETS.overview).fov;
    if (camera.aspect < 0.85) {
      camera.fov = Math.min(34, baseFov / Math.pow(camera.aspect, 0.52));
    } else {
      camera.fov = baseFov;
    }
    camera.updateProjectionMatrix();
  }

  function renderFrame() {
    pipeline.render();
  }

  return {
    renderer,
    backendName,
    scene,
    camera,
    controls,
    pipeline,
    sun,
    hemi,
    setGTAO,
    isGTAO: () => gtaoEnabled,
    setLightingMode,
    getLightingMode: () => currentLighting,
    goToPreset,
    getActivePreset: () => activePreset,
    updateCamera,
    resize,
    renderFrame,
  };
}
