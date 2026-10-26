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
const bootStep = (p, msg) => { bootProgress(p, msg); return new Promise(r => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 80); }); };
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW = isTouch || Math.min(screen.width, screen.height) < 600;

let R;
try { R = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false }); }
catch (e) { bootMsg('這個瀏覽器無法啟用 WebGL。'); throw e; }
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
  soft: { name: '軟體繪圖', dpr: 1, msaa: 0, refl: 0, dist: .7, fps: 30, nl: 8, sh: 10, occ: 6, rf: .6, vol: 0, tex: 0 },
  low: { name: '低', dpr: 1.25, msaa: 0, refl: 1, dist: .8, fps: 60, nl: 8, sh: 16, occ: 6, rf: .8, vol: 0, tex: 1 },
  mid: { name: '中', dpr: 1.25, msaa: 2, refl: 1, dist: .9, fps: 60, nl: 12, sh: 20, occ: 12, rf: 1, vol: 10, tex: 2 },
  high: { name: '高', dpr: 1.5, msaa: 4, refl: 2, dist: 1, fps: 0, nl: 16, sh: 26, occ: 12, rf: 0, vol: 14, tex: 2, ss: 1.25, px: 4.2e6 },
  ultra: { name: '極高', dpr: 2, msaa: 4, refl: 2, dist: 1.2, fps: 0, nl: 16, sh: 32, occ: 12, rf: 0, vol: 20, tex: 2, ss: 1.5, px: 8.3e6 },
};
const GPU = (() => {
  const gl = R.getContext(); let name = '';
  try { const x = gl.getExtension('WEBGL_debug_renderer_info'); name = String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) { /* 有些瀏覽器不給名稱 */ }
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
  return { name: name || '未知', short: short || '未知', vendor, api, auto, tier, boot: tier, url: !!GPU_TIERS[q], hdr: qs.get('hdr') === '0' ? false : hdr, lost: 0 };
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
  uLP: { value: Array.from({ length: NL }, () => new T.Vector4(0, -999, 0, 0)) },
  uLC: { value: Array.from({ length: NL }, () => new T.Vector4()) },
  uLD: { value: Array.from({ length: NL }, () => new T.Vector4(0, -1, 0, -2)) },
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
  // 清晨的光（28-sky.js 每幀，室內是 0）：x 天空可見度（街谷遮蔽）的強度、y 日光反彈、z 貼地薄霧的濃度、w 霧裡日光前向散射的強度
  uGI: { value: new T.Vector4() },
  // 程式立面與斜屋頂的照片材質（08-tex.js 下載好才有）：A 是底色、N 是法線 xy＋粗糙度的 texture2D 陣列；uFac.x 1 = 有底色、y 1 = 有法線
  uFacA: { value: null }, uFacN: { value: null }, uFac: { value: new T.Vector4() },
  // 外海的機場島（21-air.js）：A = (中心 x, z, 長軸 cos, sin)、B = (半長, 半寬)；B.x = 0 時沒有
  uAirA: { value: new T.Vector4(0, 0, 1, 0) }, uAirB: { value: new T.Vector4() },
  // 車與行人在地上的陰影：每個 A = (x, z, cos, sin)、B = (半長, 半寬, 高, 0)
  uOccA: { value: Array.from({ length: GT().occ }, () => new T.Vector4(0, 0, 1, 0)) },
  uOccB: { value: Array.from({ length: GT().occ }, () => new T.Vector4()) },
};
const NOCC = GT().occ, SH_N = GT().sh;   // 地上陰影的車人數、日光陰影的步數
const shared = keys => { const o = {}; for (const k of keys) o[k] = U[k]; return o; };
const ALLU = Object.keys(U);

// ─── GLSL 共用：雜湊、燈光、霧、環境反射 ───
const GL_LIB = /* glsl */`
uniform float uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR;
uniform vec3 uCam, uFogCol, uFogHi, uAmbTop, uAmbBot; uniform vec4 uFocus;
uniform vec4 uLP[${NL}]; uniform vec4 uLC[${NL}]; uniform vec4 uLD[${NL}];
uniform vec4 uCity; uniform vec2 uGrid;
uniform highp sampler2D uLampT; uniform vec4 uLampG, uZone;
uniform float uDay, uCloud; uniform vec3 uSun, uSunCol, uSkyTop, uSkyHor, uMoon;
uniform sampler2D uHMap, uCityM, uTMap; uniform vec4 uHM, uAirA, uAirB, uTM, uGI;
uniform vec4 uOccA[${NOCC}]; uniform vec4 uOccB[${NOCC}];
float h11(float n){ return fract(sin(n)*43758.5453123); }
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float hw(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n2(p); p=p*2.03+17.1; a*=.5; } return s; }
const vec3 SODIUM = vec3(1.0, .46, .16);
const vec3 LEDW = vec3(.55, .78, 1.0);
void lampOne(inout vec3 dif, inout vec3 spc, vec3 lp, vec3 col, vec3 p, vec3 n, vec3 v, float shin){
  vec3 L = lp - p; float d2 = dot(L,L); if (d2 > 420.) return;
  float d = sqrt(d2); L /= d;
  float win = 1. - d2/420.; win *= win;
  float cone = smoothstep(.0, .6, L.y);
  float att = win * cone * 26. / (4. + d2);
  dif += col * att * max(dot(n,L), 0.);
  vec3 hv = normalize(L + v);
  spc += col * att * pow(max(dot(n,hv),0.), shin) * (shin + 8.) * .05;
}
void lampGrid(inout vec3 dif, inout vec3 spc, vec3 p, vec3 n, vec3 v, float shin){
  if (uLampOn < .5) return;
  vec3 cs = SODIUM*2.1*uLamp, cl = LEDW*1.5*uLamp;
  // 大道的鈉燈與街的冷白 LED：查片段所在那一格的路燈表
  ivec2 c = ivec2(floor((p.xz - uLampG.xy) / ${LAMP_C}.));
  if (c.x < 0 || c.y < 0 || c.x >= int(uLampG.z) || c.y >= int(uLampG.w)) return;
  for (int k = 0; k < ${LAMP_K}; k++) {
    vec4 L = texelFetch(uLampT, ivec2(c.x * ${LAMP_K} + k, c.y), 0);
    if (L.w < .5) break;
    lampOne(dif, spc, vec3(L.x, 6.1 + L.w, L.y), L.z < .5 ? cs : cl, p, n, v, shin);   // w = 1 + 燈柱底的高度（快速道路橋面上的燈）
  }
}
void pointLights(inout vec3 dif, inout vec3 spc, vec3 p, vec3 n, vec3 v, float shin){
  for (int i=0; i<${NL}; i++){
    vec4 lp = uLP[i]; if (lp.w <= 0.) continue;
    vec3 L = lp.xyz - p; float d2 = dot(L,L); float r2 = lp.w*lp.w; if (d2 > r2) continue;
    float d = sqrt(d2); L /= d;
    float win = 1. - d2/r2; win *= win;
    vec4 ld = uLD[i];
    float sp = ld.w > -1.5 ? smoothstep(ld.w, ld.w + .14, dot(-L, ld.xyz)) : 1.;
    vec3 col = uLC[i].rgb * win * sp * 8. / (2. + d2);
    dif += col * max(dot(n,L), 0.) * (uLC[i].a > .5 ? 1. : 1.);
    vec3 hv = normalize(L + v);
    spc += col * pow(max(dot(n,hv),0.), shin) * (shin + 8.) * .05;
  }
}
// 樹冠：從 q 朝太陽方向在樹冠圖上步進（步長固定、比建築細），落在某棵樹的頂與底之間就照葉子的疏密（雜訊）擋掉一部分，
// 葉子之間有空隙，地上是一塊塊的碎光；最多擋到剩 18%（樹蔭不會全黑）。uTM.w 是最高的樹冠，0 是沒有樹冠圖
float leafVis(vec3 q, vec2 d, float k){
  if (uTM.w <= 0. || q.y > uTM.w) return 1.;
  float lt = 1., t = .3 + hw(q.xz * 7.3) * .8;   // 起點抖動：步進的位置不會在地上排成一圈圈的條紋
  for (int i = 0; i < 10; i++) {
    vec3 r = vec3(q.x + d.x * t, q.y + t * k, q.z + d.y * t);
    if (r.y > uTM.w) break;
    vec2 tb = textureLod(uTMap, (r.xz - uTM.xy) * uTM.z, 0.).rg;
    if (r.y < tb.r && r.y > tb.g) {
      float e = min(tb.r - r.y, r.y - tb.g);   // 離樹冠表面多深：邊上稀、裡面密
      lt *= 1. - smoothstep(.38, .62, n2(r.xz * .95 + vec2(r.y * .7, -r.y * .4))) * mix(.45, .8, smoothstep(0., 1.2, e));
      if (lt < .18) return .18;
    }
    t += .9 + t * .14;
  }
  return lt;
}
// 日光陰影：從 p 朝太陽方向在建築高度圖上步進（步長越走越大），光線高度低於屋頂就在陰影裡；
// 離遮擋物越遠半影越寬。牆面先往外推一點，免得取到自己那棟的高度
float sunVis(vec3 p, vec3 n){
  float sl = max(length(uSun.xz), 1e-3);
  vec2 d = uSun.xz / sl; float k = uSun.y / sl;
  vec3 q = p + vec3(n.x, 0., n.z) * 1.3 + vec3(0., .2, 0.);
  float vis = 1., t = .9;
  for (int i = 0; i < ${SH_N}; i++) {
    float ry = q.y + t * k;
    if (ry > uHM.w) break;
    vec2 uv = (q.xz + d * t - uHM.xy) * uHM.z;
    if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) break;
    float h = textureLod(uHMap, uv, 0.).r;
    vis = min(vis, clamp((ry - h) / (.3 + t * .02), 0., 1.));
    if (vis < .02) return 0.;
    t = t * 1.18 + .9;
  }
  return vis * leafVis(q, d, k);
}
// 車與行人：車底的接觸陰影（夜裡也有）與日光投在地上的影子（車身框沿太陽方向平移到兩個高度）
void occlude(vec3 p, out float amb, out float sun){
  amb = 1.; sun = 1.;
  if (p.y > .4) return;
  vec2 sd = uSun.y > .06 ? uSun.xz / uSun.y : vec2(0.);
  bool lit = uSunCol.r + uSunCol.g > .001;
  for (int i = 0; i < ${NOCC}; i++) {
    vec4 A = uOccA[i], B = uOccB[i];
    if (B.x <= 0.) continue;
    vec2 d = p.xz - A.xy;
    if (dot(d, d) > 1600.) continue;
    vec2 f = vec2(A.w, A.z), r = vec2(A.z, -A.w);
    vec2 l = vec2(dot(d, f), dot(d, r));
    float ext = length(max(abs(l) - B.xy, 0.));
    amb = min(amb, mix(.3, 1., smoothstep(0., .35 + B.y * .5, ext)));
    if (lit) {   // 從 p 往太陽方向的線段（高度 0 到車高）離車身框最近的距離：沿線段是凸函數，三分搜尋
      vec2 a = vec2(dot(d, f), dot(d, r)), b = a + vec2(dot(sd, f), dot(sd, r)) * B.z;
      float t0 = 0., t1 = 1.;
      for (int s = 0; s < 4; s++) {
        float m1 = mix(t0, t1, .382), m2 = mix(t0, t1, .618);
        if (length(max(abs(mix(a, b, m1)) - B.xy, 0.)) < length(max(abs(mix(a, b, m2)) - B.xy, 0.))) t1 = m2; else t0 = m1;
      }
      sun = min(sun, smoothstep(0., .2, length(max(abs(mix(a, b, (t0 + t1) * .5)) - B.xy, 0.))));
    }
  }
}
// 天空可見度（街谷遮蔽）：在建築高度圖上朝五個方向各取兩個距離（6、16 m）找地平線的仰角，平均擋掉的天空；
// 牆面只看前面那半圈（背後是自己那棟）。窄巷與樓腳暗、屋頂與廣場亮（近似全域光照裡的天光遮蔽）；260 m 外在霧裡，不算
float skyVis(vec3 p, vec3 n){
  vec3 q = p + vec3(n.x, 0., n.z) * 1.3;
  vec2 nx = n.xz; float nl = length(nx); nx = nl > .05 ? nx / nl : vec2(0.);
  float occ = 0., ws = 0.;
  for (int i = 0; i < 5; i++) {
    float a = float(i) * 1.2566 + .3; vec2 d = vec2(cos(a), sin(a));
    float w = mix(1., max(dot(d, nx), 0.) * 2., min(nl * 1.4, 1.));
    if (w < .01) continue;
    float tg = 0., r = 6.;
    for (int k = 0; k < 2; k++) { tg = max(tg, (textureLod(uHMap, (q.xz + d * r - uHM.xy) * uHM.z, 0.).r - q.y) / r); r *= 2.7; }
    occ += w * clamp(tg * inversesqrt(1. + tg * tg), 0., 1.);
    ws += w;
  }
  return 1. - occ / max(ws, 1e-3);
}
float gSun = -1., gAmb = -1., gOccS = 1., gSky = -1.;   // 同一個片段多次呼叫 shade()（立面的窗框、招牌）只算一次陰影與天空可見度
vec3 shade(vec3 p, vec3 n, vec3 v, vec3 alb, float rough, float metal){
  float shin = mix(300., 5., rough);
  if (gAmb < 0.) occlude(p, gAmb, gOccS);
  if (gSky < 0.) gSky = uGI.x > 0. && dot(p - uCam, p - uCam) < 67600. ? mix(1., skyVis(p, n), uGI.x) : 1.;
  vec3 dif = mix(uAmbBot, uAmbTop * gSky, n.y*.5+.5) + uFlash*vec3(.6,.66,.85)*(.35+.65*max(n.y,0.));
  // 日光反彈（低角度陽光的間接光）：照亮的路面往上打在牆腳與招牌底面，街對面照到太陽的牆把暖光反射到背光的這一面（街谷越深越明顯）
  if (uGI.y > 0.) {
    float side = 1. - abs(n.y);
    vec3 bn = uSunCol * uGI.y;
    dif += bn * vec3(.5, .42, .36) * (.06 + .5 * max(uSun.y, 0.)) * (max(-n.y, 0.) + side * .5) * .5;
    dif += bn * vec3(.62, .46, .36) * max(dot(-vec3(n.x, 0., n.z), uSun), 0.) * side * (1.15 - gSky) * .32;
  }
  vec3 spc = vec3(0);
  lampGrid(dif, spc, p, n, v, shin);
  pointLights(dif, spc, p, n, v, shin);
  dif *= gAmb; spc *= gAmb;
  if (uSunCol.r + uSunCol.g > .001) {
    float nl = dot(n, uSun);
    if (nl > 0.) {
      if (gSun < 0.) gSun = sunVis(p, n) * gOccS;
      vec3 sc = uSunCol * gSun;
      dif += sc * nl;
      vec3 hv = normalize(uSun + v);
      spc += sc * pow(max(dot(n,hv),0.), shin) * (shin + 8.) * .025 * nl;
    }
  }
  float F = .04 + .96*pow(1. - max(dot(n,v),0.), 5.);
  vec3 ks = mix(vec3(F + .02), alb, metal) * (1. - rough*.8);
  return alb*(1.-metal)*dif + ks*spc;
}
vec3 envMap(vec3 r){
  float y = r.y;
  float az = atan(r.z, r.x);
  float cell = floor(az*22.);
  float band = exp(-abs(y - .04)*11.);
  float on = step(.42, h21(vec2(cell, floor(y*30.))));
  vec3 lc = mix(SODIUM*1.4, vec3(.25,.95,1.), step(.6, h21(vec2(cell,3.))));
  lc = mix(lc, vec3(1.,.25,.55), step(.82, h21(vec2(cell,7.))));
  vec3 sky = mix(uFogHi*1.6, vec3(.012,.012,.02), smoothstep(.0,.7,y));
  sky += band*(.06 + on*.55*lc*smoothstep(.0,.08,fract(az*22.))*smoothstep(1.,.92,fract(az*22.)));
  if (y < 0.) sky = mix(uFogCol*1.2, vec3(.006), smoothstep(0.,-.35,y)) + band*.25*lc*on;
  if (uDay > .001) {   // 白天：天空漸層、太陽的反光，地平線那圈霓虹淡掉
    vec3 dc = mix(uSkyHor, uSkyTop, smoothstep(0., .55, y));
    dc += uSunCol * (pow(max(dot(r, uSun), 0.), 350.) * 5. + pow(max(dot(r, uSun), 0.), 8.) * .12);
    if (y < 0.) dc = mix(uFogCol, uFogCol * .3, smoothstep(0., -.35, y));
    sky = mix(sky, dc, uDay);
  }
  return sky + uFlash*.6*vec3(.6,.65,.85)*max(y,0.);
}
vec3 applyFog(vec3 c, vec3 p){
  vec3 d = p - uCam; float dist = length(d);
  float hf = exp(-max(p.y,0.)*.02), D = .5 + .5*hf;
  // 鏡頭在高處（直升機、霓峰塔的塔吊）：霧集中在地面附近（標高 20 m 的指數大氣），往下看只穿過一小段濃霧；
  // 只在城市的陸地上（22-hmap.js 的 uCityM）：外面的山、河與海本來就只做給地面看的剪影，照舊在霧裡。地面的鏡頭照舊（hk = 0）。畫面邊緣（uCullR：distCull 與街道設施不畫的距離）照水平距離全進霧裡，不會看到城市被切掉
  float hk = smoothstep(20., 120., uCam.y) * texture2D(uCityM, (p.xz - uHM.xy) * uHM.z).r, yc = max(uCam.y, 0.), yp = max(p.y, 0.), dy = abs(yc - yp);
  float Da = dy > 1. ? 20.*abs(exp(-yp/20.) - exp(-yc/20.))/dy : exp(-yp/20.);
  #ifndef FAR
  D = mix(D, min(D, .02 + Da), hk);   // 遠景（北嶺的山坡、對岸）照舊：本來就只做給地面看的剪影，近看的明暗不對
  #endif
  if (uAirB.x > 0.) {   // 機場島雖然用遠景材質（從城裡隔著海看得到），但飛得到上空：島上和城裡一樣讓高處的霧變淡
    vec2 q = p.xz - uAirA.xy, lq = abs(vec2(dot(q, uAirA.zw), dot(q, vec2(-uAirA.w, uAirA.z)))) - uAirB.xy;
    D = mix(D, min(D, .02 + Da), smoothstep(20., 120., uCam.y) * (1. - smoothstep(0., 80., max(lq.x, lq.y))));
  }
  float x = dist*uFogDen*D;
  float f = mix(1. - exp(-x), 1. - exp(-x*x), uDay);   // 白天用平方指數：近處清楚、420 m 外（distCull 不畫的地方）照樣全進霧裡
  #ifndef FAR
  f = max(f, hk * smoothstep(.6, .97, length(d.xz)/uCullR));
  #endif
  vec3 dir = d/max(dist,1e-3);
  vec3 fc = mix(uFogCol, uFogHi, smoothstep(-.05, .45, dir.y)) * (1. + uFlash*1.5);
  // 霧裡的日光前向散射：朝太陽那一側的霧亮起來、偏暖（清晨低角度時最明顯）
  float sd = max(dot(dir, uSun), 0.), ph = sd * sd * sd * .25 + pow(sd, 24.) * .9;
  fc += uSunCol * ph * uGI.w;
  // 清晨貼地的薄霧：標高 7 m 的指數層，沿視線積分（鏡頭與那一點的高度）；顏色是霧色加上朝太陽的散射
  if (uGI.z > 0.) {
    float ya = max(uCam.y, 0.), yb = max(p.y, 0.), dh = yb - ya;
    float Dm = abs(dh) > .3 ? 7. * (exp(-ya / 7.) - exp(-yb / 7.)) / dh : exp(-yb / 7.);
    float fm = 1. - exp(-dist * uGI.z * Dm);
    c = mix(c, uFogCol * 1.08 + uSunCol * ph * .6, fm);
  }
  return mix(c, fc, clamp(f, 0., 1.));
}
// 遠景只算一部分距離的霧（FAR）：鏡頭升到 40–180 m（直升機、霓峰塔的塔吊）時慢慢回到完整的霧，不然中間的城區都在霧裡、遠處的對岸與山坡像浮在空中
float farK(float k){ return mix(k, 1., smoothstep(40., 180., uCam.y)); }
`;

const VS_HEAD = /* glsl */`
varying vec3 vW, vN;
`;

// 通用材質：頂點色當底色，aMat 決定粗糙度、金屬與自發光
const UBER_VS = /* glsl */`
attribute vec3 color; attribute float aMat;
#ifdef INST_EXTRA
attribute vec4 aIns;
#endif
varying vec3 vW, vN, vCol; varying float vMat; varying vec4 vIns;
void main(){
  vec4 lp = vec4(position, 1.); vec3 nn = normal;
  #ifdef USE_INSTANCING
  lp = instanceMatrix * lp; nn = mat3(instanceMatrix) * nn;
  #endif
  vec4 w = modelMatrix * lp; vW = w.xyz; vN = normalize(mat3(modelMatrix) * nn);
  vCol = color; vMat = aMat;
  #ifdef INST_EXTRA
  vIns = aIns;
  #else
  vIns = vec4(0);
  #endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const UBER_FS = /* glsl */`
${GL_LIB}
uniform vec4 uM;     // x 頭燈、y 煞車、z 自發光倍率、w 燒毀程度（爆炸後的殘骸）
varying vec3 vW, vN, vCol; varying float vMat; varying vec4 vIns;
void main(){
  if (vW.y < uClipY) discard;
  if (uFocus.w > 0.) {   // 貼著相機或擋在相機與角色之間的東西用抖動淡掉
    vec3 ab = uFocus.xyz - uCam; float tt = clamp(dot(vW - uCam, ab) / dot(ab, ab), 0., 1.);
    float dd = length(vW - uCam - ab * tt), cd = length(vW - uCam);
    float fade = max(1. - smoothstep(.5, 1.6, cd), (1. - smoothstep(.45, 1., dd)) * step(tt, .8) * .8);
    if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) < fade) discard;
  }
  vec3 n = normalize(vN);
  #ifdef DOUBLE
  if (!gl_FrontFacing) n = -n;
  #endif
  vec3 v = normalize(uCam - vW);
  int m = int(vMat + .5);
  vec3 alb = vCol; float rough = .7, metal = 0., envK = 0.; vec3 emi = vec3(0);
  if (m == 0) { rough = .22; envK = .75; }                                   // 車漆
  else if (m == 1) { alb *= .12; rough = .04; envK = 1.1; }                   // 玻璃
  else if (m == 2) { rough = .85; }                                           // 塑膠、橡膠飾條
  else if (m == 3) { rough = .14; metal = 1.; envK = 1.; }                    // 鍍鉻
  else if (m == 4) { emi = vCol * (.2 + uM.x * 1.7); alb *= .2; }           // 頭燈
  else if (m == 5) { float b = max(uM.y, vIns.x); emi = vCol * (.7 + b * 2.6); alb *= .2; } // 尾燈
  else if (m == 6) { rough = .92; alb *= .5; }                                // 輪胎
  else if (m == 7) { rough = .3; metal = 1.; envK = .6; }                    // 輪圈
  else if (m == 8) { emi = vCol * 2.4 * uM.z * (.9 + .1*sin(uTime*2.3 + vIns.y*9.)); alb *= .1; } // 霓虹、燈箱
  else if (m == 9) { emi = vCol * step(.5, fract(uTime*1.3 + vIns.y)) * 2.6; } // 閃爍黃燈
  else if (m == 10) { rough = .5; }                                          // 光滑材質
  else if (m == 11) { emi = vCol * 1.1 * uM.z; alb *= .3; }                  // 柔和自發光
  else if (m >= 12 && m <= 14) { float on = abs(vIns.x - float(m - 12)) < .5 ? 1. : 0.; emi = vCol * (.04 + on * 3.4); alb *= .15; } // 號誌燈
  else if (m == 15) { rough = .5; metal = .8; envK = .3; }                   // 生鐵
  else if (m == 16) { emi = vCol * uLampOn * 1.6; alb = vec3(.03); rough = .08; envK = 1.; }   // 白天是暗玻璃、入夜才亮的窗（天樞島的塔冠）
  alb = mix(alb, vec3(.025, .022, .02), uM.w); rough = mix(rough, .95, uM.w); metal *= 1. - uM.w; envK *= 1. - uM.w; emi *= 1. - uM.w;
  float wet = uWet * smoothstep(.55, .95, n.y) * (1. - step(4., float(m)) * step(float(m), 9.));
  #ifdef FAR
  wet = 0.;   // 遠景的大片空地反射 envMap 的霓虹帶會變成一條條色塊
  #endif
  rough = mix(rough, rough*.35, wet); alb *= 1. - .3*wet;
  vec3 c = shade(vW, n, v, alb, rough, metal);
  if (envK > 0. || wet > .1) {
    vec3 r = reflect(-v, n); float F = .04 + .96*pow(1. - max(dot(n,v),0.), 5.);
    c += envMap(r) * max(envK, wet*.5) * mix(m == 0 ? max(F, .1) : F, 1., metal) * (1. - rough*.9);
  }
  c += emi;
  #if defined(FAR) && defined(FARD)
  float fd = length(vW - uCam);   // 北嶺（21-park.js）：FARD 公尺內照一般的霧，再遠才和遠景一樣只算一部分距離，走得到的山坡接上遠景山脊
  gl_FragColor = vec4(applyFog(c, uCam + (vW - uCam) * (fd > FARD ? (FARD + (fd - FARD) * farK(FAR)) / fd : 1.)), 1.);
  #elif defined(FAR)
  gl_FragColor = vec4(applyFog(c, uCam + (vW - uCam) * farK(FAR)), 1.);   // 遠景（對岸、山、外海的島）：霧只算一部分距離，剪影才看得到
  #else
  gl_FragColor = vec4(applyFog(c, vW), 1.);
  #endif
}`;

function mkUber(o = {}) {
  const defines = {};
  if (o.inst) defines.INST_EXTRA = '';
  if (o.double) defines.DOUBLE = '';
  if (o.far) defines.FAR = o.far.toFixed(3);
  if (o.fard) defines.FARD = o.fard.toFixed(1);
  return new T.ShaderMaterial({
    uniforms: { ...shared(ALLU), uM: { value: new T.Vector4(0, 0, o.emi ?? 1, 0) } },
    vertexShader: UBER_VS, fragmentShader: UBER_FS, defines,
    side: o.double ? T.DoubleSide : T.FrontSide,
  });
}
const MAT = { uber: mkUber(), uberI: mkUber({ inst: true }), uberD: mkUber({ double: true }), far: mkUber({ far: .2 }), far2: mkUber({ far: .09 }), ridge: mkUber({ far: .2, fard: 150 }) };

// ─── 幾何組合：把多個零件合併成一個帶頂點色與 aMat 的幾何 ───
const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = V3(), _s = V3();
function tf(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new T.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
}
const KIT_BOX = (() => { const g = new T.BoxGeometry(1, 1, 1).toNonIndexed(); return { p: Float32Array.from(g.attributes.position.array), n: Float32Array.from(g.attributes.normal.array) }; })();
class Kit {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.mat = []; this.ext = {}; this.parts = []; }
  add(geo, color, mat, matrix, ext) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    this.parts.push(this.pos.length / 3);   // 每個零件的第一個頂點：cityAdd 依零件所在的片換到世界座標（零件不會被切開）
    if (matrix) g.applyMatrix4(matrix);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const c = color instanceof T.Color ? color : lin(color);
    for (let i = 0; i < p.length; i += 3) {
      this.pos.push(p[i], p[i + 1], p[i + 2]); this.nor.push(n[i], n[i + 1], n[i + 2]);
      this.col.push(c.r, c.g, c.b); this.mat.push(mat);
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
    this.parts.push(this.pos.length / 3);
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
