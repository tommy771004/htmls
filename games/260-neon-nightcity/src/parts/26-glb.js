// ═══ 實車模型：Sketchfab 的 GLB 經 tools/cars.mjs 處理成 assets/260/<id>.glb，規格在 assets/260/cars.json（打包進頁面） ═══
// 以網站伺服器開啟時才下載；以檔案開啟、或下載失敗，就一直用 proxy 指定的程式建模車身（機車用 Hanzo）頂替，頁面照樣能玩。
// 材質沿用 uber 的光照、霧、倒影裁切與遮擋淡出，底色、粗糙度、金屬、清漆與自發光改讀 GLB 的頂點屬性與貼圖。
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import GLB_SPEC from '../../../../assets/260/cars.json';

const GLB_ON = /^https?:$/.test(location.protocol);
const GLB_BASE = new URL('../assets/260/', location.href).href;
const glbReport = { on: GLB_ON, loaded: [], failed: [] };
const STARTER = 'ae86', STREET_BIKE = 'zx6r';   // 開場的座駕與停在路邊的機車；車行與車庫只賣實車模型

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
  // 第二批：日系、歐系、超跑、美式與機車
  ['ae86', { name: 'Toyota Sprinter Trueno (AE86)', cls: '1983 · 4A-G 後驅掀背', price: 38000, fb: 0xe8e8e4, proxy: 'kestrel', vmax: 62, eng: 10, grip: 8.4,
    tag: '黑白熊貓配色、可升降頭燈，門上印著豆腐店的字樣。馬力不大，但輕、後驅、好甩。原廠塗裝，不能換色。' }],
  ['rx7', { name: 'Mazda RX-7 (FD3S)', cls: '1992 · 13B 雙渦輪轉子', price: 85000, fb: 0x1f5fa8, proxy: 'ronin', vmax: 79, eng: 15.5, grip: 9.6,
    tag: '整台車只有曲線沒有直線，轉子引擎小到可以塞在前軸後面，前後配重五五開。' }],
  ['supra', { name: 'Toyota Supra (A80)', cls: '1993 · 2JZ 雙渦輪直六', price: 110000, fb: 0xd86a1a, proxy: 'ronin', vmax: 82, eng: 16, grip: 9.2,
    tag: '圓潤的長車頭、拱形尾翼與四顆圓尾燈。2JZ 引擎出了名的耐操，改到上千匹也不會散。' }],
  ['r34', { name: 'Nissan Skyline GT-R (R34)', cls: '1999 · RB26 雙渦輪四驅', price: 135000, fb: 0x1f4fb8, proxy: 'ronin', vmax: 80, eng: 16.5, grip: 9.8,
    tag: '方正的肩線、可調尾翼與四顆圓尾燈，ATTESA 四驅讓它在雨夜的街上照樣出得了彎。' }],
  ['nsx', { name: 'Honda NSX', cls: '1990 · 中置 V6', price: 140000, fb: 0xf0f0ee, proxy: 'meridian', vmax: 80, eng: 15, grip: 9.8,
    tag: '全鋁車身、戰鬥機座艙般的低矮視野，中置 V6 轉到八千轉。這台換了一組粉紫色的網狀輪框。' }],
  ['r35', { name: 'Nissan GT-R (R35) 寬體', cls: '雙渦輪 V6 四驅 · 寬體套件', price: 180000, fb: 0x6a6e74, proxy: 'ronin', vmax: 86, eng: 18, grip: 10.2,
    tag: '外擴的鉚釘葉子板、前下巴與高腳尾翼。四驅雙離合起步，紅燈一跳綠就已經在下個路口了。' }],
  ['p930', { name: 'Porsche 911 Turbo (930)', cls: '1975 · 水平對臥六缸渦輪', price: 160000, fb: 0x1f5fa8, proxy: 'kanto', vmax: 78, eng: 15, grip: 8.6,
    tag: '鯨尾尾翼、外擴後葉子板，七〇年代的渦輪遲滯：先是什麼都沒有，然後一口氣全部來。' }],
  ['rwb', { name: 'Porsche 911 RAUH-Welt', cls: '964 · RWB 寬體改裝', price: 260000, fb: 0xf0f0ee, proxy: 'kanto', vmax: 82, eng: 16.5, grip: 9.8,
    tag: '手工切開的葉子板、鉚上去的寬體與兩層的巨大尾翼，彩虹條紋的復古賽車彩繪。原廠彩繪，不能換色。' }],
  ['e34', { name: 'BMW 5 系列 (E34) 低趴', cls: '1990 · 直六四門房車', price: 28000, fb: 0x1f5fa8, proxy: 'lucerna', vmax: 66, eng: 11, grip: 8.6,
    tag: '九〇年代的四門房車，降到幾乎貼地、外傾的網狀輪框。整間車行最便宜的一台實車。' }],
  ['evo190', { name: 'Mercedes-Benz 190E EVO', cls: '四門房車 · 房車賽認證版', price: 120000, fb: 0x1a1b1e, proxy: 'lucerna', vmax: 76, eng: 14.5, grip: 9.4,
    tag: '為了房車賽而生的四門車：寬體、可調尾翼與十六氣門直四。黑色原廠塗裝，不能換色。' }],
  ['m4csl', { name: 'BMW M4 CSL', cls: '2023 G82 · 輕量化直六', price: 190000, fb: 0x1f5fa8, proxy: 'ronin', vmax: 84, eng: 18, grip: 10.2,
    tag: '拆掉後座、換上碳纖維引擎蓋與車頂，比一般 M4 輕一百公斤，雷射尾燈在夜裡是兩道紅色的刀。' }],
  ['chall', { name: 'Dodge Challenger SRT', cls: '機械增壓 HEMI V8', price: 72000, fb: 0x4a2a7a, proxy: 'bulldog', vmax: 74, eng: 16, grip: 7.8,
    tag: '紫色車身、消光黑引擎蓋，增壓器的嘯聲隔兩條街都聽得到。後輪很愛冒煙。原廠塗裝，不能換色。' }],
  ['police', { name: '退役警車', cls: '前置 V8 巡邏車', price: 45000, fb: 0x1a1b1e, proxy: 'lucerna', vmax: 70, eng: 13, grip: 8.2,
    tag: '從市警局標售出來的巡邏車，推撞桿、警示燈條和車頂編號都還在。開出去路人會自動讓路。原廠塗裝，不能換色。' }],
  ['zr1', { name: 'Chevrolet Corvette ZR1', cls: '2019 C7 · 增壓 V8', price: 210000, fb: 0x1f5fa8, proxy: 'mamba', vmax: 90, eng: 18.5, grip: 9.8,
    tag: '引擎蓋中間開了一個洞讓增壓器探出頭來，後面是高腳碳纖維尾翼。美國最後一代前置引擎的 Corvette。' }],
  ['f40', { name: 'Ferrari F40', cls: '1987 · 雙渦輪 V8 中置', price: 900000, fb: 0xc8141c, proxy: 'saetta', vmax: 90, eng: 18.5, grip: 9.6,
    tag: '壓克力百葉後窗、拉索開門、沒有音響也沒有地毯。創辦人生前最後一台親自批准的車。' }],
  ['sf90', { name: 'Ferrari SF90 XX Stradale', cls: '2024 · 插電 V8 四驅', price: 980000, fb: 0xc8141c, proxy: 'furia', vmax: 98, eng: 21, grip: 10.8,
    tag: '一千多匹的油電動力、前軸兩顆電動馬達，車尾一片固定式大尾翼。整間車行加速最暴力的一台。' }],
  ['p1', { name: 'McLaren P1', cls: '2013 · 油電 V8 超跑', price: 1100000, fb: 0xe8782a, proxy: 'halcyon', vmax: 100, eng: 21.5, grip: 10.6,
    tag: '油電三雄之一，車身像被風吹出來的一層皮，賽道模式下車身會降低、尾翼會升起。' }],
  ['zx6r', { name: 'Kawasaki Ninja ZX-6R', cls: '636 cc 四缸仿賽', price: 16000, fb: 0x3aa83a, proxy: 'hanzo', bike: true, vmax: 76, eng: 15.5, grip: 7.8, seat: [-.06, -.2],
    tag: '萊姆綠的中量級仿賽，轉速拉到一萬六。比千 cc 好駕馭，在窄巷裡也鑽得進去。' }],
  ['v4', { name: 'Ducati Panigale V4', cls: '1100 cc V4 超跑機車', price: 32000, fb: 0xc8141c, proxy: 'hanzo', bike: true, vmax: 84, eng: 18.5, grip: 7.6, seat: [-.06, -.2],
    tag: '從 MotoGP 賽車下放的 V4 引擎、單搖臂與紅色車殼。兩百多匹，比很多跑車都快。' }],
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
