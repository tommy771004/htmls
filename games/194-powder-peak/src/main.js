// POWDER PEAK — 啟動、renderer、燈光、天空、遊戲迴圈、計分、狀態機、測試 API。
import * as THREE from 'three';
import { config } from './config.js';
import { clamp, damp } from './shared.js';
import { createAssets } from './assets.js';
import { Terrain } from './terrain.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Bot } from './bot.js';
import { ChaseCamera } from './camera.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';

// 參數唯一來源是 config.js（不在這裡重複寫預設值）
const R = config.render;
const SIM = config.sim;
const S = config.score;
const BEST_KEY = 'powderpeak.best';
const MUTE_KEY = 'powderpeak.muted';

function loadMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

// ---------- 工具 ----------
function readParams() {
  let q;
  try {
    q = new URLSearchParams(window.location.search);
  } catch (e) {
    q = new URLSearchParams('');
  }
  const flag = (k) => {
    const v = q.get(k);
    return v !== null && v !== '0' && v !== 'false';
  };
  let seed = null;
  if (q.has('seed')) {
    const n = Number(q.get('seed'));
    if (Number.isFinite(n)) seed = Math.floor(Math.abs(n)) >>> 0;
  }
  // 效能除錯參數：pr=固定 pixelRatio（停用自動畫質）、aa=0/1 強制 MSAA、shadow=off|basic|pcf|soft、smap=陰影貼圖大小
  const num = (k) => {
    const n = q.has(k) ? Number(q.get(k)) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const aa = q.has('aa') ? flag('aa') : null;
  const shadow = q.has('shadow') ? String(q.get('shadow')).toLowerCase() : null;
  // mp=算繪像素預算覆寫（例如 mp=9e6 模擬慢 GPU，驗證自動畫質）
  // orphan=0 關掉 buffer orphan 上傳（A/B 用）
  const orphan = q.has('orphan') ? flag('orphan') : null;
  return { bot: flag('bot'), debug: flag('debug'), mute: flag('mute'), seed, pr: num('pr'), aa, shadow, smap: num('smap'), mp: num('mp'), orphan };
}

function randomSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  } catch (e) {
    return Math.floor(Math.random() * 4294967296) >>> 0;
  }
}

function loadBest() {
  try {
    const v = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(v) {
  try {
    window.localStorage.setItem(BEST_KEY, String(v));
  } catch (e) {
    /* storage 被擋時忽略 */
  }
}

const TONE_MAPS = {
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
  none: THREE.NoToneMapping,
};

const SHADOW_TYPES = {
  basic: THREE.BasicShadowMap,
  pcf: THREE.PCFShadowMap,
  // three r0.180 起 PCFShadowMap 本身就是柔邊（PCFSoftShadowMap 已棄用，用了會印警告），soft 保留為別名
  soft: THREE.PCFShadowMap,
  vsm: THREE.VSMShadowMap,
};

// ---------- buffer 上傳（perf）----------
// 每幀都更新的 buffer（噴雪 / 飄雪粒子、雲的 instance 矩陣）與每過一個 chunk 更新的物件池，three 用
// bufferSubData 覆寫。ANGLE（D3D11）上覆寫「GPU 還在讀」的 buffer 會同步等 GPU 畫完 → CPU 與 GPU 無法重疊。
// 從 0 開始的上傳改成 bufferData（orphan：驅動換一塊新記憶體，不用等）；內容相同（three 的 attribute.array
// 就是整個 buffer 的內容，大小不變）。實測 1080p：render() CPU p50 11.7 → 2.2 ms，fps +20～50%。
function patchBufferUploads(gl) {
  if (!gl || gl.__ppOrphan) return;
  gl.__ppOrphan = true;
  const sub = gl.bufferSubData.bind(gl);
  const ARRAY = gl.ARRAY_BUFFER;
  const ELEMENT = gl.ELEMENT_ARRAY_BUFFER;
  const DYNAMIC = gl.DYNAMIC_DRAW;
  gl.bufferSubData = function (target, dstOffset, src, srcOffset, length) {
    if (dstOffset === 0 && !srcOffset && (target === ARRAY || target === ELEMENT) && src && src.byteLength !== undefined) {
      gl.bufferData(target, src, DYNAMIC);
      return;
    }
    return arguments.length > 3 ? sub(target, dstOffset, src, srcOffset, length) : sub(target, dstOffset, src);
  };
}

// ---------- 天空 ----------
function createSky() {
  const sunDir = new THREE.Vector3().fromArray(R.sunDirection).normalize();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(R.skyTop) },
      uHorizon: { value: new THREE.Color(R.skyHorizon) },
      uFog: { value: new THREE.Color(R.fogColor) },
      uHaze: { value: R.skyHaze !== undefined ? R.skyHaze : 0.08 },
      uSun: { value: new THREE.Color(R.sunColor) },
      uSunDir: { value: sunDir },
      uGlow: { value: R.sunGlow },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_Position.z = gl_Position.w; // 永遠在遠平面
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uFog;
      uniform float uHaze;
      uniform vec3 uSun;
      uniform vec3 uSunDir;
      uniform float uGlow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float t = smoothstep(-0.03, 0.55, d.y);
        t = pow(t, 0.75);
        vec3 col = mix(uHorizon, uTop, t);
        // 地平線上一條薄霧帶接霧色（地形遠端 / 遠丘底部無縫），往上很快回到藍天（附圖天空藍到地平線）
        col = mix(uFog, col, smoothstep(-0.01, uHaze, d.y));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSun * (pow(s, 600.0) * 1.5 + pow(s, 32.0) * uGlow + pow(s, 5.0) * uGlow * 0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R.skyRadius, 32, 16), mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1e6; // 最後畫，只填補沒被覆蓋的像素
  mesh.matrixAutoUpdate = true;
  return mesh;
}

// ---------- 共用暫存 ----------
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _gatePos = new THREE.Vector3();

const ZERO_AUDIO = { speed: 0, grounded: true, skid: 0, crouch: 0, state: 'ready' };

function freshStats() {
  return {
    distance: 0,
    maxSpeed: 0,
    longestAir: 0,
    time: 0,
    crashes: 0,
    gatesPassed: 0,
    gatesMissed: 0,
    hits: 0,
    fenceHits: 0,
    speedSum: 0,
    landings: { clean: 0, wobble: 0, crash: 0 },
  };
}

class Game {
  constructor(params) {
    this.params = params;
    this.fixedSeed = params.seed;
    this.seed = params.seed !== null ? params.seed : randomSeed();
    this.useBot = params.bot;
    this.state = 'title';
    this.muted = params.mute || loadMuted();
    this.audioReady = false;
    this.best = loadBest();

    this.stats = freshStats();
    this.bonusScore = 0;
    this.combo = 0;
    this.score = 0;
    this.gameOverTimer = -1;
    this.accumulator = 0;
    this.lastTime = -1;
    this.clock = 0; // 真實時間（給 attract 鏡頭）
    this.airCur = 0;
    this.wasAir = false;
    this.fenceGap = 99;
    this.prevCrouch = false;
    this.simulating = false;
    this.simEndless = false;
    this.needsReset = false;
    this.errorLogged = false;
    this.popupFree = 0;

    this._initDom();
    this._initRenderer();
    this._initScene();
    this._initModules();
    this._initQuality();
    this._initEvents();
    if (params.debug) this._initDebug();

    this._newRun(false);
    if (this.useBot) {
      // 自動駕駛：自動開始，不需使用者手勢（音效等第一次點擊再初始化）
      this.start();
    } else {
      this.hud.setScreen('title');
    }
    this._frame = this._frame.bind(this);
    requestAnimationFrame(this._frame);
  }

  // ---------- 初始化 ----------
  _initDom() {
    let container = document.getElementById('game');
    if (!container) {
      container = document.createElement('div');
      container.id = 'game';
      container.style.cssText = 'position:fixed;inset:0;overflow:hidden;';
      document.body.prepend(container);
    }
    this.container = container;
    this.hudRoot = document.getElementById('hud') || document.body;
  }

  _initRenderer() {
    const P = this.params;
    this.devicePR = window.devicePixelRatio || 1;
    this.qualityPR = Infinity; // 自動畫質等級（實際 pixelRatio = min(此值, 像素預算上限)）
    // MSAA 只能在建 context 時決定：起始算繪像素（已套像素預算）夠小才開（iGPU 上高解析度 MSAA 很貴）
    const w0 = this.container.clientWidth || window.innerWidth || 1280;
    const h0 = this.container.clientHeight || window.innerHeight || 720;
    const pr0 = P.pr || this._capPR(w0, h0);
    const aa = P.aa !== null ? P.aa : R.antialias !== false && w0 * h0 * pr0 * pr0 <= R.antialiasMaxPixels;
    const renderer = new THREE.WebGLRenderer({ antialias: aa, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const tm = TONE_MAPS[String(R.toneMapping).toLowerCase()];
    renderer.toneMapping = tm !== undefined ? tm : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = R.exposure;
    const shadowType = P.shadow || R.shadowType || 'soft';
    renderer.shadowMap.enabled = shadowType !== 'off';
    renderer.shadowMap.type = SHADOW_TYPES[shadowType] !== undefined ? SHADOW_TYPES[shadowType] : THREE.PCFShadowMap;
    renderer.setClearColor(R.skyHorizon, 1);
    if (P.orphan !== null ? P.orphan : R.orphanBufferUpdates !== false) patchBufferUploads(renderer.getContext());
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    this.container.appendChild(canvas);
    this.renderer = renderer;
    this.antialias = aa;
    this.pixelRatio = pr0;
    renderer.setPixelRatio(this.pixelRatio);
  }

  // pixelRatio 上限：裝置 DPR、maxPixelRatio、算繪像素預算（maxRenderPixels）三者取小。
  // iGPU 是填充率瓶頸：1080p@DPR1.5 若照 DPR 算繪是 2880x1620 = 4.7 MP，預算把它壓在 ~2.2 MP（≈ 1080p）。
  _capPR(w, h) {
    const byPixels = Math.sqrt((this.params.mp || R.maxRenderPixels) / Math.max(1, w * h));
    return Math.max(R.minPixelRatio, Math.min(this.devicePR, R.maxPixelRatio, byPixels));
  }

  _initScene() {
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(R.fogColor, R.fogNear, R.fogFar);
    // 霧改用「到鏡頭的距離」而不是視深（three 預設 -mvPosition.z）：寬畫面左右邊緣的視深比實際距離短，
    // 新生成的 chunk / 樹在霧只有 ~77 % 時就冒出來（pop-in）。用距離算，畫面邊緣和正前方同樣在 fogFar 前全霧。
    if (R.fogRange && THREE.ShaderChunk.fog_vertex.includes('- mvPosition.z')) {
      THREE.ShaderChunk.fog_vertex = THREE.ShaderChunk.fog_vertex.replace('- mvPosition.z', 'length( mvPosition.xyz )');
    }
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(config.camera ? config.camera.fovBase : 62, 1, R.cameraNear, R.cameraFar);
    this.camera.position.set(0, 3, 8);
    scene.add(this.camera);

    this.hemi = new THREE.HemisphereLight(R.hemiSky, R.hemiGround, R.hemiIntensity);
    scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(R.sunColor, R.sunIntensity);
    sun.castShadow = true;
    const smap = this.params.smap || R.shadowMapSize;
    sun.shadow.mapSize.set(smap, smap);
    const sc = sun.shadow.camera;
    sc.left = -R.shadowRange;
    sc.right = R.shadowRange;
    sc.top = R.shadowRange;
    sc.bottom = -R.shadowRange;
    sc.near = 1;
    sc.far = R.shadowLightDistance + R.shadowRange * 3;
    sc.updateProjectionMatrix();
    sun.shadow.bias = R.shadowBias;
    sun.shadow.normalBias = R.shadowNormalBias;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // 光空間基底（陰影貼圖貼齊 texel 用，避免移動時閃爍）
    this.sunDir = new THREE.Vector3().fromArray(R.sunDirection).normalize();
    const m = new THREE.Matrix4().lookAt(this.sunDir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    this.lightRight = new THREE.Vector3().setFromMatrixColumn(m, 0);
    this.lightUp = new THREE.Vector3().setFromMatrixColumn(m, 1);
    this.shadowTexel = (2 * R.shadowRange) / smap;

    this.sky = createSky();
    scene.add(this.sky);
  }

  _initModules() {
    this.assets = createAssets();
    this.terrain = new Terrain(this.scene, this.assets, config, this.seed);
    this.player = new Player(this.scene, this.assets, this.terrain, config);
    this._splitSkierMaterial();
    this.input = new Input(this.renderer.domElement);
    this.bot = new Bot(this.terrain, config);
    this.chase = new ChaseCamera(this.camera, config);
    this.effects = new Effects(this.scene, config, this.terrain);
    this.audio = new AudioEngine();
    this.hud = new HUD(this.hudRoot);

    try {
      const te = this.hud.touchElements;
      if (te && this.input.bindTouch) this.input.bindTouch(te);
    } catch (e) {
      console.warn('[main] bindTouch failed', e);
    }
    try {
      this.audio.setMuted(this.muted);
    } catch (e) {
      /* audio 尚未 init 時可能不接受 */
    }
    this.hud.setMuted(this.muted);

    // HUD 小地圖資料（重用陣列，避免每幀配置）
    this.minimapPathAbs = [];
    this.minimapGatesAbs = [];
    this.minimapTimer = 0;
    this.minimap = { path: [], gates: [], player: { x: 0, z: 0, heading: 0 } };
    this.hudData = {
      time: 0,
      score: 0,
      speedKmh: 0,
      boost: 0,
      livesLeft: S.lives,
      distance: 0,
      combo: 0,
      minimap: this.minimap,
    };
    this.audioData = { speed: 0, grounded: true, skid: 0, crouch: 0, state: 'ready' };
  }

  // 共用的 vc 材質同時用在 InstancedMesh（地形物件，receiveShadow）與一般 Mesh（滑雪者 12 個部件）：
  // 兩者需要不同 shader program，three 每次 draw 在兩者間切換都要重算 program cache key（CPU + 每幀配置）。
  // 滑雪者改用自己的 clone（外觀完全相同）→ 實測 render() CPU 約 -0.4 ms/幀。
  _splitSkierMaterial() {
    const shared = this.assets.materials && this.assets.materials.vc;
    const root = this.player && this.player.mesh;
    if (!shared || !root) return;
    const own = shared.clone();
    own.name = 'vc-skier';
    root.traverse((o) => {
      if (o.material === shared) o.material = own;
    });
  }

  _initEvents() {
    const hud = this.hud;
    hud.on('start', () => this.start());
    hud.on('restart', () => this.restart(true));
    hud.on('pause', () => this.pause());
    hud.on('resume', () => this.resume());
    hud.on('mute', (v) => this.setMuted(typeof v === 'boolean' ? v : !this.muted));

    const onResize = () => this._resize();
    window.addEventListener('resize', onResize);
    if (typeof ResizeObserver !== 'undefined') {
      try {
        new ResizeObserver(onResize).observe(this.container);
      } catch (e) {
        /* ignore */
      }
    }
    this._resize();

    const autoPause = () => {
      if (this.state === 'playing' && !this.useBot && !this.simulating) this.pause();
    };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) autoPause();
    });

    // 標題 / 結算畫面的 Enter/Space 由 HUD 處理並發出 start/restart
    // 自動駕駛模式下第一次互動再初始化音效
    const gesture = () => {
      if (this.state !== 'title') this._ensureAudio();
    };
    window.addEventListener('pointerdown', gesture);
    window.addEventListener('keydown', gesture);
  }

  _initQuality() {
    this.quality = {
      warm: R.qualityWarmup, // 開頭不量（shader 編譯、第一批 chunk 上傳）
      acc: 0, // 目前量測窗累積秒數 / 幀數
      n: 0,
      lowN: 0, // 連續低於 qualityLowFps 的窗數
      highT: 0, // 連續達標秒數（升級用）
      upHold: R.qualityUpHold,
      upFails: 0, // 升級後很快又撐不住的次數 → 達上限後鎖住不再升（防震盪）
      locked: false,
      lastUpAt: -1e9,
      lastFps: 0,
      emgN: 0, // 連續低於 qualityEmergencyFps 的窗數
      pendingPr: 0, // 滑行中決定、等安全時機才套用的 pixelRatio（0 = 無）
      pendingLowT: 0, // 記下降級之後又持續偏低的秒數（超過 qualityRideApplyAfter 就在滑行中套用）
      pendingFps: 0,
      deferred: 0,
      log: [], // [時間, pixelRatio, 觸發時 fps]（測試 / debug 用）
    };
  }

  _initDebug() {
    const el = document.createElement('div');
    el.id = 'debug-overlay';
    el.style.cssText =
      'position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:9999;pointer-events:none;' +
      'font:11px/1.35 ui-monospace,Consolas,Menlo,monospace;color:#0b2540;background:rgba(255,255,255,0.72);' +
      'padding:6px 9px;border-radius:6px;white-space:pre;';
    document.body.appendChild(el);
    this.debugEl = el;
    this.debugTimer = 0;
    this.debugFrames = 0;
    this.debugAcc = 0;
  }

  // ---------- 狀態控制 ----------
  _ensureAudio() {
    if (this.audioReady) return;
    try {
      this.audio.init();
      this.audio.setMuted(this.muted);
      this.audioReady = true;
    } catch (e) {
      console.warn('[main] audio init failed', e);
    }
  }

  _newRun(newSeed) {
    if (newSeed) {
      this.seed = this.fixedSeed !== null ? this.fixedSeed : randomSeed();
      this.terrain.reset(this.seed);
    }
    this.terrain.update(0, 0);
    this.player.reset(this.terrain.centerX(0), 0);
    this.bot.reset();
    this.effects.reset();
    this.chase.reset(this.player);
    this.input.setOverride(null);
    this.stats = freshStats();
    this.bonusScore = 0;
    this.combo = 0;
    this.score = 0;
    this.gameOverTimer = -1;
    this.accumulator = 0;
    this.airCur = 0;
    this.wasAir = false;
    this.fenceGap = 99;
    this.prevCrouch = false;
    this.minimapTimer = 0;
    this.needsReset = false;
    if (this.hud.clearPopups) this.hud.clearPopups();
  }

  start() {
    if (this.state === 'playing') return;
    if (this.state === 'paused') {
      this.resume();
      return;
    }
    this._ensureAudioIfGesture();
    if (this.needsReset || this.state === 'results') this._newRun(true);
    this._dropLatchedJump();
    this.player.start();
    this.state = 'playing';
    this.accumulator = 0;
    this.hud.setScreen('playing');
    if (this.audioReady) this._play('click');
  }

  _ensureAudioIfGesture() {
    // 自動駕駛模式的自動開始沒有使用者手勢；其他情況 start() 都由按鈕/按鍵觸發
    if (this.useBot && !navigator.userActivation?.isActive) return;
    this._ensureAudio();
  }

  restart(autoStart = true) {
    this._newRun(true);
    this.state = 'title';
    if (autoStart) {
      this.start();
    } else {
      this.hud.setScreen('title');
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.setScreen('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.accumulator = 0;
    this._dropLatchedJump();
    this.hud.setScreen('playing');
  }

  // 標題/暫停時按的 Space 不應在開局/恢復的第一步變成跳躍
  _dropLatchedJump() {
    if (!this.useBot && this.input.consumeJump) this.input.consumeJump();
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  setMuted(m) {
    this.muted = !!m;
    try {
      this.audio.setMuted(this.muted);
    } catch (e) {
      /* ignore */
    }
    this.hud.setMuted(this.muted);
    try {
      window.localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); // 記住靜音（?mute=1 仍優先）
    } catch (e) {
      /* storage 被擋時忽略 */
    }
  }

  setBot(on) {
    this.useBot = !!on;
    this.bot.reset();
    if (!this.useBot) this.input.setOverride(null);
  }

  _gameOver() {
    this.state = 'results';
    this.gameOverTimer = -1;
    const st = this.stats;
    const score = this.score;
    if (score > this.best) {
      this.best = score;
      saveBest(score);
    }
    this._play('gameover');
    this.hud.showResults({
      distance: st.distance,
      maxSpeedKmh: st.maxSpeed * 3.6,
      longestAir: st.longestAir,
      time: st.time,
      score,
      gates: st.gatesPassed,
      gatesTotal: st.gatesPassed + st.gatesMissed,
      best: this.best,
    });
    this.hud.setScreen('results');
    this.needsReset = true;
  }

  // ---------- 固定步長模擬 ----------
  _step(dt) {
    const player = this.player;
    const input = this.input;
    if (this.useBot) input.setOverride(this.bot.update(dt, player));
    input.update(dt);

    const prevZ = player.position.z;
    const events = player.update(dt, input);
    if (events && events.length) {
      for (let i = 0; i < events.length; i++) this._onEvent(events[i]);
    }

    const z = player.position.z;
    if (z < prevZ) {
      const gates = this.terrain.gatesCrossed(prevZ, z);
      if (gates && gates.length) {
        for (let i = 0; i < gates.length; i++) this._onGate(gates[i]);
      }
    }
    if (this.simulating) this.terrain.update(z, dt);

    // 統計
    const st = this.stats;
    const speed = player.speed;
    if (this.gameOverTimer < 0) {
      st.time += dt;
      st.speedSum += speed * dt;
    }
    if (-z > st.distance) st.distance = -z;
    if (speed > st.maxSpeed && player.state !== 'crashed') st.maxSpeed = speed;

    const inAir = player.state === 'air';
    if (inAir) {
      this.airCur = typeof player.airTime === 'number' ? player.airTime : this.airCur + dt;
    } else if (this.wasAir) {
      if (this.airCur > S.minRealAir && this.airCur > st.longestAir) st.longestAir = this.airCur;
      this.airCur = 0;
    }
    this.wasAir = inAir;

    this.fenceGap += dt;

    // boost 音效：蹲低起始且有 boost
    const crouch = !!input.crouch;
    if (crouch && !this.prevCrouch && player.boost > 0.05 && player.grounded) this._play('boost');
    this.prevCrouch = crouch;

    this.score = Math.floor(st.distance * S.pointsPerMeter) + this.bonusScore;

    if (this.gameOverTimer >= 0) {
      this.gameOverTimer -= dt;
      if (this.gameOverTimer <= 0 && !this.simulating) this._gameOver();
    }
  }

  _onEvent(ev) {
    const player = this.player;
    const st = this.stats;
    switch (ev.type) {
      case 'jump':
        this._play('jump');
        break;
      case 'takeoff':
        break;
      case 'land': {
        const air = ev.airTime || 0;
        const q = ev.quality === 'wobble' ? 'wobble' : 'clean';
        if (air > S.minRealAir) {
          st.landings[q]++;
          if (air > st.longestAir) st.longestAir = air;
        }
        this._play(q === 'wobble' || air > 1.3 ? 'landHard' : 'land');
        this._burst('land', player.position);
        this._shake(clamp(0.15 + air * 0.25, 0, 0.8) * (q === 'wobble' ? 1.4 : 1));
        if (air >= S.minAirForBonus && q === 'clean') {
          const bonus = Math.round(S.airBonusPerSec * air);
          this.bonusScore += bonus;
          this._popup(`大跳 ${air.toFixed(1)} 秒 +${bonus}`, 'good');
        }
        if (air >= S.landingPopupAir) {
          if (q === 'clean') this._popup('穩穩落地', 'good');
          else this._popup('落地不穩', 'bad');
        }
        break;
      }
      case 'crash': {
        st.crashes++;
        if (ev.reason === 'landing') st.landings.crash++;
        if (this.wasAir || player.state === 'air') {
          if (this.airCur > S.minRealAir && this.airCur > st.longestAir) st.longestAir = this.airCur;
        }
        this.combo = 0;
        this._play('crash');
        this._burst('crash', player.position);
        this._shake(1);
        const left = this.livesLeft;
        this._popup(left > 0 ? '摔倒！' : '出局！', 'bad');
        const endless = this.simulating && this.simEndless;
        if (left <= 0 && this.gameOverTimer < 0 && !endless) this.gameOverTimer = S.resultsDelay;
        break;
      }
      case 'recovered':
        break;
      case 'hit':
        st.hits++;
        this._play('hit');
        this._burst('hit', player.position);
        this._shake(0.6);
        break;
      case 'fence':
        if (this.fenceGap > S.fenceEventGap) {
          st.fenceHits++;
          this._play('fence');
          this._shake(0.25);
        }
        this.fenceGap = 0;
        break;
      default:
        break;
    }
  }

  _onGate(g) {
    const x = this.player.position.x;
    const st = this.stats;
    if (x >= g.xLeft && x <= g.xRight) {
      st.gatesPassed++;
      this.combo = Math.min(this.combo + 1, S.comboMax);
      const pts = S.gateBonus * this.combo;
      this.bonusScore += pts;
      if (this.player.addBoost) this.player.addBoost(config.player ? config.player.boostGate : 0.22);
      this._play('gate');
      // 金色菱形從兩根旗桿頂的金飾噴出、留在旗門原地（舊版在角色身上噴 → 跟著鏡頭、蓋住角色）
      if (!this.simulating) {
        for (const gx of [g.xLeft, g.xRight]) {
          _gatePos.set(gx, this.terrain.heightAt(gx, g.z) + 3.05, g.z);
          this._burst('gate', _gatePos);
        }
      }
      this._popup(`旗門 +${pts} ×${this.combo}`, 'good');
    } else {
      st.gatesMissed++;
      this.combo = 0;
      this._popup('漏掉旗門', 'bad');
    }
  }

  get livesLeft() {
    return Math.max(0, S.lives - this.stats.crashes);
  }

  // 模擬中（simulate）跳過所有表現層呼叫
  _play(name) {
    if (this.simulating || !this.audioReady) return;
    this.audio.play(name);
  }
  _burst(kind, pos) {
    if (this.simulating) return;
    this.effects.burst(kind, pos);
  }
  _shake(a) {
    if (this.simulating) return;
    this.chase.shake(a);
  }
  _popup(text, kind) {
    if (this.simulating) return;
    this.hud.popup(text, kind);
  }

  // ---------- 每幀 ----------
  _frame(now) {
    requestAnimationFrame(this._frame);
    const t = now / 1000;
    const rawDt = this.lastTime < 0 ? 1 / 60 : Math.max(0, t - this.lastTime);
    this.lastTime = t;
    const dt = Math.min(rawDt, SIM.maxFrameDt);
    try {
      this._tick(dt, rawDt);
    } catch (e) {
      if (!this.errorLogged) {
        this.errorLogged = true;
        console.error('[main] frame error (further errors suppressed):', e);
      }
    }
  }

  _tick(dt, rawDt) {
    this.clock += dt;
    this._updateQuality(rawDt);

    // 每幀檢查的按鍵 edge
    if (this.input.consumePause && this.input.consumePause()) {
      if (this.state === 'playing' || this.state === 'paused') this.togglePause();
    }
    if (this.input.consumeMute && this.input.consumeMute()) this.setMuted(!this.muted);

    const player = this.player;
    const state = this.state;

    if (state === 'paused') {
      if (this.audioReady) this.audio.update(dt, ZERO_AUDIO);
      this._render();
      this._updateDebug(rawDt);
      return;
    }

    if (state === 'playing') {
      const fdt = SIM.fixedDt;
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= fdt && steps < SIM.maxSubSteps) {
        this._step(fdt);
        this.accumulator -= fdt;
        steps++;
        if (this.state !== 'playing') break; // 進入結算
      }
      if (steps >= SIM.maxSubSteps) this.accumulator = 0;
    }

    // 標題畫面：玩家站在起點做待機動畫（ready 狀態不移動）
    if (this.state === 'title' && player.state === 'ready') player.update(dt, null);

    this.terrain.update(player.position.z, dt);

    if (this.state === 'playing') {
      this.chase.update(dt, player, this.terrain);
    } else {
      this._attractCamera(dt);
    }

    this.effects.update(dt, player, this.camera);

    if (this.audioReady) {
      if (this.state === 'playing') {
        const a = this.audioData;
        a.speed = player.speed;
        a.grounded = player.grounded;
        a.skid = player.skid || 0;
        a.crouch = player.crouch || 0;
        a.state = player.state;
        this.audio.update(dt, a);
      } else {
        this.audio.update(dt, ZERO_AUDIO);
      }
    }

    this._updateHud(dt);
    this._render();
    this._updateDebug(rawDt);
  }

  _attractCamera(dt) {
    // 標題 / 結算：在玩家後方緩慢左右擺盪的展示鏡頭
    const p = this.player.position;
    const cam = this.camera;
    const a = Math.sin(this.clock * S.attractSpeed * Math.PI * 2 * 0.5) * S.attractSway;
    const d = S.attractDistance;
    _v1.set(p.x + Math.sin(a) * d, 0, p.z + Math.cos(a) * d);
    const ground = this.terrain.heightAt(_v1.x, _v1.z);
    _v1.y = Math.max(p.y + S.attractHeight, ground + 1.2);
    const k = 1 - Math.exp(-3 * dt);
    if (cam.position.distanceToSquared(_v1) > 400) cam.position.copy(_v1);
    else cam.position.lerp(_v1, k);
    _lookAt.set(p.x - Math.sin(a) * S.attractLookAhead, p.y + S.attractLookHeight, p.z - Math.cos(a) * S.attractLookAhead);
    cam.lookAt(_lookAt);
    const fovBase = config.camera ? config.camera.fovBase : 62;
    if (Math.abs(cam.fov - fovBase) > 0.01) {
      cam.fov = damp(cam.fov, fovBase, 3, dt);
      cam.updateProjectionMatrix();
    }
  }

  _updateHud(dt) {
    const player = this.player;
    const st = this.stats;
    const h = this.hudData;
    h.time = st.time;
    h.score = this.score;
    h.speedKmh = player.speed * 3.6;
    h.boost = player.boost || 0;
    h.livesLeft = this.livesLeft;
    h.distance = st.distance;
    h.combo = this.combo;

    // 小地圖：路線 10 Hz 取樣（絕對座標），每幀轉成相對玩家
    this.minimapTimer -= dt;
    const px = player.position.x;
    const pz = player.position.z;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.1;
      this.minimapPathAbs = this.terrain.upcomingPath(pz, 520, 10) || [];
      this.minimapGatesAbs = this.terrain.upcomingGates(pz, 520) || [];
    }
    const mm = this.minimap;
    const pa = this.minimapPathAbs;
    const path = mm.path;
    path.length = pa.length;
    for (let i = 0; i < pa.length; i++) {
      let pt = path[i];
      if (!pt) pt = path[i] = [0, 0];
      pt[0] = pa[i][0] - px;
      pt[1] = pa[i][1] - pz;
    }
    const ga = this.minimapGatesAbs;
    const gates = mm.gates;
    gates.length = ga.length;
    for (let i = 0; i < ga.length; i++) {
      let g = gates[i];
      if (!g) g = gates[i] = { x: 0, z: 0 };
      g.x = (ga[i].xLeft + ga[i].xRight) * 0.5 - px;
      g.z = ga[i].z - pz;
    }
    mm.player.x = 0;
    mm.player.z = 0;
    mm.player.heading = player.heading;
    this.hud.update(h);
  }

  _updateLights() {
    // 方向光跟隨玩家（中心偏向前方），並貼齊 shadow map texel 避免閃爍
    const p = this.player.position;
    const h = this.player.heading || 0;
    const ahead = R.shadowRange * R.shadowAhead;
    _v1.set(p.x + Math.sin(h) * ahead, p.y, p.z - Math.cos(h) * ahead);
    const tx = this.shadowTexel;
    const lx = Math.round(_v1.dot(this.lightRight) / tx) * tx;
    const ly = Math.round(_v1.dot(this.lightUp) / tx) * tx;
    const lz = _v1.dot(this.sunDir);
    _v2.copy(this.lightRight).multiplyScalar(lx).addScaledVector(this.lightUp, ly).addScaledVector(this.sunDir, lz);
    this.sun.target.position.copy(_v2);
    this.sun.position.copy(_v2).addScaledVector(this.sunDir, R.shadowLightDistance);
    this.sun.target.updateMatrixWorld();
  }

  _render() {
    this._updateLights();
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.devicePR = window.devicePixelRatio || 1;
    const pr = this.params.pr || Math.min(this.qualityPR, this._capPR(w, h));
    if (w === this._w && h === this._h && pr === this.pixelRatio) return;
    this._w = w;
    this._h = h;
    this.pixelRatio = pr;
    // 一次設定尺寸 + pixelRatio（setPixelRatio + setSize 會改兩次畫布大小；改畫布大小在部分 GPU 上會卡）
    this.renderer.setDrawingBufferSize(w, h, pr);
    this.camera.aspect = w / Math.max(1, h);
    // 直式螢幕：放寬垂直視角，避免角色塞滿畫面、看不到前方
    this.camera.zoom = clamp(this.camera.aspect / R.portraitZoomAspect, R.portraitZoomMin, 1);
    this.camera.updateProjectionMatrix();
  }

  _setPixelRatio(pr) {
    this.qualityPR = pr;
    this._resize();
  }

  // 自動畫質：每 qualityWindow 秒算一次平均 fps（只在標題與滑行中量；暫停 / 結算畫面的負載不代表遊戲）。
  // 降：連續 qualityDownWindows 個窗低於 qualityLowFps（單一個窗的暫態掉幀——shader 編譯、第一次改尺寸、
  //     背景程式搶資源——不算）→ 假設成本 ∝ 像素數 ∝ pr²，往預估能達標的 pr 降，但一步最多降到 × qualityMinScale。
  // 升：連續 upHold 秒達標才小步回升（標題畫面只要 qualityTitleUpHold 秒，且一步回到上限：
  //     標題畫的就是同一個場景，開機暫態掉幀後可以在玩家按開始前就恢復）；
  //     升上去 qualityUpFailWindow 秒內又降 → upHold 加倍，累積 qualityMaxUpFails 次就鎖住不再升（防震盪）。
  // 套用時機：改畫布尺寸在 iGPU 上會卡 0.2～1.8 s → 滑行中只「記下」，等安全時機才改：
  //     非滑行（標題 / 暫停 / 結算）或摔倒翻滾中（升、降都可以）；
  //     滑行中：連續 qualityEmergencyWindows 個窗 < qualityEmergencyFps，或記下的降級之後仍持續偏低
  //     qualityRideApplyAfter 秒（卡一下總比整局 45 fps 好）→ 立刻降。
  _updateQuality(rawDt) {
    const q = this.quality;
    if (this.params.pr) return; // 固定 pixelRatio（除錯）
    if (rawDt <= 0 || rawDt > 0.25 || document.hidden) return; // 切分頁、改尺寸卡住等異常幀不列入
    const riding = this.state === 'playing';
    const title = this.state === 'title';
    if (q.pendingPr > 0) {
      const safe = !riding || this.player.state === 'crashed';
      if (safe) {
        const pr = q.pendingPr;
        q.pendingPr = 0;
        this._applyQuality(pr, q.pendingFps);
        return;
      }
    }
    if (!riding && !title) {
      q.acc = 0;
      q.n = 0;
      return;
    }
    if (q.warm > 0) {
      q.warm -= rawDt;
      return;
    }
    q.acc += rawDt;
    q.n++;
    if (q.acc < R.qualityWindow) return;
    const fps = q.n / q.acc;
    q.acc = 0;
    q.n = 0;
    q.lastFps = fps;
    const cap = this._capPR(this._w || 1, this._h || 1);
    q.emgN = fps < R.qualityEmergencyFps ? q.emgN + 1 : 0;
    if (fps < R.qualityLowFps) {
      q.highT = 0;
      q.lowN++;
      const pendingDown = q.pendingPr > 0 && q.pendingPr < this.pixelRatio;
      if (pendingDown) q.pendingLowT += R.qualityWindow;
      if (q.lowN >= R.qualityDownWindows && this.pixelRatio > R.minPixelRatio + 1e-3) {
        const k = clamp(Math.sqrt(fps / R.qualityTargetFps) * R.qualityMargin, R.qualityMinScale, R.qualityMaxScale);
        const pr = Math.max(R.minPixelRatio, Math.floor((this.pixelRatio * k) / 0.05) * 0.05);
        const emergency = q.emgN >= R.qualityEmergencyWindows;
        const sustained = pendingDown && q.pendingLowT >= R.qualityRideApplyAfter;
        if (!riding || emergency || sustained) {
          const target = pendingDown ? Math.min(pr, q.pendingPr) : pr;
          q.pendingPr = 0;
          this._applyQuality(target, fps);
        } else if (!pendingDown || pr < q.pendingPr) {
          // 延後：取較低值（記下的升級直接取消）
          if (!pendingDown) q.pendingLowT = 0;
          q.pendingPr = pr;
          q.pendingFps = fps;
          q.deferred++;
        }
      }
    } else {
      q.lowN = 0;
      if (fps >= R.qualityHighFps) {
        // 記下的降級：之後已經回到達標 → 取消（短暫搶資源）
        if (q.pendingPr > 0 && q.pendingPr < this.pixelRatio) q.pendingPr = 0;
        if (!q.locked && this.pixelRatio < cap - 1e-3 && !(q.pendingPr > 0)) {
          q.highT += R.qualityWindow;
          const hold = title ? Math.min(q.upHold, R.qualityTitleUpHold) : q.upHold;
          if (q.highT >= hold) {
            q.highT = 0;
            const pr = title ? cap : Math.min(cap, this.pixelRatio + R.qualityUpStep);
            if (riding) {
              q.pendingPr = pr;
              q.pendingFps = fps;
              q.deferred++;
            } else {
              this._applyQuality(pr, fps);
            }
          }
        }
      } else {
        q.highT = 0;
      }
    }
  }

  _applyQuality(pr, fps) {
    const q = this.quality;
    if (pr < this.pixelRatio - 1e-3) {
      // 升級後沒多久又降 → 升級失敗
      if (this.clock - q.lastUpAt < R.qualityUpFailWindow) {
        q.upFails++;
        q.upHold *= 2;
        if (q.upFails >= R.qualityMaxUpFails) q.locked = true;
      }
    } else {
      q.lastUpAt = this.clock;
    }
    this._setPixelRatio(pr);
    q.log.push([+this.clock.toFixed(2), +this.pixelRatio.toFixed(3), +(fps || 0).toFixed(1), this.state]);
    q.warm = R.qualityChangeWarmup; // 改畫布大小那幾幀不算
    q.acc = 0;
    q.n = 0;
    q.lowN = 0;
    q.emgN = 0;
    q.pendingLowT = 0;
    q.highT = 0;
  }

  _updateDebug(rawDt) {
    if (!this.debugEl) return;
    this.debugFrames++;
    this.debugAcc += rawDt;
    this.debugTimer -= rawDt;
    if (this.debugTimer > 0) return;
    this.debugTimer = 0.25;
    const fps = this.debugAcc > 0 ? this.debugFrames / this.debugAcc : 0;
    const ms = this.debugFrames > 0 ? (this.debugAcc / this.debugFrames) * 1000 : 0;
    this.debugFrames = 0;
    this.debugAcc = 0;
    const info = this.renderer.info.render;
    const p = this.player;
    this.debugEl.textContent =
      `fps ${fps.toFixed(0)}  ${ms.toFixed(1)} ms\n` +
      `calls ${info.calls}  tris ${info.triangles}\n` +
      `pixelRatio ${this.pixelRatio.toFixed(2)}  ${this.renderer.domElement.width}x${this.renderer.domElement.height}  AA ${this.antialias ? 'on' : 'off'}  seed ${this.seed}\n` +
      `state ${this.state}/${p.state}  bot ${this.useBot ? 'on' : 'off'}\n` +
      `speed ${(p.speed * 3.6).toFixed(1)} km/h  dist ${this.stats.distance.toFixed(0)} m`;
  }

  // ---------- 測試 API ----------
  getStats() {
    const st = this.stats;
    return {
      distance: st.distance,
      maxSpeedKmh: st.maxSpeed * 3.6,
      longestAir: st.longestAir,
      crashes: st.crashes,
      gatesPassed: st.gatesPassed,
      gatesMissed: st.gatesMissed,
      hits: st.hits,
      fenceHits: st.fenceHits,
      avgSpeedKmh: st.time > 0 ? (st.speedSum / st.time) * 3.6 : 0,
      time: st.time,
      landings: { ...st.landings },
      score: this.score,
      combo: this.combo,
      lives: this.livesLeft,
      state: this.state,
      playerState: this.player.state,
      seed: this.seed,
    };
  }

  // 不渲染，以固定步長用 bot 跑物理。預設從新局開始、不受 3 條命限制。
  simulate(seconds, dt, opts = {}) {
    const step = dt > 0 ? dt : SIM.fixedDt;
    const fresh = opts.fresh !== false;
    const endless = opts.endless !== false;
    const prevBot = this.useBot;
    if (fresh || this.state !== 'playing') {
      this._newRun(this.state !== 'title' || this.needsReset);
      this.player.start();
    }
    this.useBot = true;
    this.bot.reset();
    this.simulating = true;
    this.simEndless = endless;
    this.state = 'playing';
    const n = Math.max(0, Math.round(seconds / step));
    let ended = false;
    try {
      for (let i = 0; i < n; i++) {
        this._step(step);
        if (!endless && this.livesLeft <= 0 && this.gameOverTimer <= 0) {
          ended = true;
          break;
        }
      }
    } finally {
      this.simulating = false;
      this.useBot = prevBot;
      if (!prevBot) this.input.setOverride(null);
    }
    this.gameOverTimer = -1;
    this.accumulator = 0;
    this.terrain.update(this.player.position.z, 0);
    this.chase.reset(this.player);
    this.effects.reset();
    if (ended) {
      this._gameOver();
    } else if (!prevBot) {
      this.state = 'paused';
      this.hud.setScreen('paused');
    } else {
      this.hud.setScreen('playing');
    }
    const s = this.getStats();
    s.ended = ended;
    return s;
  }
}

// ---------- 啟動 ----------
function showFatal(err) {
  console.error('[main] fatal', err);
  try {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:auto 16px 16px 16px;z-index:10000;padding:10px 14px;border-radius:8px;' +
      'background:#fff3f0;color:#7a1600;font:13px/1.4 system-ui,sans-serif;';
    el.textContent = '雪峰滑降無法啟動：' + (err && err.message ? err.message : String(err));
    document.body.appendChild(el);
  } catch (e) {
    /* ignore */
  }
}

function boot() {
  let game;
  try {
    game = new Game(readParams());
  } catch (e) {
    showFatal(e);
    return;
  }
  const api = {
    get state() {
      return game.state;
    },
    config,
    get player() {
      return game.player;
    },
    get terrain() {
      return game.terrain;
    },
    game,
    start: () => game.start(),
    restart: () => game.restart(true),
    pause: () => game.pause(),
    resume: () => game.resume(),
    setBot: (on) => game.setBot(on),
    simulate: (seconds, dt, opts) => game.simulate(seconds, dt, opts),
    stats: () => game.getStats(),
    rendererInfo: () => {
      const info = game.renderer.info;
      return {
        calls: info.render.calls,
        triangles: info.render.triangles,
        points: info.render.points,
        lines: info.render.lines,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs ? info.programs.length : 0,
        pixelRatio: game.pixelRatio,
        antialias: game.antialias,
        buffer: [game.renderer.domElement.width, game.renderer.domElement.height],
        qualityLog: game.quality.log.slice(),
        qualityLocked: game.quality.locked,
        qualityPending: game.quality.pendingPr,
        qualityDeferred: game.quality.deferred,
        qualityLastFps: game.quality.lastFps,
      };
    },
    triangleReport: () => game.assets.triangleReport(),
  };
  window.__game = api;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
