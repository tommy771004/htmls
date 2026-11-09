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

const _mats = new Map();
// toon(顏色, {emissive, emissiveIntensity, transparent, opacity, side})：相同參數共用材質
export function toon(color, o = {}) {
  const key = JSON.stringify([color, o]);
  let m = _mats.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
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
    m = new THREE.MeshBasicMaterial({ color, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: !o.transparent, side: o.side || THREE.FrontSide });
    _mats.set(key, m);
  }
  return m;
}

let _outlineMat = null;
export const OUTLINE_COLOR = 0x1b1226;
export function outlineMat() {
  if (_outlineMat) return _outlineMat;
  _outlineMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(OUTLINE_COLOR) }, uThick: { value: 0.035 } },
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
  });
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
// 平滑法線版本的方塊（描邊在角落不會裂開）
export function roundedBoxGeo(w, h, d, r = 0.06) {
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
export function sphere(r, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.SphereGeometry(r, o.seg || 16, o.seg ? o.seg * 0.75 : 12), color, o); m.position.set(x, y, z); return m; }
export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.CylinderGeometry(rt, rb, h, o.seg || 14), color, o); m.position.set(x, y, z); return m; }
export function cone(r, h, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.ConeGeometry(r, h, o.seg || 14), color, o); m.position.set(x, y, z); return m; }
export function capsule(r, len, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.CapsuleGeometry(r, len, 4, o.seg || 12), color, o); m.position.set(x, y, z); return m; }
export function torus(r, t, color, x = 0, y = 0, z = 0, o = {}) { const m = part(new THREE.TorusGeometry(r, t, 8, o.seg || 20), color, o); m.position.set(x, y, z); return m; }
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
