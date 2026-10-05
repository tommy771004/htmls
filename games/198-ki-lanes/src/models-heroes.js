// 六名英雄的網格：Blender 腳本（blender/build_heroes.py）建模、A 字綁定姿勢、量化後烘成 models-baked.js，這裡只解碼。
// 身體是一張蒙皮網格（骨頭順序見 models.js 的 BONE_ORDER＋擺動鏈），頭（含髮型）是掛在 head 骨的剛體網格；臉是畫在 canvas 上的貼花。
import * as THREE from 'three';
import { unzlibSync } from 'three/examples/jsm/libs/fflate.module.js';
import { BAKED } from './models-baked.js';
// 比例（FighterZ 的英雄比例：約 5.6 頭身、寬肩）
// 比例照各角色的官方全身設定圖量（tools/refcmp.sh 正交正面並排比對）：L 髖關節高、hr 頭半徑、hx 頭部橫向比例、neck 脖子長、sw 肩關節距中線
export const PROPS = {
  goku: { H: 1.85, hr: 0.1303, L: 0.962, sw: 0.2098, chest: [0.219, 0.3, 0.162], waist: 0.1068, arm: 0.0703, fore: 0.06566, fist: 0.09126, thigh: 0.09522, shin: 0.07258, hip: 0.1178, hx: 0.88, neck: 0.0222, armK: 0.9 },
  vegeta: { H: 1.72, hr: 0.124, L: 0.86, sw: 0.1984, chest: [0.2096, 0.29, 0.1561], waist: 0.1006, arm: 0.06845, fore: 0.06376, fist: 0.08835, thigh: 0.08124, shin: 0.06998, hip: 0.1102, hx: 0.88, neck: 0.0206, armK: 0.92 },
  trunks: { H: 1.86, hr: 0.1267, L: 0.9672, sw: 0.1735, chest: [0.1795, 0.28, 0.1421], waist: 0.1004, arm: 0.05861, fore: 0.05522, fist: 0.08115, thigh: 0.08237, shin: 0.0653, hip: 0.1064, hx: 0.88, neck: 0.0223, armK: 0.94 },
  piccolo: { H: 2.12, hr: 0.1327, L: 1.124, sw: 0.2216, chest: [0.2337, 0.31, 0.1658], waist: 0.1078, arm: 0.07122, fore: 0.06756, fist: 0.09504, thigh: 0.09837, shin: 0.07603, hip: 0.1197, hx: 0.88, neck: 0.0254, armK: 0.92 },
  frieza: { H: 1.55, hr: 0.1509, L: 0.7595, sw: 0.1193, chest: [0.13, 0.24, 0.1119], waist: 0.08096, arm: 0.04233, fore: 0.04128, fist: 0.06223, thigh: 0.06199, shin: 0.04992, hip: 0.0931, hx: 0.88, neck: 0.0186 },
  a18: { H: 1.72, hr: 0.1332, L: 0.9116, sw: 0.1166, chest: [0.1224, 0.26, 0.1066], waist: 0.09486, arm: 0.0373, fore: 0.03604, fist: 0.05632, thigh: 0.06065, shin: 0.05386, hip: 0.1102, hx: 0.88, neck: 0.0206 },
  naruto: { H: 1.66, hr: 0.1211, L: 0.8632, sw: 0.155, chest: [0.1627, 0.26, 0.1296], waist: 0.1056, arm: 0.04884, fore: 0.0468, fist: 0.0792, thigh: 0.0792, shin: 0.0624, hip: 0.1007, hx: 0.88, neck: 0.0199 },
  sasuke: { H: 1.68, hr: 0.1202, L: 0.8904, sw: 0.1392, chest: [0.157, 0.26, 0.1246], waist: 0.1012, arm: 0.05402, fore: 0.0507, fist: 0.07568, thigh: 0.06804, shin: 0.0608, hip: 0.0988, hx: 0.88, neck: 0.0202 },
  kakashi: { H: 1.81, hr: 0.1237, L: 0.9593, sw: 0.16, chest: [0.167, 0.28, 0.1337], waist: 0.11, arm: 0.04736, fore: 0.04524, fist: 0.0792, thigh: 0.06854, shin: 0.0576, hip: 0.1045, hx: 0.88, neck: 0.0217 },
  sakura: { H: 1.61, hr: 0.1286, L: 0.8533, sw: 0.1141, chest: [0.121, 0.245, 0.1041], waist: 0.09064, arm: 0.03848, fore: 0.03744, fist: 0.0572, thigh: 0.05766, shin: 0.0528, hip: 0.1045, hx: 0.88, neck: 0.0193 },
  luffy: { H: 1.74, hr: 0.1299, L: 0.87, sw: 0.1328, chest: [0.1445, 0.27, 0.1126], waist: 0.1038, arm: 0.04655, fore: 0.04599, fist: 0.08272, thigh: 0.0756, shin: 0.0616, hip: 0.1026, hx: 0.88, neck: 0.0209 },
  zoro: { H: 1.81, hr: 0.1255, L: 0.9412, sw: 0.181, chest: [0.1886, 0.295, 0.1517], waist: 0.125, arm: 0.06882, fore: 0.06474, fist: 0.088, thigh: 0.0936, shin: 0.0712, hip: 0.1159, hx: 0.88, neck: 0.0217 },
  sanji: { H: 1.8, hr: 0.1228, L: 1.026, sw: 0.1318, chest: [0.1358, 0.27, 0.108], waist: 0.1038, arm: 0.03996, fore: 0.04212, fist: 0.0748, thigh: 0.06221, shin: 0.0624, hip: 0.1026, hx: 0.88, neck: 0.0216 },
  nami: { H: 1.7, hr: 0.1323, L: 0.935, sw: 0.1153, chest: [0.1238, 0.26, 0.1082], waist: 0.088, arm: 0.037, fore: 0.03588, fist: 0.05632, thigh: 0.05814, shin: 0.0536, hip: 0.114, hx: 0.88, neck: 0.0204 },
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
  // 表情：base（平常）、shout（出招吶喊）、hurt（受擊）；超級賽亞人另有一套
  out.faces = {};
  for (const form of out.hair.ssj ? ['base', 'ssj'] : ['base']) for (const ex of ['', 'shout', 'hurt']) out.faces[form + (ex ? '_' + ex : '')] = drawFace(id, form === 'ssj', d.hr, ex);
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
  float lit = smoothstep(-0.03, 0.04, ndl - (1.0 - ao) * 0.48);
  float top = smoothstep(0.55, 0.62, ndl) * ao;
  vec3 shadeCol = mt > 3.5 && mt < 4.5 ? uShadeCol * vec3(1.06, 0.92, 0.9) : uShadeCol; // 皮膚的暗部偏暖
  // 接近白色的部位（弗利沙的皮膚、戰鬥服胸甲）壓低亮面與邊緣光、暗部偏淡紫，否則亮面加光後會爆成一片白
  float hiK = smoothstep(0.55, 0.92, dot(base, vec3(0.3, 0.59, 0.11)));
  shadeCol = mix(shadeCol, vec3(0.62, 0.6, 0.8), hiK * 0.6);
  vec3 c = mix(base * shadeCol, base * uKeyCol * (1.0 - 0.17 * hiK), lit);
  c += base * top * 0.1 * (1.0 - hiK);
  c *= mix(0.6, 1.0, smoothstep(0.15, 0.8, ao)); // 用烘焙遮蔽刻出肌肉之間的凹線
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c += uRimCol * rim * (0.35 + 0.3 * lit) * ao * (1.0 - 0.6 * hiK);
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
  goku: { iris: '#2a1d16', irisL: '#4a3426', brow: '#1a1614', browTilt: 0.36, eyeW: 0.329, eyeH: 0.159, eyeX: 0.36, eyeY: 0.01, sharp: 0.78, mouth: 'set', heavy: 1 },
  vegeta: { iris: '#20160f', irisL: '#3a2a20', brow: '#1a1614', browTilt: 0.6, eyeW: 0.318, eyeH: 0.124, eyeX: 0.35, eyeY: 0.01, sharp: 1.05, mouth: 'frown', heavy: 1 },
  trunks: { iris: '#3b5fb5', irisL: '#7fa2e6', brow: '#8a74c0', browTilt: 0.3, eyeW: 0.329, eyeH: 0.165, eyeX: 0.36, eyeY: 0.01, sharp: 0.72, mouth: 'set', heavy: 0.7 },
  piccolo: { iris: '#1a120c', irisL: '#1a120c', brow: '#2f6a1e', browTilt: 0.6, eyeW: 0.329, eyeH: 0.13, eyeX: 0.36, eyeY: 0.03, sharp: 1.1, mouth: 'frown', noPupil: true, sclera: '#fffbe8', heavy: 1 },
  frieza: { iris: '#d0203a', irisL: '#ff6a7a', brow: null, browTilt: 0, eyeW: 0.329, eyeH: 0.153, eyeX: 0.35, eyeY: 0.02, sharp: 1.05, mouth: 'smirk', lips: '#3a1838', lid: '#4a1a40', heavy: 0.4 },
  a18: { iris: '#4c98d6', irisL: '#a6d6ff', brow: '#c9a24a', browTilt: 0.05, eyeW: 0.339, eyeH: 0.236, eyeX: 0.36, eyeY: 0.01, sharp: 0.3, mouth: 'lips', lashes: true },
  naruto: { iris: '#1f6fd8', irisL: '#7fc4ff', brow: '#c98a1a', browTilt: 0.3, eyeW: 0.329, eyeH: 0.177, eyeX: 0.36, eyeY: 0.01, sharp: 0.7, mouth: 'grin', heavy: 0.6, whiskers: true },
  sasuke: { iris: '#141018', irisL: '#3a3044', brow: '#121018', browTilt: 0.42, eyeW: 0.318, eyeH: 0.136, eyeX: 0.35, eyeY: 0.01, sharp: 1.0, mouth: 'set', heavy: 0.8 },
  kakashi: { iris: '#1e1a1a', irisL: '#3a3434', brow: '#8a8a94', browTilt: 0.05, eyeW: 0.318, eyeH: 0.09, eyeX: 0.35, eyeY: 0.01, sharp: 0.5, mouth: 'none', heavy: 0.5, mask: '#2b3346', hideL: true },
  sakura: { iris: '#2fa868', irisL: '#8fe8b0', brow: '#e07aa8', browTilt: 0.12, eyeW: 0.35, eyeH: 0.224, eyeX: 0.36, eyeY: 0.01, sharp: 0.4, mouth: 'set', lashes: true, gem: '#9a3fd0' },
  luffy: { iris: '#141010', irisL: '#2a2020', brow: '#141010', browTilt: 0.1, eyeW: 0.339, eyeH: 0.236, eyeX: 0.36, eyeY: 0.01, sharp: 0.35, mouth: 'big', heavy: 0.4, scarUnderL: true },
  zoro: { iris: '#1a1612', irisL: '#3a3026', brow: '#2f6a3a', browTilt: 0.5, eyeW: 0.318, eyeH: 0.124, eyeX: 0.35, eyeY: 0.01, sharp: 1.0, mouth: 'set', heavy: 1, scarL: true },
  sanji: { iris: '#2a5ab8', irisL: '#7fa8ff', brow: '#d8b040', browTilt: 0.2, eyeW: 0.318, eyeH: 0.142, eyeX: 0.35, eyeY: 0.01, sharp: 0.8, mouth: 'set', heavy: 0.6, curl: true, hideL: true },
  nami: { iris: '#8a4a1a', irisL: '#d89050', brow: '#e8803a', browTilt: 0.08, eyeW: 0.35, eyeH: 0.224, eyeX: 0.36, eyeY: 0.01, sharp: 0.35, mouth: 'lips', lashes: true },
};
// 依作品分眼睛畫法：db 七龍珠（銳利、上眼瞼粗）、naruto 火影（細長杏眼、虹膜小）、op 海賊王（大圓眼、黑大瞳孔）
const EYE_STYLE = { naruto: 'naruto', sasuke: 'naruto', kakashi: 'naruto', sakura: 'naruto', luffy: 'op', zoro: 'op', sanji: 'op', nami: 'op' };
function drawFace(id, ssj, hr, expr = '') {
  if (typeof document === 'undefined') return null;
  const f = { ...FACE[id] };
  const style = EYE_STYLE[id] || 'db';
  if (style === 'naruto') { f.eyeW *= 1.12; f.eyeH *= 0.86; f.sharp *= 0.85; }
  if (style === 'op') { f.eyeW *= 0.9; f.eyeH *= 1.3; f.sharp *= 0.4; }
  if (expr === 'shout') { f.browTilt += 0.3; f.eyeH *= 0.82; f.sharp += 0.2; f.mouth = 'shout'; }
  if (expr === 'hurt') { f.browTilt -= 0.25; f.mouth = 'hurt'; f.squint = true; }
  if (ssj) { f.iris = '#1a9a8a'; f.irisL = '#7ff0dc'; f.brow = '#d8a82a'; f.browTilt += 0.12; f.sharp += 0.15; }
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  const S = N; // 單位：hr*1.9 → N
  const X = (u) => N / 2 + (u / 1.9) * S, Y = (v) => N / 2 - ((v + 0.12) / 1.9) * S; // v 以 hr 為單位、相對頭心
  const ink = f.lid || '#1a110c';
  // GK 式的五官陰影：眉骨下壓的陰影、鼻側、顴骨下與下顎的暗面（右上主光，所以左側較深）
  if (f.heavy) {
    const sh = (x, y, rx, ry, a, rot = 0) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, `rgba(120,60,50,${a})`); gr.addColorStop(1, 'rgba(120,60,50,0)'); g.save(); g.translate(X(x), Y(y)); g.rotate(rot); g.scale(rx * S / 1.9, ry * S / 1.9); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore(); };
    for (const sx of [-1, 1]) {
      const k = sx < 0 ? 1 : 0.7;
      sh(sx * 0.36, f.eyeY + 0.2, 0.3, 0.1, 0.32 * f.heavy * k);         // 眉骨下
      sh(sx * 0.5, -0.38, 0.13, 0.3, 0.22 * f.heavy * k, sx * 0.35);   // 顴骨下
      sh(sx * 0.42, -0.72, 0.22, 0.12, 0.2 * f.heavy * k, sx * -0.5);  // 下顎
    }
    sh(-0.06, -0.3, 0.05, 0.13, 0.3 * f.heavy);                         // 鼻側
    sh(0, -0.78, 0.12, 0.05, 0.22 * f.heavy);                           // 下唇下
  }
  for (const sx of [-1, 1]) {
    if (f.hideL && sx > 0) continue; // 被頭帶或瀏海蓋住的左眼（角色左＝畫布右）
    const ex = X(sx * f.eyeX), ey = Y(f.eyeY), ew = (f.eyeW / 1.9) * S, eh = (f.eyeH / 1.9) * S;
    g.save(); g.translate(ex, ey); g.scale(sx, 1);
    // 眼形：內眼角低、外眼角上揚（杏仁形）
    if (f.squint) { // 受擊：眼睛緊閉成「＞＜」
      g.strokeStyle = ink; g.lineCap = 'round'; g.lineWidth = eh * 0.3;
      g.beginPath(); g.moveTo(-ew * 0.5, -eh * 0.4); g.lineTo(ew * 0.35, eh * 0.05); g.lineTo(-ew * 0.4, eh * 0.45); g.stroke();
      g.restore(); continue;
    }
    const shape = style === 'op' ? () => { g.beginPath(); g.ellipse(0, 0, ew * 0.5, eh * 0.62, 0, 0, Math.PI * 2); } : () => {
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
      const ir = style === 'op' ? eh * 0.5 : style === 'naruto' ? eh * 0.8 : eh * 0.95, ix = -ew * 0.02, iy = style === 'op' ? 0 : eh * 0.08;
      const gr = g.createLinearGradient(0, iy - ir, 0, iy + ir);
      gr.addColorStop(0, f.iris); gr.addColorStop(1, f.irisL);
      g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, ir * (style === 'op' ? 0.92 : 0.78), ir, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(10,6,4,.85)'; g.beginPath(); g.ellipse(ix, iy + ir * 0.1, ir * 0.36, ir * 0.48, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ix + ir * 0.28, iy - ir * 0.38, ir * 0.22, ir * 0.26, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(ix - ir * 0.3, iy + ir * 0.45, ir * 0.1, ir * 0.1, 0, 0, Math.PI * 2); g.fill();
    }
    // 上眼瞼的陰影
    g.fillStyle = 'rgba(80,50,40,.25)'; g.fillRect(-ew, -eh * 2, ew * 2, eh * 1.55);
    g.restore();
    // 上眼線：粗、外側延伸上挑
    g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = eh * (style === 'op' ? 0.16 : 0.32);
    if (style === 'op') { g.beginPath(); g.ellipse(0, 0, ew * 0.5, eh * 0.62, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
    g.beginPath(); if (style === 'op') g.moveTo(9e9, 9e9); else g.moveTo(-ew * 0.6, eh * 0.05);
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
  const my = Y(-0.5), mw = S * 0.07; // 下半臉縮短後嘴跟著上移
  g.strokeStyle = f.lips || '#5a2a1e'; g.lineWidth = S * 0.011;
  g.beginPath();
  if (f.mouth === 'grin') { g.moveTo(X(0) - mw, my - S * 0.004); g.quadraticCurveTo(X(0), my + S * 0.02, X(0) + mw, my - S * 0.012); }
  else if (f.mouth === 'frown') { g.moveTo(X(0) - mw * 0.8, my + S * 0.008); g.quadraticCurveTo(X(0), my - S * 0.008, X(0) + mw * 0.8, my + S * 0.008); }
  else if (f.mouth === 'smirk') { g.moveTo(X(0) - mw * 0.7, my); g.quadraticCurveTo(X(0) + mw * 0.2, my + S * 0.01, X(0) + mw * 0.85, my - S * 0.018); }
  else if (f.mouth === 'set') { g.moveTo(X(0) - mw * 0.75, my + S * 0.004); g.quadraticCurveTo(X(0), my - S * 0.004, X(0) + mw * 0.75, my + S * 0.006); }
  else if (f.mouth === 'shout') { g.fillStyle = '#4a1612'; g.moveTo(X(0) - mw * 1.5 * 1.0, my + S * 0.018); g.lineTo(X(0) - mw * 1.5 * 0.55, my - S * 0.03); g.lineTo(X(0) + mw * 1.5 * 0.55, my - S * 0.03); g.lineTo(X(0) + mw * 1.5 * 1.0, my + S * 0.018); g.lineTo(X(0) + mw * 1.5 * 0.5, my + S * 0.085); g.lineTo(X(0) - mw * 1.5 * 0.5, my + S * 0.085); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(X(0) - mw * 1.5 * 0.55, my - S * 0.022, mw * 1.5 * 1.1, S * 0.018); g.beginPath(); }
  else if (f.mouth === 'hurt') { g.fillStyle = '#4a1612'; g.moveTo(X(0) - mw * 0.9, my); g.lineTo(X(0) - mw * 0.3, my - S * 0.012); g.lineTo(X(0) + mw * 0.3, my + S * 0.006); g.lineTo(X(0) + mw * 0.9, my - S * 0.004); g.lineTo(X(0) + mw * 0.6, my + S * 0.03); g.lineTo(X(0) - mw * 0.6, my + S * 0.03); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(X(0) - mw * 0.55, my - S * 0.004, mw * 1.1, S * 0.014); g.beginPath(); }
  else if (f.mouth === 'big') { g.fillStyle = '#5a1e18'; g.moveTo(X(0) - mw * 1.3, my - S * 0.01); g.quadraticCurveTo(X(0), my + S * 0.06, X(0) + mw * 1.3, my - S * 0.01); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(X(0) - mw * 1.0, my - S * 0.008, mw * 2.0, S * 0.012); g.beginPath(); }
  else if (f.mouth === 'none') { g.beginPath(); }
  else if (f.mouth === 'lips') { g.strokeStyle = '#c87a78'; g.moveTo(X(0) - mw * 0.6, my); g.quadraticCurveTo(X(0), my + S * 0.012, X(0) + mw * 0.6, my); }
  else { g.moveTo(X(0) - mw * 0.7, my); g.lineTo(X(0) + mw * 0.7, my); }
  g.stroke();
  // 客串角色的臉部記號
  const line = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = S * w; g.lineCap = 'round'; g.beginPath(); pts.forEach(([u, v], i) => (i ? g.lineTo : g.moveTo).call(g, X(u), Y(v))); g.stroke(); };
  if (f.whiskers) for (const sx of [-1, 1]) for (const dy of [-0.25, -0.36, -0.47]) line([[sx * 0.42, dy], [sx * 0.66, dy + 0.02]], 0.009, 'rgba(80,40,30,.75)');
  if (f.scarUnderL) line([[0.22, -0.2], [0.42, -0.24]], 0.007, 'rgba(120,40,30,.8)');
  if (f.scarL) { line([[0.25, 0.38], [0.4, -0.25]], 0.012, 'rgba(110,40,30,.85)'); line([[0.22, 0.06], [0.5, 0.07]], 0.01, '#1a110c'); }
  if (f.curl) line([[-0.62, 0.28], [-0.2, 0.36], [-0.12, 0.3], [-0.17, 0.25]], 0.012, f.brow);
  if (f.gem) { g.fillStyle = f.gem; g.beginPath(); g.moveTo(X(0), Y(0.5)); g.lineTo(X(0.05), Y(0.43)); g.lineTo(X(0), Y(0.36)); g.lineTo(X(-0.05), Y(0.43)); g.closePath(); g.fill(); }
  if (f.mask) { g.fillStyle = f.mask; g.beginPath(); g.moveTo(X(-1), Y(-0.18)); g.quadraticCurveTo(X(0), Y(-0.08), X(1), Y(-0.18)); g.lineTo(X(1), Y(-1)); g.lineTo(X(-1), Y(-1)); g.closePath(); g.fill(); line([[-0.05, -0.12], [0.02, -0.32]], 0.006, 'rgba(0,0,0,.35)'); }
  if (id === 'frieza') { g.strokeStyle = 'rgba(60,20,50,.6)'; g.lineWidth = S * 0.006; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(X(sx * 0.22), Y(-0.05)); g.quadraticCurveTo(X(sx * 0.25), Y(-0.2), X(sx * 0.18), Y(-0.32)); g.stroke(); } }
  if (id === 'piccolo') { g.strokeStyle = 'rgba(40,90,25,.6)'; g.lineWidth = S * 0.008; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(X(sx * 0.4), Y(-0.28)); g.lineTo(X(sx * 0.3), Y(-0.5)); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
