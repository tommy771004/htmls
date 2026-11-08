// 引擎、場景、相機、光照、後處理與快照渲染。
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves.js';
import { SnapshotRenderingHelper } from '@babylonjs/core/Misc/snapshotRenderingHelper.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent.js';
import '@babylonjs/core/Physics/v2/physicsEngineComponent.js';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin.js';
import HavokPhysics from '@babylonjs/havok';
import wasmData from '@babylonjs/havok/lib/esm/HavokPhysics.wasm';
import { loadEnv } from './env.js';
import { sendWorld } from './tmp.js';

/** 太陽方向（由光源指向場景）。env.hdr 已移除太陽盤，這裡比 HDR 的太陽再抬高、轉向巷道，讓主要街道有直射光。 */
export const SUN_DIR = new Vector3(-0.42, -0.80, 0.42).normalize();

export async function createEngine(canvas, { forceWebGL = false } = {}) {
  let gpu = !forceWebGL && await WebGPUEngine.IsSupportedAsync.catch(() => false), engine = null;
  if (gpu) {
    try {
      engine = new WebGPUEngine(canvas, { enableAllFeatures: true, setMaximumLimits: true, antialias: false, powerPreference: 'high-performance', doNotHandleContextLost: true });
      await engine.initAsync();
    } catch (e) {   // 有 navigator.gpu 不代表拿得到裝置（requestDevice 失敗、超限）：退回 WebGL，不要讓開機死在這裡
      console.warn('WebGPU 初始化失敗，改用 WebGL', e?.message ?? e);
      try { engine?.dispose(); } catch { /* 沒建好的引擎 dispose 可能再丟一次 */ }
      engine = null; gpu = false;
      const fresh = canvas.cloneNode(); canvas.replaceWith(fresh); canvas = fresh;   // 畫布已經拿過 webgpu context 就不能再拿 webgl2
    }
  }
  if (!engine) engine = new Engine(canvas, false, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance', doNotHandleContextLost: true });
  // 裝置遺失不交給 Babylon 還原：快照 bundle 和 sendWorld 記的緩衝都綁舊裝置，還原後第一幀就在 bindUniformBuffer 丟例外，主迴圈整個停住。main.js 改成重載頁面
  const gpuLost = new Promise(ok => { if (gpu) engine._device.lost.then(ok); else canvas.addEventListener('webglcontextlost', ok, { once: true }); });
  engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 2));

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.74, 0.84, 0.93, 1);
  scene.skipFrustumClipping = !!gpu;           // 快照 bundle 不做剔除；WebGL 退回路徑保留
  scene.autoClearDepthAndStencil = true;

  const bytes = Uint8Array.from(atob(wasmData.split(',')[1]), c => c.charCodeAt(0));
  const hk = await HavokPhysics({ wasmBinary: bytes.buffer });
  const plugin = new HavokPlugin(false, hk);
  scene.enablePhysics(new Vector3(0, -15, 0), plugin);

  const camera = new FreeCamera('cam', new Vector3(0, 2, 0), scene, false);
  scene.activeCamera = camera;
  camera.inputs.clear();
  camera.minZ = 0.04; camera.maxZ = 600;
  camera.fovMode = FreeCamera.FOVMODE_HORIZONTAL_FIXED; camera.fov = Math.PI / 2;   // 水平 90°
  camera.rotationQuaternion = null;

  const sun = new DirectionalLight('sun', SUN_DIR.clone(), scene);
  sun.intensity = 11.8;
  sun.diffuse = new Color3(1.0, 0.92, 0.78);
  sun.specular = new Color3(1.0, 0.95, 0.85);
  sun.position = SUN_DIR.scale(-120);
  sun.autoUpdateExtends = false;
  sun.autoCalcShadowZBounds = false;
  sun.orthoLeft = -95; sun.orthoRight = 95; sun.orthoTop = 95; sun.orthoBottom = -95;
  sun.shadowMinZ = 1; sun.shadowMaxZ = 260;

  // 暖色反彈：地面把砂岩色打回牆面（hemi 的 groundColor），陰影保持冷灰藍（天光）
  const bounce = new HemisphericLight('bounce', new Vector3(0, 1, 0), scene);
  bounce.intensity = 0.55;
  bounce.diffuse = new Color3(0.72, 0.80, 0.95);
  bounce.groundColor = new Color3(0.86, 0.66, 0.42);
  bounce.specular = new Color3(0, 0, 0);

  const useCSM = !!gpu && !new URLSearchParams(location.search).has('nocsm');   // 看實際後端，不看 ?gfx：沒有 WebGPU 的裝置才會和 ?gfx=webgl 走同一條
  const shadow = useCSM ? new CascadedShadowGenerator(2048, sun, true) : new ShadowGenerator(4096, sun, true);
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias = 0.0012; shadow.normalBias = 0.02;
  shadow.setDarkness(0);
  // 2026-11-08 效能：快照模式不做剔除，每一層都畫全部投影物件（每層約 480 萬三角形），層數就是頂點成本。
  // 4 層 → 3 層、陰影距離 170 → 90 m（最長直線視野 48 m），同頁交錯量 GPU 每幀 24.2 → 約 21 ms，畫面只差遠處陰影邊緣。
  if (useCSM) { shadow.numCascades = 3; shadow.lambda = 0.82; shadow.shadowMaxZ = 90; shadow.stabilizeCascades = true; shadow.autoCalcDepthBounds = false; shadow.cascadeBlendPercentage = 0.08; }
  shadow.getShadowMap().refreshRate = 1;

  const { env, sky: skyTex } = await loadEnv(scene);
  scene.environmentTexture = env;
  scene.environmentIntensity = 1.2;

  // 天空用同一張 HDR，走同一條 ACES，方位自然和 IBL 一致
  const skyMat = new PBRMaterial('sky', scene);
  skyMat.reflectivityColor = new Color3(1, 1, 1); skyMat.environmentIntensity = 1.5; skyMat.emissiveColor = new Color3(0.36, 0.48, 0.6); skyMat.backFaceCulling = false; skyMat.disableLighting = true; skyMat.microSurface = 1; skyMat.twoSidedLighting = true;
  skyTex.coordinatesMode = Constants.TEXTURE_SKYBOX_MODE;
  skyMat.reflectionTexture = skyTex;
  const dome = MeshBuilder.CreateBox('skydome', { size: 500, sideOrientation: 1 }, scene);
  dome.material = skyMat; dome.infiniteDistance = true; dome.isPickable = false; dome.ignoreCameraMaxZ = true;

  const Q = new URLSearchParams(location.search);
  const pipeline = new DefaultRenderingPipeline('post', !Q.has('ldr'), scene, Q.has('nopp') ? [] : [camera]);
  pipeline.samples = 1;
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = !new URLSearchParams(location.search).has('raw'); pipeline.bloomThreshold = 1.1; pipeline.bloomWeight = 0.12; pipeline.bloomScale = 0.5; pipeline.bloomKernel = 48;
  pipeline.imageProcessingEnabled = true;
  const ip = pipeline.imageProcessing;
  ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.12; ip.contrast = 1.1;
  ip.colorCurvesEnabled = true; ip.colorCurves = new ColorCurves(); ip.colorCurves.globalSaturation = 36;

  // 快照：FAST 模式。enable() 之後 mesh 集合與實例數凍結。
  const helper = gpu ? new SnapshotRenderingHelper(scene) : null;
  if (helper) {
    // helper 每幀對所有骨架 prepare(true)、掃所有網格，10 副骨架就要 0.8 ms，占 FAST 一幀一半，而且士兵停放時根本沒變。
    // 骨架與世界矩陣 updateSoldiers 已經送了，粒子、精靈、變形目標這裡都沒用，只有天空罩要跟著鏡頭。
    scene.onBeforeRenderObservable.remove(helper._onBeforeRenderObserver);
    scene.onBeforeRenderObservable.add(() => { if (engine.snapshotRendering) { dome.computeWorldMatrix(true); sendWorld(dome); } });
  }
  const snapshot = {
    helper, active: false,
    enable() { if (helper && !this.active) { helper.fixMeshes(); helper.enableSnapshotRendering(); this.active = true; } },
    disable() { if (helper && this.active) { helper.disableSnapshotRendering(); this.active = false; } },
  };

  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.0035; scene.fogColor = new Color3(0.72, 0.76, 0.80);
  dome.applyFog = false;
  // 直式手機用 90° 水平視角時垂直視角超過 130°，手臂會被拉長且露出切口
  const fitFov = () => { camera.fov = innerWidth < innerHeight ? 1.1 : Math.PI / 2; };
  fitFov();
  addEventListener('resize', () => { engine.resize(); fitFov(); });
  return { engine, scene, camera, sun, bounce, shadow, plugin, pipeline, snapshot, isWebGPU: !!gpu, Constants, fitFov, canvas, gpuLost };
}
