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
const NX = 8, NZ = 7;
const X0 = -180, Z0 = -155;                 // 原本 5×5 的城市不動，新區往東、往南長
const avX = i => X0 + i * P, stZ = j => Z0 + j * Q;
const AVE = ['Harbor Av', 'Atlas Av', 'Bishop Av', 'Cinder Av', 'Delmar Av', 'Foundry Av', 'Granite Av', 'Hollis Av', 'Ironside Av'];
const STR = ['6 St', '7 St', '8 St', '9 St', '10 St', '11 St', '12 St', '13 St'];
const LANE = 3.0, PARK = 6.6;               // 車道與停車格中心離路中心的距離

// ─── 共用 uniform ───
const NL = LOW ? 8 : 16;
const U = {
  uTime: { value: 0 }, uLampOn: { value: 1 }, uFlash: { value: 0 }, uClipY: { value: -1e9 }, uWet: { value: 1 },
  uCam: { value: V3() }, uFogCol: { value: C3(0x1a1d26) }, uFogHi: { value: C3(0x3a2a3a) }, uFogDen: { value: .016 },
  uLP: { value: Array.from({ length: NL }, () => new T.Vector4(0, -999, 0, 0)) },
  uLC: { value: Array.from({ length: NL }, () => new T.Vector4()) },
  uLD: { value: Array.from({ length: NL }, () => new T.Vector4(0, -1, 0, -2)) },
  uAmbTop: { value: C3(0x1d2230) }, uAmbBot: { value: C3(0x241a16) },
  uCity: { value: new T.Vector4(X0, Z0, P, Q) }, uGrid: { value: new T.Vector2(NX, NZ) },
  uBeat: { value: 0 }, uRain: { value: .7 }, uLit: { value: .34 }, uLamp: { value: 1 },
  uFocus: { value: new T.Vector4() },   // xyz 角色頭部，w=1 時淡出擋在相機前的東西
};
const shared = keys => { const o = {}; for (const k of keys) o[k] = U[k]; return o; };
const ALLU = Object.keys(U);

// ─── GLSL 共用：雜湊、燈光、霧、環境反射 ───
const GL_LIB = /* glsl */`
uniform float uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp;
uniform vec3 uCam, uFogCol, uFogHi, uAmbTop, uAmbBot; uniform vec4 uFocus;
uniform vec4 uLP[${NL}]; uniform vec4 uLC[${NL}]; uniform vec4 uLD[${NL}];
uniform vec4 uCity; uniform vec2 uGrid;
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
  float X0=uCity.x, Z0=uCity.y, P=uCity.z, Q=uCity.w;
  vec3 cs = SODIUM*2.1*uLamp, cl = LEDW*1.5*uLamp;
  // 大道（南北向）路燈：鈉燈
  float ia = clamp(floor((p.x - X0)/P + .5), 0., uGrid.x);
  float ax = X0 + ia*P;
  float jz = floor((p.z - Z0)/Q);
  if (abs(p.x - ax) < 26.) for (int s=0; s<2; s++){
    float lx = ax + (s==0 ? -6.4 : 6.4);
    if (jz >= 0. && jz < uGrid.y) { float b = Z0 + jz*Q;
      lampOne(dif, spc, vec3(lx,7.1,b+16.), cs, p, n, v, shin);
      lampOne(dif, spc, vec3(lx,7.1,b+31.), cs, p, n, v, shin);
      lampOne(dif, spc, vec3(lx,7.1,b+46.), cs, p, n, v, shin); }
    if (jz-1. >= 0. && jz-1. < uGrid.y) lampOne(dif, spc, vec3(lx,7.1,Z0+(jz-1.)*Q+46.), cs, p, n, v, shin);
    if (jz+1. >= 0. && jz+1. < uGrid.y) lampOne(dif, spc, vec3(lx,7.1,Z0+(jz+1.)*Q+16.), cs, p, n, v, shin);
  }
  // 街（東西向）路燈：冷白 LED
  float js = clamp(floor((p.z - Z0)/Q + .5), 0., uGrid.y);
  float sz = Z0 + js*Q;
  float ix = floor((p.x - X0)/P);
  if (abs(p.z - sz) < 26.) for (int s=0; s<2; s++){
    float lz = sz + (s==0 ? -6.4 : 6.4);
    if (ix >= 0. && ix < uGrid.x) { float b = X0 + ix*P;
      lampOne(dif, spc, vec3(b+18.,7.1,lz), cl, p, n, v, shin);
      lampOne(dif, spc, vec3(b+36.,7.1,lz), cl, p, n, v, shin);
      lampOne(dif, spc, vec3(b+54.,7.1,lz), cl, p, n, v, shin); }
    if (ix-1. >= 0. && ix-1. < uGrid.x) lampOne(dif, spc, vec3(X0+(ix-1.)*P+54.,7.1,lz), cl, p, n, v, shin);
    if (ix+1. >= 0. && ix+1. < uGrid.x) lampOne(dif, spc, vec3(X0+(ix+1.)*P+18.,7.1,lz), cl, p, n, v, shin);
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
vec3 shade(vec3 p, vec3 n, vec3 v, vec3 alb, float rough, float metal){
  float shin = mix(300., 5., rough);
  vec3 dif = mix(uAmbBot, uAmbTop, n.y*.5+.5) + uFlash*vec3(.6,.66,.85)*(.35+.65*max(n.y,0.));
  vec3 spc = vec3(0);
  lampGrid(dif, spc, p, n, v, shin);
  pointLights(dif, spc, p, n, v, shin);
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
  return sky + uFlash*.6*vec3(.6,.65,.85)*max(y,0.);
}
vec3 applyFog(vec3 c, vec3 p){
  vec3 d = p - uCam; float dist = length(d);
  float hf = exp(-max(p.y,0.)*.02);
  float f = 1. - exp(-dist*uFogDen*(.5 + .5*hf));
  vec3 dir = d/max(dist,1e-3);
  vec3 fc = mix(uFogCol, uFogHi, smoothstep(-.05, .45, dir.y)) * (1. + uFlash*1.5);
  return mix(c, fc, clamp(f, 0., 1.));
}
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
  alb = mix(alb, vec3(.025, .022, .02), uM.w); rough = mix(rough, .95, uM.w); metal *= 1. - uM.w; envK *= 1. - uM.w; emi *= 1. - uM.w;
  float wet = uWet * smoothstep(.55, .95, n.y) * (1. - step(4., float(m)) * step(float(m), 9.));
  rough = mix(rough, rough*.35, wet); alb *= 1. - .3*wet;
  vec3 c = shade(vW, n, v, alb, rough, metal);
  if (envK > 0. || wet > .1) {
    vec3 r = reflect(-v, n); float F = .04 + .96*pow(1. - max(dot(n,v),0.), 5.);
    c += envMap(r) * max(envK, wet*.5) * mix(m == 0 ? max(F, .1) : F, 1., metal) * (1. - rough*.9);
  }
  c += emi;
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;

function mkUber(o = {}) {
  const defines = {};
  if (o.inst) defines.INST_EXTRA = '';
  if (o.double) defines.DOUBLE = '';
  return new T.ShaderMaterial({
    uniforms: { ...shared(ALLU), uM: { value: new T.Vector4(0, 0, o.emi ?? 1, 0) } },
    vertexShader: UBER_VS, fragmentShader: UBER_FS, defines,
    side: o.double ? T.DoubleSide : T.FrontSide,
  });
}
const MAT = { uber: mkUber(), uberI: mkUber({ inst: true }), uberD: mkUber({ double: true }) };

// ─── 幾何組合：把多個零件合併成一個帶頂點色與 aMat 的幾何 ───
const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = V3(), _s = V3();
function tf(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new T.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
}
class Kit {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.mat = []; this.ext = {}; }
  add(geo, color, mat, matrix, ext) {
    const g = geo.index ? geo.toNonIndexed() : geo;
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
  box(x, y, z, sx, sy, sz, color, mat = 2, rx = 0, ry = 0, rz = 0, ext) { return this.add(new T.BoxGeometry(sx, sy, sz), color, mat, tf(x, y, z, rx, ry, rz), ext); }
  cyl(x, y, z, r0, r1, h, seg, color, mat = 2, rx = 0, ry = 0, rz = 0, ext) { return this.add(new T.CylinderGeometry(r0, r1, h, seg), color, mat, tf(x, y, z, rx, ry, rz), ext); }
  build() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMat', new T.Float32BufferAttribute(this.mat, 1));
    for (const k in this.ext) g.setAttribute(k, new T.Float32BufferAttribute(this.ext[k], this.ext[k].length / (this.pos.length / 3)));
    g.computeBoundingSphere();
    return g;
  }
}
// 顏色以 sRGB 撰寫，轉成線性後寫進頂點色
const lin = h => C3(h);   // ColorManagement 開著，Color(hex) 已經轉成線性
