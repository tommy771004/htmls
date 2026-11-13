// 卡通渲染工具組：三階 toon 材質、法線外擴描邊、基本形體、文字貼片。
// THREE 是全域變數（頁面先載入 three 再執行 bundle），所以本檔與所有使用它的檔案都不能在頂層呼叫 THREE。
/* global THREE */

let _grad = null;
export function gradientMap() {
  if (_grad) return _grad;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  _grad = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.generateMipmaps = false;
  _grad.needsUpdate = true;
  return _grad;
}

// ── 共用外觀 ─────────────────────────────────────────────
// 所有 toon／發光／自訂著色器共用的 uniform，由 view 依關卡主題與畫質設定（setLook）。
//   shade 暗面色偏（乘在固有色上，取代原本的灰階變暗）、rim 輪廓光、spec 高光強度、
//   boost 發光體倍率（HDR 後製開啟時 >1，bloom 只吃發光體）、lin 輸出到線性緩衝時為 1、ink 描邊色。
export const LOOK = { shade: { value: null }, rim: { value: null }, rimK: { value: 0.5 }, spec: { value: 0.55 }, boost: { value: 1 }, lin: { value: 0 }, ink: { value: null } };
export const LOOK_DEFAULT = { shade: [0.47, 0.43, 0.6], rim: [1, 0.97, 0.9], rimK: 0.5, spec: 0.55, ink: 0x1b1226 };
function look() {
  if (!LOOK.shade.value) { LOOK.shade.value = new THREE.Color().fromArray(LOOK_DEFAULT.shade); LOOK.rim.value = new THREE.Color().fromArray(LOOK_DEFAULT.rim); LOOK.ink.value = new THREE.Color(LOOK_DEFAULT.ink); }
  return LOOK;
}
// setLook({ shade:[r,g,b]|Color, rim, rimK, spec, boost, lin, ink })：只改有給的欄位
export function setLook(o = {}) {
  const L = look();
  for (const k of ['shade', 'rim', 'ink']) if (o[k] != null) { if (Array.isArray(o[k])) L[k].value.fromArray(o[k]); else L[k].value.set(o[k]); }
  for (const k of ['rimK', 'spec', 'boost', 'lin']) if (o[k] != null) L[k].value = o[k];
}
export function getLook() { const L = look(); return { shade: L.shade.value.toArray(), rim: L.rim.value.toArray(), ink: L.ink.value.getHex(), rimK: L.rimK.value, spec: L.spec.value, boost: L.boost.value, lin: L.lin.value }; }

// 發光體的 HDR 倍率：越鮮豔拉越多，白色只拉一點（不讓白紙、眼白整片發光）
export const GLSL_BOOST = `
uniform float uBoost;
vec3 boost280(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float sat = mx > 1e-4 ? (mx - mn) / mx : 0.0;
  return c * (1.0 + (uBoost - 1.0) * (0.22 + 0.78 * sat));
}`;
// 卡通著色：抗鋸齒的三階色階、暗面色偏、彎曲表面上的風格化高光與天光勾邊（平面不吃，地板牆面不會整片發亮）
const GLSL_TOON = `
uniform vec3 uShade; uniform vec3 uRim; uniform float uRimK; uniform float uSpec;
float toonBand(float d) {
  float fw = fwidth(d) * 0.9 + 0.006;
  #ifdef TOON_SOFT
    return 0.55 + 0.45 * smoothstep(0.4 - fw, 0.4 + fw, d);
  #else
    return 0.5 * smoothstep(-0.34 - fw, -0.34 + fw, d) + 0.5 * smoothstep(0.3 - fw, 0.3 + fw, d);
  #endif
}
vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) { return vec3(toonBand(dot(normal, lightDirection))); }
float curved280(vec3 n) { return smoothstep(0.0004, 0.004, length(fwidth(n))); }`;
const GLSL_TOON_LIGHTS = `
varying vec3 vViewPosition;
struct ToonMaterial { vec3 diffuseColor; };
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  float band = toonBand(dot(geometryNormal, directLight.direction));
  reflectedLight.directDiffuse += mix(uShade, vec3(1.0), band) * directLight.color * BRDF_Lambert(material.diffuseColor);
  vec3 c = material.diffuseColor;
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float gloss = mix(1.0, 0.3, smoothstep(0.1, 0.5, mx - mn));
  float sp = pow(max(dot(geometryNormal, normalize(directLight.direction + geometryViewDir)), 0.0), 42.0);
  float fw = fwidth(sp) + 0.02;
  sp = smoothstep(0.45 - fw, 0.45 + fw, sp) * 0.65 + sp * 0.35;
  reflectedLight.directDiffuse += directLight.color * (sp * gloss * uSpec * band * 0.15 * curved280(geometryNormal));
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
  float fres = 1.0 - max(dot(geometryNormal, geometryViewDir), 0.0);
  float fw = fwidth(fres) + 0.015;
  float rim = smoothstep(0.64 - fw, 0.64 + fw, fres);
  float up = clamp(dot(geometryNormal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)) * 0.7 + 0.6, 0.0, 1.0);
  reflectedLight.indirectDiffuse += uRim * (rim * up * uRimK * curved280(geometryNormal)) * (0.3 + 0.7 * material.diffuseColor);
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon`;
// 幫 MeshToonMaterial 掛上共用著色。extra(shader) 可再追加自己的修改（地塊）；key 要能區分不同的 extra。
// 材質被 clone() 之後 onBeforeCompile 不會跟著複製，要用 cloneMat()。
export function toonify(m, extra = null, key = '') {
  if (!m || !m.isMeshToonMaterial) return m;
  const L = look(), soft = m.gradientMap === null;
  m.userData.look = { extra, key };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uShade: L.shade, uRim: L.rim, uRimK: L.rimK, uSpec: L.spec, uBoost: L.boost });
    sh.fragmentShader = (soft ? '#define TOON_SOFT\n' : '') + sh.fragmentShader
      .replace('#include <gradientmap_pars_fragment>', GLSL_TOON + GLSL_BOOST)
      .replace('#include <lights_toon_pars_fragment>', GLSL_TOON_LIGHTS)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = boost280(totalEmissiveRadiance);');
    if (extra) extra(sh);
  };
  m.customProgramCacheKey = () => 'toon280' + (soft ? 's' : '') + key;
  return m;
}
// 不受光的純色／貼圖材質：沒有貼圖的當成發光體，跟著 boost 進 bloom
export function glowify(m) {
  if (!m || !m.isMeshBasicMaterial || m.map || m.userData.look) return m;
  const L = look();
  m.userData.look = { glow: true };
  m.onBeforeCompile = sh => {
    sh.uniforms.uBoost = L.boost;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + GLSL_BOOST)
      .replace('#include <opaque_fragment>', 'outgoingLight = boost280(outgoingLight);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'glow280';
  return m;
}
// 自己寫 gl_FragColor、沒有 colorspace_fragment 的 ShaderMaterial：畫到線性緩衝時把數值轉回線性，畫面顏色才跟直接輸出時一樣。
// glow=true 另外吃發光倍率。
export function rawOut(m, glow = false) {
  const L = look();
  m.uniforms.uLin = L.lin;
  if (glow) m.uniforms.uBoost = L.boost;
  const i = m.fragmentShader.lastIndexOf('}');
  m.fragmentShader = 'uniform float uLin;' + (glow ? GLSL_BOOST : '') + '\n' + m.fragmentShader.slice(0, i)
    + '\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(2.2)), uLin);' + (glow ? '\n  gl_FragColor.rgb = boost280(gl_FragColor.rgb);' : '') + '\n}' + m.fragmentShader.slice(i + 1);
  return m;
}
// clone 後補回共用著色
export function cloneMat(m) {
  const f = m.clone(), lk = m.userData.look;
  f.userData = { ...m.userData };
  if (m.isMeshToonMaterial) { f.userData.look = null; toonify(f, lk ? lk.extra : null, lk ? lk.key : ''); }
  else if (m.isMeshBasicMaterial && lk) { f.userData.look = null; glowify(f); }
  return f;
}
// 走訪整棵樹，把沒經過 kit 建立的 toon／純色材質也掛上共用著色（要在第一次渲染之前呼叫）
export function upgradeTree(root) {
  root.traverse(o => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.userData.look) continue;
      if (m.isMeshToonMaterial) toonify(m);
      else if (m.isMeshBasicMaterial && !m.map && m.visible) glowify(m);
    }
  });
  return root;
}

// 幾何細分倍率：圓球、圓柱、膠囊的預設段數（低畫質檔在建模前呼叫 setDetail(1) 回到原本的段數）
let DETAIL = 1.5;
export function setDetail(k) { DETAIL = k; }
export const seg = (n) => Math.max(3, Math.round(n * DETAIL));

const _mats = new Map();
// toon(顏色, {emissive, emissiveIntensity, transparent, opacity, side})：相同參數共用材質
export function toon(color, o = {}) {
  const key = JSON.stringify([color, o]);
  let m = _mats.get(key);
  if (!m) {
    m = toonify(new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() }));
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    if (o.transparent) { m.transparent = true; m.opacity = o.opacity ?? 0.6; m.depthWrite = false; }
    if (o.side) m.side = o.side;
    _mats.set(key, m);
  }
  return m;
}
// 不受光的純色（霓虹、發光體）
export function flat(color, o = {}) {
  const key = 'flat' + JSON.stringify([color, o]);
  let m = _mats.get(key);
  if (!m) {
    m = glowify(new THREE.MeshBasicMaterial({ color, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: !o.transparent, side: o.side || THREE.FrontSide }));
    _mats.set(key, m);
  }
  return m;
}

let _outlineMat = null;
export const OUTLINE_COLOR = 0x1b1226;
export function outlineMat() {
  if (_outlineMat) return _outlineMat;
  _outlineMat = rawOut(new THREE.ShaderMaterial({
    uniforms: { uColor: look().ink, uThick: { value: 0.035 } },
    vertexShader: `
      uniform float uThick;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        // 依距離放大描邊，遠近粗細一致
        float k = uThick * clamp(-mv.z / 16.0, 0.6, 2.2);
        mv.xyz += n * k;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  }));
  return _outlineMat;
}

// 建立帶描邊的網格。o.outline=false 可關閉；o.mat 可直接給材質
export function part(geo, color, o = {}) {
  const mesh = new THREE.Mesh(geo, o.mat || toon(color, o));
  mesh.castShadow = o.shadow !== false;
  mesh.receiveShadow = !!o.receive;
  if (o.outline !== false) {
    const ol = new THREE.Mesh(geo, outlineMat());
    ol.name = 'outline';
    ol.raycast = () => {};
    mesh.add(ol);
  }
  return mesh;
}
// 圓角方塊：每面中間是平的（法線就是面法線）、外圈一段倒角，法線用解析式算，
// 所以大面不會有「枕頭狀」的漸層，倒角會吃到高光與勾邊；相鄰面在邊上的位置與法線一致，描邊不會裂開。
export function roundedBoxGeo(w, h, d, r = 0.06) {
  if (DETAIL < 1.3) return roundedBoxGeoLo(w, h, d, r);
  const hx = w / 2, hy = h / 2, hz = d / 2;
  r = Math.max(1e-4, Math.min(r, hx, hy, hz));
  const ix = hx - r, iy = hy - r, iz = hz - r;
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const rm = (v, half, inner) => (Math.abs(v) > half * 0.9 ? Math.sign(v) * half : Math.sign(v) * inner);
  const cl = (v, a) => (v < -a ? -a : v > a ? a : v);
  // 每面 16 個頂點，順序 +x −x +y −y +z −z；uv 的兩軸各對應的邊長
  const US = [d, d, w, w, w, w], VS = [h, h, d, d, h, h];
  const ru = (t, size) => (t < 0.01 ? 0 : t > 0.99 ? 1 : t < 0.5 ? r / size : 1 - r / size);
  for (let i = 0; i < pos.count; i++) {
    const x = rm(pos.getX(i), hx, ix), y = rm(pos.getY(i), hy, iy), z = rm(pos.getZ(i), hz, iz);
    const cx = cl(x, ix), cy = cl(y, iy), cz = cl(z, iz);
    let nx = x - cx, ny = y - cy, nz = z - cz;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    pos.setXYZ(i, cx + nx * r, cy + ny * r, cz + nz * r);
    nor.setXYZ(i, nx, ny, nz);
    const f = Math.min(5, (i / 16) | 0);
    uv.setXY(i, ru(uv.getX(i), US[f]), ru(uv.getY(i), VS[f]));
  }
  return g;
}

// 低面數版本（每面 2×2、法線取平均）：遠景佈景用，面數是上面的四成
export function roundedBoxGeoLo(w, h, d, r = 0.06) {
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const pos = g.attributes.position, v = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const c = new THREE.Vector3(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    const n = v.clone().sub(c);
    if (n.lengthSq() > 0) v.copy(c.add(n.normalize().multiplyScalar(r)));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// 便利形體（位置 x,y,z 為中心）
export function box(w, h, d, color, x = 0, y = 0, z = 0, o = {}) { const m = part(roundedBoxGeo(w, h, d, o.r ?? Math.min(w, h, d) * 0.12), color, o); m.position.set(x, y, z); return m; }
export function sphere(r, color, x = 0, y = 0, z = 0, o = {}) { const s = seg(o.seg || 16); const m = part(new THREE.SphereGeometry(r, s, Math.round(s * 0.75)), color, o); m.position.set(x, y, z); return m; }
export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.CylinderGeometry(rt, rb, h, seg(o.seg || 14)), color, o); m.position.set(x, y, z); return m; }
export function cone(r, h, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.ConeGeometry(r, h, seg(o.seg || 14)), color, o); m.position.set(x, y, z); return m; }
export function capsule(r, len, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.CapsuleGeometry(r, len, seg(4), seg(o.seg || 12)), color, o); m.position.set(x, y, z); return m; }
export function torus(r, t, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.TorusGeometry(r, t, seg(8), seg(o.seg || 20)), color, o); m.position.set(x, y, z); return m; }
export function group(...kids) { const g = new THREE.Group(); for (const k of kids) if (k) g.add(k); return g; }

// 文字貼片（招牌、標語）。回傳平面網格，寬 w 公尺，高依字數比例
const _texCache = new Map();
export function textTexture(text, o = {}) {
  const key = JSON.stringify([text, o]);
  if (_texCache.has(key)) return _texCache.get(key);
  const fs = o.size || 64, pad = fs * 0.35;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `${o.weight || 900} ${fs}px ${o.font || '"Arial Black", "Helvetica Neue", "PingFang TC", "Noto Sans TC", sans-serif'}`;
  ctx.font = font;
  const lines = String(text).split('\n');
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
  c.width = Math.ceil(tw + pad * 2); c.height = Math.ceil(fs * 1.25 * lines.length + pad * 2);
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, c.width, c.height); }
  lines.forEach((l, i) => {
    const y = pad + fs * 1.25 * (i + 0.5);
    if (o.stroke) { ctx.lineWidth = fs * 0.14; ctx.strokeStyle = o.stroke; ctx.strokeText(l, c.width / 2, y); }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(l, c.width / 2, y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const r = { tex: t, aspect: c.width / c.height };
  _texCache.set(key, r);
  return r;
}
export function textPlane(text, w, o = {}) {
  const { tex, aspect } = textTexture(text, o);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), new THREE.MeshBasicMaterial({ map: tex, transparent: !o.bg, side: o.double ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !!o.bg }));
  return m;
}

// 讓整個群組的網格投射陰影
export function shadows(g, cast = true, receive = false) {
  g.traverse(o => { if (o.isMesh && o.name !== 'outline') { o.castShadow = cast; o.receiveShadow = receive; } });
  return g;
}
