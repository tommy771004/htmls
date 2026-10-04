// 六名英雄的網格：Blender 腳本（blender/build_heroes.py）建模、A 字綁定姿勢、量化後烘成 models-baked.js，這裡只解碼。
// 身體是一張蒙皮網格（骨頭順序見 models.js 的 BONE_ORDER＋擺動鏈），頭（含髮型）是掛在 head 骨的剛體網格；臉是畫在 canvas 上的貼花。
import * as THREE from 'three';
import { unzlibSync } from 'three/examples/jsm/libs/fflate.module.js';
import { BAKED } from './models-baked.js';
// 比例（FighterZ 的英雄比例：約 5.6 頭身、寬肩）
export const PROPS = {
  goku: { H: 1.85, hr: 0.165, L: 0.88, sw: 0.265, chest: [0.232, 0.3, 0.168], waist: 0.152, arm: 0.076, fore: 0.069, fist: 0.096, thigh: 0.118, shin: 0.084, hip: 0.124 },
  vegeta: { H: 1.72, hr: 0.157, L: 0.81, sw: 0.255, chest: [0.226, 0.29, 0.162], waist: 0.14, arm: 0.074, fore: 0.067, fist: 0.093, thigh: 0.112, shin: 0.081, hip: 0.116 },
  trunks: { H: 1.86, hr: 0.157, L: 0.9, sw: 0.24, chest: [0.21, 0.28, 0.15], waist: 0.132, arm: 0.066, fore: 0.06, fist: 0.087, thigh: 0.104, shin: 0.077, hip: 0.112 },
  piccolo: { H: 2.12, hr: 0.168, L: 1.02, sw: 0.285, chest: [0.252, 0.31, 0.172], waist: 0.15, arm: 0.077, fore: 0.071, fist: 0.1, thigh: 0.122, shin: 0.088, hip: 0.126 },
  frieza: { H: 1.55, hr: 0.155, L: 0.7, sw: 0.185, chest: [0.172, 0.24, 0.13], waist: 0.092, arm: 0.052, fore: 0.049, fist: 0.068, thigh: 0.082, shin: 0.06, hip: 0.098 },
  a18: { H: 1.72, hr: 0.151, L: 0.86, sw: 0.188, chest: [0.17, 0.26, 0.13], waist: 0.11, arm: 0.048, fore: 0.044, fist: 0.064, thigh: 0.09, shin: 0.066, hip: 0.116 },
};

const cache = new Map();
export function buildHeroParts(id, d) {
  if (cache.has(id)) return cache.get(id);
  const out = decodeHero(id, d);
  cache.set(id, out);
  return out;
}

// 每個網格：表頭 n、ni、flags（1＝蒙皮、2＝32 位元索引）、lo[3]、sz[3]，接著是欄位式串流（每欄補齊到 4 位元組）：
// 位置 x、y、z（u16 差分）、法線 2 欄（i8 八面體）、pal、mat、ao、ol（外框倍率×100），蒙皮時再 4 欄骨索引＋4 欄權重，最後是索引（差分）。
function decodeHero(id, d) {
  const B = BAKED[id];
  if (!B) throw new Error('沒有烘焙的英雄網格：' + id);
  const bin = atob(B.data), z = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) z[i] = bin.charCodeAt(i);
  const buf = unzlibSync(z);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const pal = B.pal.map((h) => (h < 0 ? null : new THREE.Color().setHex(h)));
  let o = 0;
  const pad = () => { o += (4 - (o % 4)) % 4; };
  const u8 = (n) => { const a = buf.subarray(o, o + n); o += n; pad(); return a; };
  const i8 = (n) => { const a = new Int8Array(buf.buffer, buf.byteOffset + o, n); o += n; pad(); return a; };
  const out = { hair: {}, faceRect: B.faceRect };
  for (const name of B.names) {
    const n = dv.getUint32(o, true), ni = dv.getUint32(o + 4, true), flags = dv.getUint32(o + 8, true);
    const lo = [0, 1, 2].map((i) => dv.getFloat32(o + 12 + i * 4, true)), sz = [0, 1, 2].map((i) => dv.getFloat32(o + 24 + i * 4, true));
    o += 36;
    const skinned = flags & 1, big = flags & 2;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), mat = new Float32Array(n), ao = new Float32Array(n), ol = new Float32Array(n);
    for (let k = 0; k < 3; k++) {
      let q = 0;
      for (let v = 0; v < n; v++) { q = (q + dv.getUint16(o + v * 2, true)) & 0xffff; pos[v * 3 + k] = lo[k] + (q / 65535) * sz[k]; }
      o += n * 2; pad();
    }
    const nx = i8(n), ny = i8(n), pa = u8(n), ma = u8(n), aa = u8(n), oa = u8(n);
    for (let v = 0; v < n; v++) {
      let x = nx[v] / 127, y = ny[v] / 127, zz = 1 - Math.abs(x) - Math.abs(y);
      if (zz < 0) { const ox = x; x = (1 - Math.abs(y)) * Math.sign(ox || 1); y = (1 - Math.abs(ox)) * Math.sign(y || 1); }
      const l = Math.hypot(x, y, zz) || 1; nor[v * 3] = x / l; nor[v * 3 + 1] = y / l; nor[v * 3 + 2] = zz / l;
      const c = pal[pa[v]];
      if (c) { col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; }
      mat[v] = ma[v]; ao[v] = aa[v] / 255; ol[v] = oa[v] / 100;
    }
    let si = null, sw = null;
    if (skinned) {
      si = new Uint8Array(n * 4); sw = new Uint8Array(n * 4);
      for (let k = 0; k < 4; k++) { const a = u8(n); for (let v = 0; v < n; v++) si[v * 4 + k] = a[v]; }
      for (let k = 0; k < 4; k++) { const a = u8(n); for (let v = 0; v < n; v++) sw[v * 4 + k] = a[v]; }
    }
    const idx = big ? new Uint32Array(ni) : new Uint16Array(ni);
    let q = 0;
    for (let i = 0; i < ni; i++) { q = big ? (q + dv.getUint32(o + i * 4, true)) >>> 0 : (q + dv.getUint16(o + i * 2, true)) & 0xffff; idx[i] = q; }
    o += ni * (big ? 4 : 2); pad();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(mat, 1));
    g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); g.setAttribute('aOl', new THREE.BufferAttribute(ol, 1));
    if (skinned) { g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true)); }
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    if (name.startsWith('hair_')) out.hair[name.slice(5)] = g;
    else out[name] = g;
  }
  out.faces = { base: drawFace(id, false, d.hr) };
  if (out.hair.ssj) out.faces.ssj = drawFace(id, true, d.hr);
  return out;
}

/* ---------------- 動畫質感材質 ---------------- */
// 自帶光照：右上暖色主光、清楚的明暗交界、柔和第三階、冷色邊緣光、髮絲高光帶、亮面點高光、臉部貼花。支援蒙皮。
// aMat：0 一般、1 頭髮、2 亮面、3 發光、4 皮膚、5 隊伍色
const VS = `
attribute float aMat; attribute float aAO;
varying vec3 vCol; varying float vMat; varying float vAO; varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec3 vObjN;
#include <common>
#include <skinning_pars_vertex>
void main(){
  vCol = color; vMat = aMat; vAO = aAO; vObj = position; vObjN = normal;
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vN = normalize(mat3(modelMatrix) * objectNormal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FS = `
uniform vec3 uKey; uniform vec3 uKeyCol; uniform vec3 uShadeCol; uniform vec3 uRimCol; uniform float uFlash; uniform vec3 uTeam; uniform float uSkinBias;
uniform sampler2D uFace; uniform float uHasFace; uniform vec4 uFaceRect;
varying vec3 vCol; varying float vMat; varying float vAO; varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec3 vObjN;
void main(){
  vec3 N = normalize(vN), V = normalize(vV), L = normalize(uKey);
  float mt = floor(vMat + 0.5);
  vec3 base = mt > 4.5 ? uTeam : vCol;
  // 臉部貼花（正面半球，以頭部物件座標平面投影）
  if (uHasFace > 0.5) {
    vec2 uv = (vObj.xy - uFaceRect.xy) / uFaceRect.zw + 0.5;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 && mt > 3.5 && mt < 4.5) {
      vec4 t = texture2D(uFace, uv);
      float m = smoothstep(0.12, 0.42, normalize(vObjN).z) * t.a;
      base = mix(base, t.rgb, m);
    }
  }
  float ndl = dot(N, L);
  if (mt > 3.5 && mt < 4.5) ndl += uSkinBias; // 臉：明暗交界往暗側推，臉大多是亮面
  float ao = vAO;
  // 遮蔽把明暗交界往亮部推：凹處更早進入陰影
  float lit = smoothstep(-0.03, 0.04, ndl - (1.0 - ao) * 0.32);
  float top = smoothstep(0.55, 0.62, ndl) * ao;
  vec3 shadeCol = mt > 3.5 && mt < 4.5 ? uShadeCol * vec3(1.06, 0.92, 0.9) : uShadeCol; // 皮膚的暗部偏暖
  vec3 c = mix(base * shadeCol, base * uKeyCol, lit);
  c += base * top * 0.1;
  c *= mix(0.8, 1.0, smoothstep(0.1, 0.7, ao));
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c += uRimCol * rim * (0.35 + 0.3 * lit) * ao;
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  // 髮：沿頭形的一圈光澤帶
  if (mt > 0.5 && mt < 1.5) { float ny = N.y; c += (base * 0.9 + vec3(0.07)) * smoothstep(0.5, 0.56, ny) * (1.0 - smoothstep(0.7, 0.76, ny)) * 0.5 * (0.4 + 0.6 * lit) * smoothstep(0.3, 0.6, ao); c -= c * rim * 0.4; }
  // 亮面：小而銳利的點高光
  if (mt > 1.5 && mt < 2.5) c += vec3(1.0) * smoothstep(0.955, 0.97, nh) * 0.6;
  if (mt > 2.5 && mt < 3.5) c = base * 1.2;
  c = mix(c, vec3(1.0), uFlash);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const KEY_DIR = new THREE.Vector3(0.52, 0.8, 0.3).normalize(); // 右上、略偏鏡頭側
export function heroMaterial({ face = null, faceRect = null, team = 0xffffff, skinBias = 0 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, vertexColors: true,
    uniforms: {
      uKey: { value: KEY_DIR }, uKeyCol: { value: new THREE.Color(1.08, 1.0, 0.92) }, uShadeCol: { value: new THREE.Color(0.58, 0.56, 0.72) },
      uRimCol: { value: new THREE.Color(0.55, 0.72, 0.95) }, uFlash: { value: 0 }, uTeam: { value: new THREE.Color(team) }, uSkinBias: { value: skinBias },
      uFace: { value: face }, uHasFace: { value: face ? 1 : 0 }, uFaceRect: { value: new THREE.Vector4(...(faceRect || [0, 0, 1, 1])) },
    },
  });
}

/* ---------------- 臉（canvas 貼花） ---------------- */
// 畫布座標：中心對應 faceRect 的中心，邊長 = 1.9 hr；上方是頭頂
const FACE = {
  goku: { iris: '#2a1d16', irisL: '#4a3426', brow: '#1a1614', browTilt: 0.18, eyeW: 0.3, eyeH: 0.17, eyeX: 0.36, eyeY: 0.06, sharp: 0.55, mouth: 'grin' },
  vegeta: { iris: '#20160f', irisL: '#3a2a20', brow: '#1a1614', browTilt: 0.42, eyeW: 0.29, eyeH: 0.13, eyeX: 0.35, eyeY: 0.06, sharp: 0.9, mouth: 'frown' },
  trunks: { iris: '#3b5fb5', irisL: '#7fa2e6', brow: '#8a74c0', browTilt: 0.12, eyeW: 0.3, eyeH: 0.17, eyeX: 0.36, eyeY: 0.06, sharp: 0.5, mouth: 'flat' },
  piccolo: { iris: '#1a120c', irisL: '#1a120c', brow: '#2f6a1e', browTilt: 0.45, eyeW: 0.3, eyeH: 0.13, eyeX: 0.36, eyeY: 0.08, sharp: 0.95, mouth: 'frown', noPupil: true, sclera: '#fffbe8' },
  frieza: { iris: '#d0203a', irisL: '#ff6a7a', brow: null, browTilt: 0, eyeW: 0.3, eyeH: 0.16, eyeX: 0.35, eyeY: 0.07, sharp: 0.85, mouth: 'smirk', lips: '#3a1838', lid: '#4a1a40' },
  a18: { iris: '#4c98d6', irisL: '#a6d6ff', brow: '#c9a24a', browTilt: 0.05, eyeW: 0.32, eyeH: 0.2, eyeX: 0.36, eyeY: 0.06, sharp: 0.3, mouth: 'lips', lashes: true },
};
function drawFace(id, ssj, hr) {
  if (typeof document === 'undefined') return null;
  const f = { ...FACE[id] };
  if (ssj) { f.iris = '#1a9a8a'; f.irisL = '#7ff0dc'; f.brow = '#d8a82a'; f.browTilt += 0.12; f.sharp += 0.15; }
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  const S = N; // 單位：hr*1.9 → N
  const X = (u) => N / 2 + (u / 1.9) * S, Y = (v) => N / 2 - ((v + 0.12) / 1.9) * S; // v 以 hr 為單位、相對頭心
  const ink = f.lid || '#1a110c';
  for (const sx of [-1, 1]) {
    const ex = X(sx * f.eyeX), ey = Y(f.eyeY), ew = (f.eyeW / 1.9) * S, eh = (f.eyeH / 1.9) * S;
    g.save(); g.translate(ex, ey); g.scale(sx, 1);
    // 眼形：內眼角低、外眼角上揚（杏仁形）
    const shape = () => {
      g.beginPath();
      g.moveTo(-ew * 0.55, eh * 0.15);
      g.bezierCurveTo(-ew * 0.35, -eh * (0.75 + f.sharp * 0.1), ew * 0.35, -eh * (0.85 + f.sharp * 0.25), ew * 0.6, -eh * (0.2 + f.sharp * 0.45));
      g.bezierCurveTo(ew * 0.45, eh * 0.55, -ew * 0.3, eh * 0.65, -ew * 0.55, eh * 0.15);
      g.closePath();
    };
    shape(); g.fillStyle = f.sclera || '#fdfbf6'; g.fill();
    g.save(); shape(); g.clip();
    if (!f.noPupil) {
      // 虹膜：上深下亮的漸層、瞳孔、兩點反光
      const ir = eh * 0.95, ix = -ew * 0.02, iy = eh * 0.08;
      const gr = g.createLinearGradient(0, iy - ir, 0, iy + ir);
      gr.addColorStop(0, f.iris); gr.addColorStop(1, f.irisL);
      g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, ir * 0.78, ir, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(10,6,4,.85)'; g.beginPath(); g.ellipse(ix, iy + ir * 0.1, ir * 0.36, ir * 0.48, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ix + ir * 0.28, iy - ir * 0.38, ir * 0.22, ir * 0.26, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(ix - ir * 0.3, iy + ir * 0.45, ir * 0.1, ir * 0.1, 0, 0, Math.PI * 2); g.fill();
    }
    // 上眼瞼的陰影
    g.fillStyle = 'rgba(80,50,40,.25)'; g.fillRect(-ew, -eh * 2, ew * 2, eh * 1.55);
    g.restore();
    // 上眼線：粗、外側延伸上挑
    g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = eh * 0.32;
    g.beginPath(); g.moveTo(-ew * 0.6, eh * 0.05);
    g.bezierCurveTo(-ew * 0.35, -eh * (0.82 + f.sharp * 0.1), ew * 0.35, -eh * (0.92 + f.sharp * 0.25), ew * 0.72, -eh * (0.25 + f.sharp * 0.5));
    g.stroke();
    if (f.lashes) { g.lineWidth = eh * 0.16; g.beginPath(); g.moveTo(ew * 0.55, -eh * 0.5); g.lineTo(ew * 0.85, -eh * 0.65); g.moveTo(ew * 0.62, -eh * 0.25); g.lineTo(ew * 0.88, -eh * 0.25); g.stroke(); }
    // 下眼線（細、只畫外側）
    g.lineWidth = eh * 0.1; g.beginPath(); g.moveTo(ew * 0.1, eh * 0.55); g.quadraticCurveTo(ew * 0.42, eh * 0.45, ew * 0.58, -eh * 0.05); g.stroke();
    // 眉毛：粗而銳利，往眉心壓低
    if (f.brow) {
      g.fillStyle = f.brow;
      const by = -eh * 1.55, tilt = f.browTilt;
      g.beginPath();
      g.moveTo(-ew * 0.62, by + eh * (0.25 + tilt * 1.6));
      g.quadraticCurveTo(0, by - eh * 0.55 + eh * tilt * 0.6, ew * 0.75, by - eh * (0.2 + tilt * 0.4));
      g.lineTo(ew * 0.55, by + eh * (0.12 - tilt * 0.2));
      g.quadraticCurveTo(0, by - eh * 0.1 + eh * tilt * 0.9, -ew * 0.62, by + eh * (0.6 + tilt * 1.6));
      g.closePath(); g.fill();
    }
    g.restore();
  }
  // 嘴
  const my = Y(-0.6), mw = S * 0.07;
  g.strokeStyle = f.lips || '#5a2a1e'; g.lineWidth = S * 0.011;
  g.beginPath();
  if (f.mouth === 'grin') { g.moveTo(X(0) - mw, my - S * 0.004); g.quadraticCurveTo(X(0), my + S * 0.02, X(0) + mw, my - S * 0.012); }
  else if (f.mouth === 'frown') { g.moveTo(X(0) - mw * 0.8, my + S * 0.008); g.quadraticCurveTo(X(0), my - S * 0.008, X(0) + mw * 0.8, my + S * 0.008); }
  else if (f.mouth === 'smirk') { g.moveTo(X(0) - mw * 0.7, my); g.quadraticCurveTo(X(0) + mw * 0.2, my + S * 0.01, X(0) + mw * 0.85, my - S * 0.018); }
  else if (f.mouth === 'lips') { g.strokeStyle = '#c87a78'; g.moveTo(X(0) - mw * 0.6, my); g.quadraticCurveTo(X(0), my + S * 0.012, X(0) + mw * 0.6, my); }
  else { g.moveTo(X(0) - mw * 0.7, my); g.lineTo(X(0) + mw * 0.7, my); }
  g.stroke();
  if (id === 'frieza') { g.strokeStyle = 'rgba(60,20,50,.6)'; g.lineWidth = S * 0.006; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(X(sx * 0.22), Y(-0.05)); g.quadraticCurveTo(X(sx * 0.25), Y(-0.2), X(sx * 0.18), Y(-0.32)); g.stroke(); } }
  if (id === 'piccolo') { g.strokeStyle = 'rgba(40,90,25,.6)'; g.lineWidth = S * 0.008; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(X(sx * 0.4), Y(-0.28)); g.lineTo(X(sx * 0.3), Y(-0.5)); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
