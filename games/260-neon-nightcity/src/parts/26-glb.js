// ═══ 實車模型：Sketchfab 的 GLB 經 tools/cars.mjs 處理成 assets/260/<id>.glb，規格在 assets/260/cars.json（打包進頁面） ═══
// 以網站伺服器開啟時才下載；以檔案開啟、或下載失敗，就一直用 proxy 指定的程式建模車身（機車用 Hanzo）頂替，頁面照樣能玩。
// 材質沿用 uber 的光照、霧、倒影裁切與遮擋淡出，底色、粗糙度、金屬、清漆與自發光改讀 GLB 的頂點屬性與貼圖。
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import GLB_SPEC from '../../../../assets/260/cars.json';

const GLB_ON = /^https?:$/.test(location.protocol);
const GLB_BASE = new URL('../assets/260/', location.href).href;
const glbReport = { on: GLB_ON, loaded: [], failed: [] };

// price 美元；vmax m/s、eng 加速、grip 抓地（同 CARS）；proxy 是沒下載到模型時的替身；fb 是替身的車色
const GLB_CARS = [
  ['e92', { name: 'BMW M3 (E92)', cls: '2010 · 4.0 V8 雙門', price: 62000, fb: 0x0b4fd0, proxy: 'ronin', vmax: 78, eng: 15, grip: 9.2,
    tag: '最後一代自然進氣 V8 的 M3，轉到八千轉還在加速。寬體套件、碳纖維車頂與鴨尾。' }],
  ['m3c', { name: 'BMW M3 Competition', cls: '2021 G80 · 雙渦輪直六四門', price: 98000, fb: 0xc81010, proxy: 'lucerna', vmax: 80, eng: 16.5, grip: 9.4,
    tag: '四門房車的外表、510 匹的心臟。這台加了寬體套件、鍛造碳引擎蓋與巨大尾翼，載得了朋友也甩得了尾。' }],
  ['m4wb', { name: 'BMW M4 寬體改裝', cls: 'G82 · 寬體套件', price: 165000, fb: 0x8a7a50, proxy: 'ronin', vmax: 84, eng: 17.5, grip: 9.8,
    tag: '直立大鼻孔、外擴的葉子板與低趴的車身，香檳金烤漆在霓虹底下會變色。' }],
  ['m3gtr', { name: 'BMW M3 GTR (GT2)', cls: '2001 E46 · ALMS 賽車', price: 420000, fb: 0x6a1018, proxy: 'ronin', vmax: 82, eng: 18, grip: 10.4,
    tag: '美國 ALMS 傳奇的 22 號車，V8 賽車引擎塞進 E46 車身。原廠彩繪，CHROME WORKS 不能換色。' }],
  ['m3t24', { name: 'BMW M3 Touring 24H', cls: '2026 · 耐久賽旅行車', price: 560000, fb: 0x2a3a8a, proxy: 'lucerna', vmax: 80, eng: 18.5, grip: 10.6,
    tag: '紐柏林 24 小時的旅行車賽車，防滾籠、賽車座椅、Shell Helix 彩繪。原廠彩繪，不能換色。' }],
  ['m4gt3', { name: 'BMW M4 GT3 EVO', cls: '2025 G82 · GT3 賽車', price: 640000, fb: 0x15161a, proxy: 'mamba', vmax: 83, eng: 19, grip: 10.8,
    tag: 'GT3 規格的 M4：寬體、鵝頸尾翼、中央鎖定輪框。消光黑車身，可以到 CHROME WORKS 換色。' }],
  ['gt3rs', { name: 'Porsche 911 GT3 RS', cls: '992 · 自然進氣水平對臥六缸', price: 330000, fb: 0x9a9680, proxy: 'kanto', vmax: 86, eng: 19.5, grip: 10.6,
    tag: '九千轉紅線的公路賽車，鵝頸尾翼高過車頂。橡木綠金屬漆配橘色輪框，原廠塗裝不能換色。' }],
  ['gt3r', { name: 'Porsche 911 GT3 R', cls: '2024 992 · GT3 賽車', price: 720000, fb: 0x6a5ab0, proxy: 'kanto', vmax: 84, eng: 19.5, grip: 11,
    tag: '純賽車，沒有車牌也沒有冷氣。抓地力是整間車行最好的一台。原廠彩繪，不能換色。' }],
  ['s1krr', { name: 'BMW S1000RR', cls: '千 cc 超級跑車機車', price: 24000, fb: 0xc81010, proxy: 'hanzo', bike: true, vmax: 80, eng: 17, grip: 7.4, seat: [-.06, -.2],
    tag: '兩百匹的四缸超跑機車，壓車過彎比任何一台車都快，只是下雨天要小心。' }],
  ['s1krr19', { name: 'BMW S1000RR (2019)', cls: 'M 套件 · 千 cc 超跑機車', price: 29000, fb: 0xd8d8dc, proxy: 'hanzo', bike: true, vmax: 82, eng: 18, grip: 7.6, seat: [-.06, -.2],
    tag: '第二代 S1000RR，M 套件的白藍紅塗裝、碳纖維輪框與 Akrapovič 排氣管。' }],
];
const shortLic = l => (l || '').replace(/\s*\(.*\)/, '').replace(/^CC-/, 'CC ').replace(/-(\d)/, ' $1');
const shortAuthor = a => (a || '').replace(/\s*\(.*\)/, '');
for (const [id, o] of GLB_CARS) {
  const s = GLB_SPEC[id];
  car(id, {
    ...o, glb: true, paint: null, paintable: !!s.paintable,
    len: s.len, w: s.w, wr: s.wr || .33, ww: o.bike ? [.12, .19] : [.27, .3], track: s.track || .8, fa: s.fa || 1.3, ra: s.ra || -1.3, rim: ['five', 0x9aa0a6],
    credit: `模型：${shortAuthor(s.author)} · ${shortLic(s.license)} · 非官方同人，與車廠無關`, source: s.source,
  });
}

// ─── 材質 ───
const GLB_VS = /* glsl */`
attribute vec4 color; attribute vec4 _pbr; attribute vec4 _emi;
varying vec3 vW, vN; varying vec4 vCol, vPbr, vEmi; varying vec2 vUv;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vCol = color; vPbr = _pbr; vEmi = _emi;
  #ifdef USE_MAP
  vUv = uv;
  #else
  vUv = vec2(0);
  #endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GLB_FS = /* glsl */`
${GL_LIB}
uniform vec4 uM, uPaint; uniform sampler2D uMap, uEmiMap;
varying vec3 vW, vN; varying vec4 vCol, vPbr, vEmi; varying vec2 vUv;
void main(){
  if (vW.y < uClipY) discard;
  if (uFocus.w > 0.) {
    vec3 ab = uFocus.xyz - uCam; float tt = clamp(dot(vW - uCam, ab) / dot(ab, ab), 0., 1.);
    float dd = length(vW - uCam - ab * tt), cd = length(vW - uCam);
    float fade = max(1. - smoothstep(.5, 1.6, cd), (1. - smoothstep(.45, 1., dd)) * step(tt, .8) * .8);
    if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) < fade) discard;
  }
  vec4 base = vCol;
  if (vPbr.w > .5 && uPaint.w > .5) base.rgb = uPaint.rgb;
  #ifdef USE_MAP
  base *= texture2D(uMap, vUv);
  #endif
  #ifdef MASK
  if (base.a < .5) discard;
  #endif
  vec3 n = normalize(vN);
  #ifdef DOUBLE
  if (!gl_FrontFacing) n = -n;
  #endif
  vec3 v = normalize(uCam - vW);
  float rough = clamp(vPbr.x, .05, 1.), metal = clamp(vPbr.y, 0., 1.), coat = vPbr.z;
  // 很多模型把金屬漆標成 metallic 1；夜城的環境光很暗，全金屬會整台變黑，所以只有很光滑的（鍍鉻）才保留全金屬
  metal = min(metal, mix(.5, 1., step(rough, .15)));
  float wet = uWet * smoothstep(.55, .95, n.y);
  rough = mix(rough, rough * .4, wet);
  vec3 c = shade(vW, n, v, base.rgb, rough, metal);
  float envK = max(coat * .75, metal * .9);
  #ifdef BLEND
  envK = 1.1;
  #endif
  envK = max(envK, wet * .5);
  if (envK > .01) {
    vec3 r = reflect(-v, n); float F = .04 + .96 * pow(1. - max(dot(n, v), 0.), 5.);
    float rr = coat > .3 ? min(rough, .25) : rough;
    c += envMap(r) * envK * mix(vec3(max(F, coat * .1)), base.rgb, metal) * (1. - rr * .9);
  }
  vec3 emi = vEmi.rgb / max(1., max(vEmi.r, max(vEmi.g, vEmi.b)));   // 有些模型的 emissive_strength 很大，壓回 0–1 再交給燈種倍率
  #ifdef USE_EMIMAP
  emi *= texture2D(uEmiMap, vUv).rgb;
  #endif
  float k = vEmi.a;
  c += emi * 1.6 * (k > 1.5 ? .5 + uM.y * 2.4 : k > .5 ? .35 + uM.x * 1.4 : uM.z);
  #ifdef BLEND
  gl_FragColor = vec4(applyFog(c, vW), clamp(base.a + (1. - max(dot(n, v), 0.)) * .25, 0., 1.));
  #else
  gl_FragColor = vec4(applyFog(c, vW), 1.);
  #endif
}`;
function glbMaterial(src, inst) {
  const defines = {};
  if (src.map) defines.USE_MAP = '';
  if (src.emissiveMap) defines.USE_EMIMAP = '';
  if (src.transparent) defines.BLEND = ''; else if (src.alphaTest > 0) defines.MASK = '';
  if (src.side === T.DoubleSide) defines.DOUBLE = '';
  return new T.ShaderMaterial({
    uniforms: { ...shared(ALLU), uM: inst.uM, uPaint: inst.uPaint, uMap: { value: src.map || null }, uEmiMap: { value: src.emissiveMap || null } },
    vertexShader: GLB_VS, fragmentShader: GLB_FS, defines, side: src.side,
    transparent: !!src.transparent, depthWrite: !src.transparent,
  });
}

// ─── 下載與拆件：body 的網格、每個輪子的網格（相對輪軸）；幾何與貼圖所有實例共用 ───
const glbLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const glbCache = {};
function loadGLB(id) {
  if (!GLB_ON || !CARS[id] || !CARS[id].glb) return null;
  return glbCache[id] ??= glbLoader.loadAsync(GLB_BASE + id + '.glb').then(g => {
    const root = g.scene.getObjectByName('car'), spec = GLB_SPEC[id];
    g.scene.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const tpl = { id, body: [], wheels: [] };
    for (const n of root.children) {
      const meshes = []; n.traverse(o => { if (o.isMesh) meshes.push(o); });
      const list = meshes.map(m => ({ geo: m.geometry, mat: m.material, rel: new T.Matrix4().multiplyMatrices(inv, m.matrixWorld) }));
      const w = n.name.startsWith('wheel_') && spec.wheels.find(w => 'wheel_' + w.name === n.name);
      if (w) {
        const off = new T.Matrix4().makeTranslation(-w.x, -w.y, -w.z);
        for (const e of list) e.rel.premultiply(off);
        tpl.wheels.push({ ...w, front: w.name[0] === 'F', list });
      } else tpl.body.push(...list);
    }
    glbReport.loaded.push(id);
    return tpl;
  }, () => { glbReport.failed.push(id); return null; });
}
// 一個實例：自己的 uM（頭燈、煞車）與車漆 uniform，網格與材質都是新的、幾何共用
function glbInstance(tpl, paint, uM) {
  const inst = { uM: uM || { value: new T.Vector4(0, 0, 1, 0) }, uPaint: { value: new T.Vector4(0, 0, 0, 0) }, body: new T.Group(), wheels: [] };
  if (paint != null && CARS[tpl.id].paintable) { const c = new T.Color(paint); inst.uPaint.value.set(c.r, c.g, c.b, 1); }
  const mats = new Map();
  const mk = e => {
    let m = mats.get(e.mat); if (!m) { m = glbMaterial(e.mat, inst); mats.set(e.mat, m); }
    const o = new T.Mesh(e.geo, m); o.matrixAutoUpdate = false; o.matrix.copy(e.rel); o.userData.glb = 1;
    return o;
  };
  for (const e of tpl.body) inst.body.add(mk(e));
  for (const w of tpl.wheels) {
    const piv = new T.Group(); piv.position.set(w.x, w.y, w.z);
    const spin = new T.Group(); piv.add(spin);
    for (const e of w.list) spin.add(mk(e));
    inst.wheels.push({ piv, w: spin, front: w.front });
  }
  return inst;
}
// 展示廳與車庫用的整台車（靜態）：先放替身，走進那個場館時才下載模型（glbWake），下載好就換掉
const glbWait = [];
function carObject(id, paint) {
  const c = CARS[id];
  const fbMesh = () => { const m = new T.Mesh(c.bike ? bikeFallbackGeo() : carKit(id, paint).build(), MAT.uber); m.userData.kit = 1; return m; };
  if (!c.glb) return fbMesh();
  const g = new T.Group(), fb = fbMesh(); g.add(fb);
  if (GLB_ON) {
    if (glbWait.length > 64) for (let i = glbWait.length - 1; i >= 0; i--) if (!glbWait[i].g.parent) glbWait.splice(i, 1);
    glbWait.push({ g, fb, id, paint });
  }
  return g;
}
function glbWake(scn) {
  for (let i = glbWait.length - 1; i >= 0; i--) {
    const e = glbWait[i]; let top = e.g; while (top.parent) top = top.parent;
    if (top !== scn && e.g.parent) continue;   // 還在別的場景裡；已經被拿掉的直接丟棄
    glbWait.splice(i, 1);
    if (!e.g.parent) continue;
    loadGLB(e.id).then(tpl => {
      if (!tpl || e.fb.parent !== e.g) return;
      const inst = glbInstance(tpl, e.paint);
      e.g.remove(e.fb); e.fb.geometry.dispose();
      e.g.add(inst.body); for (const w of inst.wheels) e.g.add(w.piv);
    });
  }
}
// 機車替身：Hanzo 的車身加兩個輪子合成一個幾何
let bikeFbGeo = null;
function bikeFallbackGeo() {
  if (!bikeFbGeo) {
    const k = new Kit(); const kk = hanzoKit(); k.pos.push(...kk.pos); k.nor.push(...kk.nor); k.col.push(...kk.col); k.mat.push(...kk.mat);
    for (const z of [.8, -.72]) wheel(k, 0, .33, z, .33, .14, 0x9aa0a6, 5);
    bikeFbGeo = k.build();
  }
  return bikeFbGeo.clone();
}
// 釋放 Kit 建的幾何與 GLB 實例的材質（GLB 的幾何與貼圖所有實例共用，不釋放）
function disposeKit(o) { o.traverse(m => { if (!m.isMesh) return; if (m.userData.kit) m.geometry.dispose(); else if (m.userData.glb) m.material.dispose(); }); }
