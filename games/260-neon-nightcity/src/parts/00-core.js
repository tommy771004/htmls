// ═══ 霓虹夜城：雨夜城市、車、人、酒吧與夜店 ═══
// src/parts/*.js 依檔名順序串成同一個模組再打包（tools/build.mjs），彼此共用頂層變數。
const $ = id => document.getElementById(id);
const bootMsg = t => { $('bootMsg').textContent = t; };
// 開始畫面的進度 0–100：「進入雨夜」按鈕本身就是進度條（--p 是填滿的寬度）。每個階段讓出一幀，畫面才看得到數字前進
function bootProgress(p, msg) {
  p = bootProgress.p = Math.max(bootProgress.p || 0, Math.min(100, p));
  const go = $('go'), n = Math.floor(p);
  go.style.setProperty('--p', p.toFixed(1) + '%');
  go.setAttribute('aria-valuenow', n);
  go.dataset.label = go.textContent = `載入中 ${n}%`;
  if (msg) bootMsg(msg);
}
// 各階段開始時的百分比（依桌機實測的耗時分配）；最後一段留給下載座駕與機車的實車模型
const BOOT = { city: 4, props: 8, vehicles: 14, people: 29, assets: 40, venues: 46, render: 60, dl: 60 };
let bootT = 0;
const bootStep = (p, msg) => { bootProgress(p, msg); return new Promise(r => { const go = () => { bootT = performance.now(); r(); }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 80); }); };
// 一個階段裡的長段落（2x 的 part 開頭、20-relief 的迴圈）：進度與文字照更新，距上次讓出超過 120 ms 才讓一幀。
// 不讓的話「擺放街道與招牌」一整段是好幾秒的單一長任務，畫面停住、像當掉
const bootTick = (p, msg) => { bootProgress(p, msg); return performance.now() - bootT > 120 ? bootStep(p) : null; };
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WebGPURenderer } from 'three/webgpu';

const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW = isTouch || Math.min(screen.width, screen.height) < 600;

// 繪圖後端：WebGPURenderer（02-gfx.js：材質都是 src/tsl/ 的 TSL），瀏覽器沒有 WebGPU 時它自己退回 WebGL2 後端（GFX 是 'webgpu-gl'；?gfx=webgpu-gl 強制走那個後端）
let GFX = (() => { const g = new URLSearchParams(location.search).get('gfx'); return g === 'webgpu-gl' || !navigator.gpu ? 'webgpu-gl' : 'webgpu'; })();
let R;
try { R = new WebGPURenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, forceWebGL: GFX === 'webgpu-gl' }); await R.init(); }
catch (e) {
  // WebGPU 的 adapter 要不到（被封鎖、驅動不支援）：再試一次 WebGL2 後端
  R?.dispose?.(); R = null;
  if (GFX === 'webgpu') {
    console.warn('WebGPU 啟用失敗，改用 WebGL2 後端', e); GFX = 'webgpu-gl';
    try { R = new WebGPURenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, forceWebGL: true }); await R.init(); } catch (e2) { R?.dispose?.(); R = null; e = e2; }
  }
  if (!R) { bootMsg('這個瀏覽器無法啟用 WebGPU 或 WebGL2。'); throw e; }
}
// WebGPURenderer 沒有的 WebGL 介面：各 part 只用到這幾個（MSAA 上限、貼圖尺寸、非等向過濾、浮點渲染目標的擴充）
{
  const lim = R.backend.device?.limits;
  R.capabilities = { maxSamples: 4, maxTextureSize: lim ? lim.maxTextureDimension2D : 8192, getMaxAnisotropy: () => R.getMaxAnisotropy() };
  R.extensions = { has: () => true };
}
R.outputColorSpace = T.LinearSRGBColorSpace; // 後製最後一步自己做色調映射與 gamma
R.toneMapping = T.NoToneMapping;
R.autoClear = false;
$('stage').appendChild(R.domElement);
R.domElement.setAttribute('aria-label', '霓虹夜城遊戲畫面');
R.domElement.tabIndex = 0;

// ─── 顯示卡分級：WebGL 只回報 GPU 名稱與 ANGLE 的繪圖後端，碰不到驅動程式，所以照名稱給起始畫質 ───
// dpr 解析度上限；msaa、refl、dist、fps 是 01-settings.js 的預設值（玩家改過的照玩家的）；
// rf 倒影的遠平面倍率（70-render.js 的 reflFar，0 是不縮）；vol 體積光每個像素沿視線的步數（70-render.js 的 mVol，0 是不畫）；tex 照片材質（08-tex.js：0 不下載、1 只有底色、2 加法線與粗糙度）；nl 燈數、sh 日光陰影步數、occ 地上陰影的車人數是 shader 常數，開場定下，選單換等級要重新整理才生效。
// ss 自動解析度往上最多到幾倍、px 內部像素數上限（70-render.js 的 resMax：顯示卡有餘裕時超過 100% 當超取樣抗鋸齒）。
// 原本的桌機設定就是 high，觸控與小螢幕（LOW）原本的設定就是 low；ultra 不會自動選到，要在選單或網址 ?gpu=ultra 指定
const GPU_TIERS = {
  soft: { name: '軟體繪圖', dpr: 1, msaa: 0, refl: 0, dist: .7, fps: 30, nl: 8, sh: 10, occ: 6, rf: .6, vol: 0, tex: 0, fd: 0, ao: 0 },
  low: { name: '低', dpr: 1.25, msaa: 0, refl: 1, dist: .8, fps: 60, nl: 8, sh: 16, occ: 6, rf: .8, vol: 0, tex: 1, fd: 70, ao: 0 },
  mid: { name: '中', dpr: 1.25, msaa: 2, refl: 1, dist: .9, fps: 60, nl: 12, sh: 20, occ: 12, rf: 1, vol: 10, tex: 2, fd: 110, ao: 1 },
  high: { name: '高', dpr: 1.5, msaa: 4, refl: 2, dist: 1, fps: 0, nl: 16, sh: 26, occ: 12, rf: 0, vol: 14, tex: 2, fd: 150, ao: 1, ss: 1.25, px: 4.2e6 },
  ultra: { name: '極高', dpr: 2, msaa: 4, refl: 2, dist: 1.2, fps: 0, nl: 16, sh: 32, occ: 12, rf: 0, vol: 20, tex: 2, fd: 210, ao: 1, ss: 1.5, px: 8.3e6 },
};
const GPU = (() => {
  // WebGPU 的 adapter.info 沒有型號（Apple 只給 metal-3），名稱照舊向一個臨時的 WebGL2 context 要
  const gl = document.createElement('canvas').getContext('webgl2'); let name = '';
  try { const x = gl.getExtension('WEBGL_debug_renderer_info'); name = String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) { /* 有些瀏覽器不給名稱 */ }
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  // 沒有硬體加速（遠端桌面、驅動被瀏覽器列入黑名單）時，要求 failIfMajorPerformanceCaveat 的 context 會被拒絕
  let caveat = false;
  try { const c = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true }); caveat = !c; c?.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) { /* 當成有硬體加速 */ }
  const n = name.toLowerCase();
  let auto = caveat || /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/.test(n) ? 'soft'
    : /apple m\d+ (pro|max|ultra)|geforce (rtx|gtx (9[6-9]0|1[0-9]))|nvidia (rtx|quadro|tesla|a\d)|radeon (rx|pro|r9)|arc\(tm\) a|\barc a\d/.test(n) ? 'high'
    : /apple m\d|apple gpu|geforce|nvidia|radeon|\bamd\b|iris\(r\) xe|iris xe|arc|adreno.{0,8}7\d\d|mali-g7\d/.test(n) ? 'mid'
    : /intel|mali|adreno|powervr|apple a\d|uhd|hd graphics/.test(n) ? 'low'
    : 'mid';
  if (LOW && auto !== 'soft') auto = 'low';   // 手機與平板會降頻，維持原本觸控裝置的設定
  // ANGLE 字串裡的繪圖後端：Mac 是 Metal、Windows 是 Direct3D 11、Linux 多半是 OpenGL 或 Vulkan；Firefox 與 Safari 只給大概的名稱
  const api = /metal/i.test(name) ? 'Metal' : /direct3d|d3d11/i.test(name) ? 'Direct3D 11' : /vulkan/i.test(name) ? 'Vulkan' : /opengl/i.test(name) ? 'OpenGL' : '';
  const vendor = /apple/.test(n) ? 'Apple' : /nvidia|geforce|quadro/.test(n) ? 'NVIDIA' : /amd|radeon|ati /.test(n) ? 'AMD' : /intel/.test(n) ? 'Intel' : /swiftshader|llvmpipe|software/.test(n) ? '軟體' : /adreno|qualcomm/.test(n) ? 'Qualcomm' : /mali|arm/.test(n) ? 'ARM' : '';
  // 面板上只留型號：ANGLE (廠商, 型號 + 後端細節, 後端) → 型號
  const short = (name.match(/^ANGLE \([^,]*, (.*?)(?:, [^,]*)?\)$/)?.[1] || name).replace(/^ANGLE \w+ Renderer: /, '').replace(/ \(0x[0-9a-f]+\)| Direct3D.*| vs_\d.*/gi, '').trim();
  // 半浮點渲染目標（泛光與曝光要超過 1 的亮度）：WebGL2 要 EXT_color_buffer_float 或 _half_float，沒有就退回 8 位元（70-render.js）
  const hdr = R.extensions.has('EXT_color_buffer_float') || R.extensions.has('EXT_color_buffer_half_float');
  // 等級：網址 ?gpu=soft|low|mid|high|ultra（驗收工具固定用 high）＞ 選單（01-settings.js 的 SET.gpu）＞ 自動
  const qs = new URLSearchParams(location.search), q = qs.get('gpu');
  let pick = null; try { pick = JSON.parse(localStorage.getItem('nc260.settings') || 'null')?.gpu; } catch (e) { /* 沒存過 */ }
  const tier = GPU_TIERS[q] ? q : GPU_TIERS[pick] ? pick : auto;
  return { name: name || '未知', short: short || '未知', vendor, api, auto, tier, boot: tier, url: !!GPU_TIERS[q], gfx: GFX, hdr: qs.get('hdr') === '0' ? false : hdr, lost: 0 };
})();
const GT = () => GPU_TIERS[GPU.tier];
// 驅動重置（Windows 的 TDR、Mac 切換內顯與獨顯、分頁在背景太久）：three 會擋下預設行為並在恢復時重建狀態，
// 70-render.js 補上提示與重建渲染目標（材質與貼圖由 three 重新上傳）

// ─── 小工具 ───
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function rng(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const C3 = h => new T.Color(h);
// vec4 陣列 uniform 存成平的 Float32Array：three 每換一個材質就重傳整個陣列，Vector4 陣列每次都要先攤平（flatten）再傳
const V4A = (n, x = 0, y = 0, z = 0, w = 0) => { const a = new Float32Array(n * 4); for (let i = 0; i < a.length; i += 4) { a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = w; } return a; };
const v4set = (a, k, x, y, z, w) => { k *= 4; a[k] = x; a[k + 1] = y; a[k + 2] = z; a[k + 3] = w; };

// ─── 城市格線 ───
// 南北向的大道沿 z，東西向的街沿 x；道路中心線在 avX(i)、stZ(j)。
const P = 72, Q = 62, HR = 8, SW = 4.5;     // 大道間距、街距、半路寬、人行道寬
const NX = 20, NZ = 15;
const X0 = -180, Z0 = -155;                 // 原本 5×5 的城市不動，新區往東、往南長（8×7 是 World 第一輪，20×15 是第二輪）
const avX = i => X0 + i * P, stZ = j => Z0 + j * Q;
const AVE = ['Harbor Av', 'Atlas Av', 'Bishop Av', 'Cinder Av', 'Delmar Av', 'Foundry Av', 'Granite Av', 'Hollis Av', 'Ironside Av', 'Juniper Av', 'Keystone Av',
  'Lantern Av', 'Marlow Av', 'Northgate Av', 'Orchard Av', 'Paragon Av', 'Quarry Av', 'Ridgeway Av', 'Seabright Av', 'Tidewater Av', 'Union Av'];
const STR = Array.from({ length: NZ + 1 }, (_, j) => `${j + 6} St`);
const LANE = 3.0, PARK = 6.6;               // 車道與停車格中心離路中心的距離

// ─── 共用 uniform ───
const NL = GT().nl;
const LAMP_C = 16, LAMP_K = 16;   // 路燈表的格子邊長（公尺）與每格最多幾盞
const U = {
  uTime: { value: 0 }, uLampOn: { value: 1 }, uFlash: { value: 0 }, uClipY: { value: -1e9 }, uWet: { value: 1 },
  uCam: { value: V3() }, uFogCol: { value: C3(0x1a1d26) }, uFogHi: { value: C3(0x3a2a3a) }, uFogDen: { value: .016 }, uCullR: { value: 380 },
  uLP: { value: V4A(NL, 0, -999, 0, 0) }, uLC: { value: V4A(NL) }, uLD: { value: V4A(NL, 0, -1, 0, -2) },   // 點光：位置與半徑、顏色、聚光方向與 cos（V4A 平的陣列，用 v4set 寫）
  uAmbTop: { value: C3(0x1d2230) }, uAmbBot: { value: C3(0x241a16) },
  uCity: { value: new T.Vector4(X0, Z0, P, Q) }, uGrid: { value: new T.Vector2(NX, NZ) },
  // 路燈表（20-props.js 的 lampTable）：世界座標切成 LAMP_C 公尺的格子，每格列出光照範圍蓋到這格的路燈（x, z, 種類, 有沒有）；
  // uLampG = (西北角 x, z, 格數 x, 格數 z)。uZone 是相機所在區的 (ox, oz, cos, sin)，相機附近的水花用它判斷人行道
  uLampT: { value: null }, uLampG: { value: new T.Vector4(0, 0, 0, 0) }, uZone: { value: new T.Vector4(0, 0, 1, 0) },
  uBeat: { value: 0 }, uRain: { value: .7 }, uLit: { value: .34 }, uLamp: { value: 1 },
  uFocus: { value: new T.Vector4() },   // xyz 角色頭部，w=1 時淡出擋在相機前的東西
  // 日夜與天氣（28-sky.js 每幀更新）：uDay 是天空與環境反射的白天比例，uSunCol 是雲遮過後的日光（夜裡與室內是 0）
  uDay: { value: 0 }, uCloud: { value: .9 }, uSun: { value: V3(0, -1, 0) }, uSunCol: { value: V3() },
  uSkyTop: { value: V3() }, uSkyHor: { value: V3() }, uMoon: { value: V3(0, -1, 0) },
  // 建築高度圖（28-sky.js）：xy 是西北角的世界座標，z 是 1/邊長，w 是最高的屋頂；日光朝太陽方向在圖上步進求陰影
  uHMap: { value: null }, uHM: { value: new T.Vector4(0, 0, 1, 0) }, uCityM: { value: null },
  // 樹冠圖（22-hmap.js）：rg 是樹冠的頂與底（0 是沒有樹），uTM 和 uHM 一樣是西北角、1/邊長；日光穿過樹冠時照葉子的疏密打成碎光
  uTMap: { value: null }, uTM: { value: new T.Vector4(0, 0, 1, 0) },
  // 外緣山林的樹冠圖（22-hmap.js，跟著鏡頭的 1 km 見方，鏡頭走遠才重畫）：rg 是樹冠的頂與底（世界高度），uFM 是西北角、1/邊長、w 1 = 有圖
  uFMap: { value: null }, uFM: { value: new T.Vector4(0, 0, 1, 0) },
  // 清晨的光（28-sky.js 每幀，室內是 0）：x 天空可見度（街谷遮蔽）的強度、y 日光反彈、z 貼地薄霧的濃度、w 霧裡日光前向散射的強度
  uGI: { value: new T.Vector4() },
  // 程式立面與斜屋頂的照片材質（08-tex.js 下載好才有）：A 是底色、N 是法線 xy＋粗糙度的 texture2D 陣列；uFac.x 1 = 有底色、y 1 = 有法線
  uFacA: { value: null }, uFacN: { value: null }, uFac: { value: new T.Vector4() },
  uVilA: { value: null }, uVilN: { value: null }, uVil: { value: new T.Vector4() },   // 山坡別墅區的照片材質（同上，08-tex.js 的 VIL_LAYERS）
  // 外海的機場島（21-air.js）：A = (中心 x, z, 長軸 cos, sin)、B = (半長, 半寬)；B.x = 0 時沒有
  uAirA: { value: new T.Vector4(0, 0, 1, 0) }, uAirB: { value: new T.Vector4() },
  // 車與行人在地上的陰影：每個 A = (x, z, cos, sin)、B = (半長, 半寬, 高, 0)
  uOccA: { value: V4A(GT().occ, 0, 0, 1, 0) }, uOccB: { value: V4A(GT().occ) },
  uWetDbg: { value: 0 },   // 地面濕的三層換成顏色（10-city.js 的 wetSurfaceR；tools/look-view.mjs 量比例用）
};
const NOCC = GT().occ, SH_N = GT().sh;   // 地上陰影的車人數、日光陰影的步數
// 依畫質等級的常數：src/tsl/ 的著色器照名字（NL_T…）讀，執行期從這裡（02-gfx.js 的 E）拿值，不寫死某一級的數字
const GL_TIER = { NL_T: NL, NOCC_T: NOCC, SH_N_T: SH_N, VOL_N_T: GT().vol };
const shared = keys => { const o = {}; for (const k of keys) o[k] = U[k]; return o; };
const ALLU = Object.keys(U);

// 共用的雜湊、燈光、霧、環境反射在 src/tsl/lib.mjs（原本的 GL_LIB）

// 通用材質：頂點色當底色，aMat 決定粗糙度、金屬與自發光

function mkUber(o = {}) {
  const defines = {};
  if (o.inst) defines.INST_EXTRA = '';
  if (o.double) defines.DOUBLE = '';
  if (o.far) defines.FAR = o.far.toFixed(3);
  if (o.fard) defines.FARD = o.fard.toFixed(1);
  if (o.farc) defines.FARC = '';
  return new T.ShaderMaterial({ name: 'uber',
    uniforms: { ...shared(ALLU), uM: { value: new T.Vector4(0, 0, o.emi ?? 1, 0) } },
    defines,
    side: o.double ? T.DoubleSide : T.FrontSide });
}
const MAT = { uber: mkUber(), uberI: mkUber({ inst: true }), uberD: mkUber({ double: true }), far: mkUber({ far: .2 }), far2: mkUber({ far: .09 }), ridge: mkUber({ far: .2, fard: 150 }) };

// ─── 幾何組合：把多個零件合併成一個帶頂點色與 aMat 的幾何 ───
const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = V3(), _s = V3();
function tf(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new T.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
}
const KIT_BOX = (() => { const g = new T.BoxGeometry(1, 1, 1).toNonIndexed(); return { p: Float32Array.from(g.attributes.position.array), n: Float32Array.from(g.attributes.normal.array) }; })();
// 倒角方塊的樣板（玩具感的來源之一是每個方塊的稜都是銳利的直角）：每個頂點在軸上是 A × (尺寸/2 − C × b)，
// A 是 ±1 的角落方向、C 是這一軸要不要往裡收倒角寬 b；面是 6 片收進去的正面、12 條 45° 的倒角邊、8 個角的小三角（132 個頂點，直角方塊是 36）
const KIT_BEV = (() => {
  const A = [], C = [], N = [], ref = (a, c) => a.map((x, i) => x * (1 - c[i] * .3));
  const tri = (v, n) => {
    const [p, q, r] = v.map(([a, c]) => ref(a, c)), u = q.map((x, i) => x - p[i]), w = r.map((x, i) => x - p[i]);
    const cx = u[1] * w[2] - u[2] * w[1], cy = u[2] * w[0] - u[0] * w[2], cz = u[0] * w[1] - u[1] * w[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) v = [v[0], v[2], v[1]];
    for (const [a, c] of v) { A.push(...a); C.push(...c); N.push(...n); }
  };
  const quad = (v, n) => { tri([v[0], v[1], v[2]], n); tri([v[0], v[2], v[3]], n); };
  const ax = (i, val, arr) => { const o = arr.slice(); o[i] = val; return o; };
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {   // 正面
    const j = (i + 1) % 3, k = (i + 2) % 3, v = [];
    for (const [aj, ak] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const a = [0, 0, 0], c = [1, 1, 1]; a[i] = s; a[j] = aj; a[k] = ak; c[i] = 0; v.push([a, c]); }
    quad(v, ax(i, s, [0, 0, 0]));
  }
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) for (const si of [-1, 1]) for (const sj of [-1, 1]) {   // 倒角邊
    const k = 3 - i - j, v = [], n = [0, 0, 0]; n[i] = si * Math.SQRT1_2; n[j] = sj * Math.SQRT1_2;
    for (const [ci, ak] of [[0, -1], [1, -1], [1, 1], [0, 1]]) { const a = [0, 0, 0], c = [1, 1, 1]; a[i] = si; a[j] = sj; a[k] = ak; c[i] = ci; c[j] = 1 - ci; v.push([a, c]); }
    quad(v, n);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {   // 角
    const a = [sx, sy, sz], r = 1 / Math.sqrt(3);
    tri([[a, [0, 1, 1]], [a, [1, 0, 1]], [a, [1, 1, 0]]], [sx * r, sy * r, sz * r]);
  }
  return { A: Float32Array.from(A), C: Float32Array.from(C), N: Float32Array.from(N), n: A.length / 3 };
})();
// 自動倒角的方塊：最短邊 ≥ KIT_BEV_MIN、最長邊 ≤ KIT_BEV_MAX（橋面、路面、長牆這種拼起來的大板不倒，接縫才不會變成一道道溝）；
// 倒角寬照最短邊的 10%，1.2–3.5 cm。new Kit(true) 是全部直角（要拼成平整表面的零件）。KIT_N 記數量（__nc.kit）
const KIT_BEV_MIN = .18, KIT_BEV_MAX = 6, KIT_N = { box: 0, bev: 0 };
class Kit {
  constructor(sharp = false) { this.pos = []; this.nor = []; this.col = []; this.mat = []; this.ext = {}; this.parts = []; this.sharp = sharp; }
  add(geo, color, mat, matrix, ext) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    this.parts.push(this.pos.length / 3);   // 每個零件的第一個頂點：cityAdd 依零件所在的片換到世界座標（零件不會被切開）
    if (matrix) g.applyMatrix4(matrix);
    const p = g.attributes.position.array, n = g.attributes.normal.array, vc = geo.userData.ao ? g.attributes.color : null;   // vc：模型烘好的頂點色（hill_homes.glb 的 AO；userData.ao 標記），乘在底色上
    const c = color instanceof T.Color ? color : lin(color);
    for (let i = 0; i < p.length; i += 3) {
      this.pos.push(p[i], p[i + 1], p[i + 2]); this.nor.push(n[i], n[i + 1], n[i + 2]);
      if (vc) { const v = i / 3; this.col.push(c.r * vc.getX(v), c.g * vc.getY(v), c.b * vc.getZ(v)); } else this.col.push(c.r, c.g, c.b);
      this.mat.push(mat);
      if (ext) for (const k in ext) (this.ext[k] ||= []).push(...ext[k]);
    }
    if (g !== geo) g.dispose();
    return this;
  }
  // 方塊：單位方塊的樣板（BoxGeometry 轉 non-indexed，頂點順序一樣）乘尺寸再套旋轉與位移，不用每塊都建一個 BoxGeometry
  // （開場幾十萬塊，建幾何、轉 non-indexed、applyMatrix4 加起來上千毫秒）。尺寸只縮放、不改軸向，法線只要轉
  box(x, y, z, sx, sy, sz, color, mat = 2, rx = 0, ry = 0, rz = 0, ext) {
    if (sx < 0 || sy < 0 || sz < 0) return this.add(new T.BoxGeometry(sx, sy, sz), color, mat, tf(x, y, z, rx, ry, rz), ext);   // 負的尺寸 BoxGeometry 會翻法線，照舊
    const B = KIT_BOX, e = tf(x, y, z, rx, ry, rz).elements, c = color instanceof T.Color ? color : lin(color);
    this.parts.push(this.pos.length / 3); KIT_N.box++;
    const mn = Math.min(sx, sy, sz);
    if (!this.sharp && mn >= KIT_BEV_MIN && Math.max(sx, sy, sz) <= KIT_BEV_MAX) {
      const V = KIT_BEV, b = Math.min(.035, Math.max(.012, mn * .1)), hx = sx / 2, hy = sy / 2, hz = sz / 2;
      KIT_N.bev++;
      for (let i = 0; i < V.n * 3; i += 3) {
        const px = V.A[i] * (hx - V.C[i] * b), py = V.A[i + 1] * (hy - V.C[i + 1] * b), pz = V.A[i + 2] * (hz - V.C[i + 2] * b), nx = V.N[i], ny = V.N[i + 1], nz = V.N[i + 2];
        this.pos.push(e[0] * px + e[4] * py + e[8] * pz + e[12], e[1] * px + e[5] * py + e[9] * pz + e[13], e[2] * px + e[6] * py + e[10] * pz + e[14]);
        this.nor.push(e[0] * nx + e[4] * ny + e[8] * nz, e[1] * nx + e[5] * ny + e[9] * nz, e[2] * nx + e[6] * ny + e[10] * nz);
        this.col.push(c.r, c.g, c.b); this.mat.push(mat);
        if (ext) for (const k in ext) (this.ext[k] ||= []).push(...ext[k]);
      }
      return this;
    }
    for (let i = 0; i < 108; i += 3) {
      const px = B.p[i] * sx, py = B.p[i + 1] * sy, pz = B.p[i + 2] * sz, nx = B.n[i], ny = B.n[i + 1], nz = B.n[i + 2];
      this.pos.push(e[0] * px + e[4] * py + e[8] * pz + e[12], e[1] * px + e[5] * py + e[9] * pz + e[13], e[2] * px + e[6] * py + e[10] * pz + e[14]);
      this.nor.push(e[0] * nx + e[4] * ny + e[8] * nz, e[1] * nx + e[5] * ny + e[9] * nz, e[2] * nx + e[6] * ny + e[10] * nz);
      this.col.push(c.r, c.g, c.b); this.mat.push(mat);
      if (ext) for (const k in ext) (this.ext[k] ||= []).push(...ext[k]);
    }
    return this;
  }
  cyl(x, y, z, r0, r1, h, seg, color, mat = 2, rx = 0, ry = 0, rz = 0, ext) { return this.add(new T.CylinderGeometry(r0, r1, h, seg), color, mat, tf(x, y, z, rx, ry, rz), ext); }
  build() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMat', new T.Float32BufferAttribute(this.mat, 1));
    for (const k in this.ext) g.setAttribute(k, new T.Float32BufferAttribute(this.ext[k], this.ext[k].length / (this.pos.length / 3)));
    g.userData.parts = Int32Array.from(this.parts);
    g.computeBoundingSphere();
    return g;
  }
}
// 顏色以 sRGB 撰寫，轉成線性後寫進頂點色
const lin = h => C3(h);   // ColorManagement 開著，Color(hex) 已經轉成線性
