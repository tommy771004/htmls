// 程式建模：英雄、小兵、防禦塔、主堡。全部由基本幾何合併而成（頂點色＋一個共用卡通材質），外框用反向殼。
// 介面見 SPEC.md §4。root 朝 +z 為正面。
import * as THREE from 'three';

export const HERO_IDS = ['homura', 'shimo', 'iwao', 'raiga'];

const TEAM = [0x24a38f, 0xd9472b];
const TEAM_LIGHT = [0x7fe0cc, 0xff9a76];
const INK = 0x1a120c;

/* ---------------- 共用材質 ---------------- */
let _grad = null;
function gradientMap() {
  if (_grad) return _grad;
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  _grad = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.generateMipmaps = false;
  _grad.needsUpdate = true;
  return _grad;
}
let _toon = null;
function toonVC() {
  if (!_toon) _toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });
  return _toon;
}
const _outline = {};
function outlineMat(w = 0.028) {
  if (_outline[w]) return _outline[w];
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uOutline = { value: w };
    s.vertexShader = 'uniform float uOutline;\n' + s.vertexShader.replace('#include <project_vertex>',
      'vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );\n' +
      'vec3 _on = normalize( normalMatrix * normal );\n' +
      'mvPosition.xyz += _on * uOutline * (1.0 + 0.012 * max(0.0, -mvPosition.z - 10.0));\n' +
      'gl_Position = projectionMatrix * mvPosition;');
  };
  m.customProgramCacheKey = () => 'ki-outline-' + w;
  _outline[w] = m;
  return m;
}
const _emis = new Map();
function emissiveToon(color, intensity = 1) {
  const key = color + ':' + intensity;
  if (!_emis.has(key)) _emis.set(key, new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: intensity, gradientMap: gradientMap() }));
  return _emis.get(key);
}

/* ---------------- 幾何合併 ---------------- */
const V3 = THREE.Vector3, _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
function M(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  if (typeof s === 'number') s = [s, s, s];
  if (!r || typeof r === 'number') r = [0, 0, 0];
  return new THREE.Matrix4().compose(new V3(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), new V3(s[0], s[1], s[2]));
}
class Parts {
  constructor() { this.list = []; }
  add(geo, color, p, r, s) { this.list.push({ geo, color, m: M(p, r, s) }); return this; }
  addM(geo, color, m) { this.list.push({ geo, color, m }); return this; }
  build() {
    let total = 0;
    const gs = this.list.map((it) => {
      const g = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone();
      g.applyMatrix4(it.m);
      total += g.attributes.position.count;
      return { g, color: it.color };
    });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const { g, color } of gs) {
      const P = g.attributes.position.array, N = g.attributes.normal.array, n = g.attributes.position.count;
      pos.set(P, o * 3); nor.set(N, o * 3);
      _c.set(color);
      for (let i = 0; i < n; i++) { col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b; }
      o += n;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }
}
// 基本形（單位尺寸，建一次）
const G = {};
function geo(name) {
  if (G[name]) return G[name];
  switch (name) {
    case 'sphere': G[name] = new THREE.SphereGeometry(1, 12, 9); break;
    case 'hsphere': G[name] = new THREE.SphereGeometry(1, 16, 12); break;
    case 'lsphere': G[name] = new THREE.SphereGeometry(1, 8, 6); break;
    case 'box': G[name] = new THREE.BoxGeometry(1, 1, 1); break;
    case 'cone6': G[name] = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0); break;
    case 'cone8': G[name] = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0); break;
    case 'oct': G[name] = new THREE.OctahedronGeometry(1, 0); break;
    case 'ico': G[name] = new THREE.IcosahedronGeometry(1, 0); break;
    case 'dodec': G[name] = new THREE.DodecahedronGeometry(1, 0); break;
    case 'disc': G[name] = new THREE.CylinderGeometry(1, 1, 1, 14); break;
  }
  return G[name];
}
// 向下延伸的錐形肢段（頂端在原點）
const limb = (rt, rb, len, seg = 8) => new THREE.CylinderGeometry(rt, rb, len, seg).translate(0, -len / 2, 0);
const cyl = (rt, rb, h, seg = 10, open = false, ts = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl);

function meshPair(geometry, parent, { outline = true, w = 0.028, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, toonVC());
  m.castShadow = shadow; m.receiveShadow = false;
  parent.add(m);
  if (outline) {
    const o = new THREE.Mesh(geometry, outlineMat(w));
    o.castShadow = false;
    o.raycast = () => {};
    parent.add(o);
  }
  return m;
}

/* ---------------- 英雄定義 ---------------- */
const HERO = {
  homura: { H: 1.9, L: 0.82, hr: 0.215, sw: 0.25, chest: [0.25, 0.31, 0.18], waist: 0.17, arm: 0.074, fore: 0.07, fist: 0.092, thigh: 0.12, shin: 0.09, hip: 0.12,
    skin: 0xf0c39a, style: 'brawler', atk3: 'kick', element: 0xff7a1a },
  shimo: { H: 2.0, L: 0.92, hr: 0.2, sw: 0.215, chest: [0.205, 0.3, 0.155], waist: 0.15, arm: 0.058, fore: 0.055, fist: 0.07, thigh: 0.09, shin: 0.07, hip: 0.105,
    skin: 0xf3d6c2, style: 'mage', atk3: 'palm', element: 0x7fd8ff },
  iwao: { H: 2.2, L: 0.86, hr: 0.22, sw: 0.36, chest: [0.4, 0.36, 0.29], waist: 0.3, arm: 0.12, fore: 0.13, fist: 0.16, thigh: 0.16, shin: 0.13, hip: 0.17,
    skin: 0xb07a48, style: 'tank', atk3: 'smash', element: 0x9be03c },
  raiga: { H: 1.75, L: 0.78, hr: 0.2, sw: 0.205, chest: [0.2, 0.27, 0.15], waist: 0.14, arm: 0.056, fore: 0.052, fist: 0.068, thigh: 0.088, shin: 0.068, hip: 0.1,
    skin: 0xe9b991, style: 'ninja', atk3: 'kick', element: 0xffe14a },
};
for (const id in HERO) {
  const d = HERO[id];
  d.torso = d.H - d.L - d.hr * 1.95 - 0.04;
  d.upper = d.torso * 0.5; d.lower = d.torso * 0.47;
  d.thighLen = d.L * 0.5; d.shinLen = d.L * 0.44;
}

// 每個英雄每隊的幾何快取
const heroGeoCache = new Map();

function buildHeroGeos(id, team) {
  const d = HERO[id];
  const tc = TEAM[team];
  const out = {};
  const hr = d.hr;
  // --- 臉（共用）：眼睛、反光、眉 ---
  const face = (p, { brow = 0x2a1a12, eye = 0x1d1410, browTilt = 0.35, eyeY = 0.86, iris = null } = {}) => {
    const s = hr / 0.21;
    const cy = hr * 0.9;
    for (const sx of [-1, 1]) {
      const x = 0.072 * s * sx, y = cy - hr * (1 - eyeY) - 0.005;
      const z = Math.sqrt(Math.max(0, hr * hr - x * x - (y - cy) * (y - cy))) * 0.955;
      p.add(geo('sphere'), eye, [x, y, z], [0, sx * 0.25, 0], [0.03 * s, 0.047 * s, 0.018 * s]);
      if (iris) p.add(geo('sphere'), iris, [x, y - 0.008 * s, z + 0.007 * s], [0, sx * 0.25, 0], [0.019 * s, 0.026 * s, 0.01 * s]);
      p.add(geo('lsphere'), 0xffffff, [x + 0.01 * s, y + 0.017 * s, z + 0.013 * s], 0, [0.011 * s, 0.013 * s, 0.006 * s]);
      if (brow != null) p.add(geo('box'), brow, [x * 1.05, y + 0.07 * s, z - 0.004], [0, sx * 0.3, sx * browTilt], [0.075 * s, 0.017 * s, 0.02 * s]);
    }
  };

  /* ------- hips / pelvis ------- */
  {
    const p = new Parts();
    const pantsC = { homura: 0x3b302a, shimo: 0x283135, iwao: 0x5a4632, raiga: 0x26282b }[id];
    p.add(geo('sphere'), pantsC, [0, -0.02, 0], 0, [d.hip * 1.75, d.hip * 1.1, d.hip * 1.35]);
    // 腰帶
    const beltC = { homura: 0x8e1f1a, shimo: 0x1f2a2c, iwao: 0x6b4a2c, raiga: 0x3a3a3c }[id];
    p.add(cyl(d.waist * 1.08, d.waist * 1.12, 0.09, 14), beltC, [0, 0.07, 0], 0, [1, 1, d.chest[2] / d.chest[0] * 1.05 + 0.05]);
    if (id === 'homura') {
      // 結
      p.add(geo('sphere'), 0x8e1f1a, [0.1, 0.06, d.chest[2] * 0.95], 0, [0.05, 0.045, 0.04]);
    }
    if (id === 'shimo') {
      // 長大衣下擺：開前襟的半圓錐（背面）
      const coat = cyl(d.waist * 1.15, d.waist * 2.1, 0.62, 16, true, Math.PI * 0.62, Math.PI * 1.76);
      coat.translate(0, -0.27, 0);
      p.add(coat, 0x4a6e70, [0, 0.04, 0], 0, [1, 1, 0.82]);
      const coatIn = cyl(d.waist * 1.12, d.waist * 2.05, 0.6, 16, true, Math.PI * 0.62, Math.PI * 1.76);
      coatIn.translate(0, -0.27, 0); coatIn.scale(-1, 1, 1); // 反轉繞序當內裡
      p.add(coatIn, 0x5b7f80, [0, 0.04, 0], 0, [1, 1, 0.8]);
      // 冰色滾邊
      p.add(cyl(d.waist * 2.12, d.waist * 2.12, 0.035, 16, true, Math.PI * 0.62, Math.PI * 1.76), 0xa8e8ff, [0, -0.56, 0], 0, [1, 1, 0.82]);
    }
    if (id === 'iwao') {
      // 腰前的布片
      p.add(geo('box'), 0x5e7a2e, [0, -0.12, d.chest[2] * 0.62], [-0.08, 0, 0], [0.22, 0.26, 0.03]);
    }
    out.hips = p.build();
  }

  /* ------- torso ------- */
  {
    const p = new Parts();
    const T = d.torso, [cx, cy, cz] = d.chest;
    const topC = { homura: 0xefe8da, shimo: 0x4a6e70, iwao: d.skin, raiga: 0x26282b }[id];
    // 腹
    p.add(geo('sphere'), id === 'homura' ? 0xefe8da : topC, [0, T * 0.28, 0], 0, [d.waist * 1.05, T * 0.3, cz * 0.95]);
    // 胸
    p.add(geo('sphere'), topC, [0, T * 0.66, 0], 0, [cx, cy * T / 0.62 * 0.62, cz * 0.92]);
    p.add(geo('box'), topC, [0, T * 0.7, -0.005], 0, [cx * 1.55, cy * 0.75, cz * 1.45]);
    // 頸
    p.add(limb(hr * 0.33, hr * 0.38, 0.12, 8), d.skin, [0, T + 0.06, 0]);
    if (id === 'homura') {
      // V 領：倒三角露出胸口
      p.add(new THREE.ConeGeometry(1, 1, 3), d.skin, [0, T * 0.8, cz * 0.93], [Math.PI, 0, 0], [0.075, 0.2, 0.012]);
      p.add(geo('box'), 0x8e1f1a, [0, T * 0.5, cz * 0.98], 0, [0.012, 0.18, 0.01]);
      // 肩頭的無袖布邊
      for (const sx of [-1, 1]) p.add(geo('sphere'), 0xefe8da, [sx * d.sw * 0.82, T * 0.86, 0], 0, [0.1, 0.08, 0.12]);
    }
    if (id === 'shimo') {
      // 高領
      p.add(cyl(hr * 0.62, hr * 0.5, 0.2, 14, true), 0x4a6e70, [0, T + 0.07, -0.01]);
      p.add(cyl(hr * 0.64, hr * 0.64, 0.03, 14, true), 0xa8e8ff, [0, T + 0.17, -0.01]);
      // 前襟扣列
      for (let i = 0; i < 3; i++) p.add(geo('lsphere'), 0xa8e8ff, [0, T * (0.45 + i * 0.15), cz * 0.98], 0, 0.018);
      // 斜向的冰色前襟線
      p.add(geo('box'), 0x2a3e40, [0.04, T * 0.6, cz * 0.97], [0, 0, 0.12], [0.02, T * 0.6, 0.02]);
      // 冰晶肩甲（固定在胸）
      for (const sx of [-1, 1]) {
        p.add(geo('oct'), 0xa8e8ff, [sx * d.sw * 1.02, T * 0.93, 0], [0.3, 0.4, sx * 0.9], [0.09, 0.16, 0.09]);
        p.add(geo('oct'), 0xd9f6ff, [sx * d.sw * 1.12, T * 0.98, -0.05], [-0.4, 0.2, sx * 1.2], [0.05, 0.12, 0.05]);
        p.add(geo('oct'), 0x7fd8ff, [sx * d.sw * 0.98, T * 0.96, 0.07], [0.6, 0, sx * 0.6], [0.04, 0.1, 0.04]);
      }
    }
    if (id === 'iwao') {
      // 苔綠背心（前方敞開）
      const vest = new THREE.SphereGeometry(1, 12, 8, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1, 0.25, 2.2);
      p.add(vest, 0x5e7a2e, [0, T * 0.62, 0], 0, [cx * 1.07, cy * 1.14, cz * 1.1]);
      // 胸肌陰影線
      p.add(geo('box'), 0x8d5a32, [0, T * 0.7, cz * 0.98], 0, [0.012, 0.16, 0.01]);
      // 肩上的巨大肌肉
      for (const sx of [-1, 1]) p.add(geo('sphere'), d.skin, [sx * d.sw * 0.95, T * 0.86, 0], 0, [0.17, 0.15, 0.17]);
      // 背上的岩片
      p.add(geo('dodec'), 0x8d8a80, [0, T * 0.8, -cz * 0.9], [0.3, 0.5, 0], [0.16, 0.12, 0.08]);
    }
    if (id === 'raiga') {
      // 金色鋸齒條紋（斜過胸口）
      const zz = [[-0.15, 0.9], [0.02, 0.7], [-0.05, 0.66], [0.13, 0.44]];
      for (let i = 0; i < zz.length - 1; i++) {
        const [x0, y0] = zz[i], [x1, y1] = zz[i + 1];
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 * T, len = Math.hypot(x1 - x0, (y1 - y0) * T);
        const ang = Math.atan2((y1 - y0) * T, x1 - x0);
        const z = cz * Math.sqrt(Math.max(0.05, 1 - (mx / cx) ** 2)) * 0.98 + 0.004;
        p.add(geo('box'), 0xffd23a, [mx, my, z], [0, 0, ang], [len + 0.02, 0.035, 0.02]);
      }
      // 面罩：圍住下半臉的布（在頭部上做），這裡做頸巾
      p.add(cyl(hr * 0.55, hr * 0.62, 0.13, 12), 0x3a3633, [0, T + 0.04, 0]);
    }
    out.torso = p.build();
  }

  /* ------- head ------- */
  {
    const p = new Parts();
    const cy = hr * 0.9;
    const headSkin = d.skin;
    p.add(geo('hsphere'), headSkin, [0, cy, 0], 0, [hr * 0.98, hr, hr * 0.96]);
    // 耳
    for (const sx of [-1, 1]) p.add(geo('lsphere'), headSkin, [sx * hr * 0.95, cy - 0.01, -0.01], 0, [0.03, 0.05, 0.035]);
    if (id === 'homura') {
      face(p, { browTilt: 0.42, iris: 0x8a2a12 });
      const hc = 0xd8401c, hl = 0xff7f2e;
      // 髮帽（上與後）
      const cap = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, 1.35);
      p.add(cap, hc, [0, cy + 0.02, -0.02], [-0.55, 0, 0], [hr * 1.08, hr * 1.08, hr * 1.1]);
      // 向後上方的火焰狀尖刺
      const spikes = [
        [0, 0.22, -0.02, -0.55, 0, 0.11, 0.34, hl], [0.09, 0.18, -0.05, -0.85, 0, -0.45, 0.3, hc], [-0.09, 0.18, -0.05, -0.85, 0, 0.45, 0.3, hc],
        [0, 0.12, -0.15, -1.25, 0, 0, 0.34, hc], [0.12, 0.08, -0.12, -1.3, 0, -0.75, 0.28, hl], [-0.12, 0.08, -0.12, -1.3, 0, 0.75, 0.28, hl],
        [0.06, 0.0, -0.19, -1.6, 0, -0.35, 0.26, hc], [-0.06, 0.0, -0.19, -1.6, 0, 0.35, 0.26, hc], [0.0, 0.25, 0.08, -0.2, 0, 0, 0.26, hl],
        [0.14, 0.16, 0.02, -0.55, 0, -1.0, 0.24, hc], [-0.14, 0.16, 0.02, -0.55, 0, 1.0, 0.24, hc],
      ];
      for (const [x, y, z, rx, ry, rz, h, c] of spikes) p.add(geo('cone6'), c, [x * hr / 0.21, cy + y * hr / 0.21 * 0.7, z * hr / 0.21], [rx, ry, rz], [0.075, h, 0.065]);
      // 前額瀏海
      for (const sx of [-1, 0, 1]) p.add(geo('cone6'), hc, [sx * 0.07, cy + hr * 0.72, hr * 0.62], [2.3, 0, sx * 0.4], [0.04, 0.12, 0.035]);
    }
    if (id === 'shimo') {
      face(p, { browTilt: 0.18, iris: 0x2a7a9a, brow: 0x8fb3c2 });
      const hc = 0xc9dde6, hs = 0x9fbfcc;
      const cap = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, 1.45);
      p.add(cap, hc, [0, cy + 0.015, -0.015], [-0.45, 0, 0], [hr * 1.07, hr * 1.07, hr * 1.08]);
      // 側邊長髮
      for (const sx of [-1, 1]) {
        p.add(geo('box'), hc, [sx * hr * 0.9, cy - hr * 0.35, hr * 0.15], [0.05, 0, sx * 0.08], [0.05, hr * 1.5, 0.11]);
        p.add(geo('cone6'), hs, [sx * hr * 0.88, cy - hr * 1.05, hr * 0.15], [Math.PI, 0, 0], [0.04, 0.12, 0.05]);
      }
      // 斜瀏海
      p.add(geo('box'), hc, [0.04, cy + hr * 0.62, hr * 0.78], [0.45, 0, 0.5], [0.24, 0.07, 0.07]);
      p.add(geo('cone6'), hs, [-0.08, cy + hr * 0.5, hr * 0.85], [2.6, 0, 0.5], [0.035, 0.14, 0.03]);
      // 髮束的綁處（高馬尾）
      p.add(geo('sphere'), 0x7fd8ff, [0, cy + hr * 0.95, -hr * 0.62], 0, 0.045);
    }
    if (id === 'iwao') {
      face(p, { brow: null, eyeY: 0.88, iris: 0x4a6a1a });
      // 石質眉骨
      p.add(geo('box'), 0x8d8a80, [0, cy + hr * 0.18, hr * 0.82], [0.2, 0, 0], [hr * 1.65, 0.07, 0.11]);
      p.add(geo('dodec'), 0x77746b, [0.08, cy + hr * 0.22, hr * 0.85], [0.4, 0.2, 0], [0.06, 0.04, 0.05]);
      // 雙角
      for (const sx of [-1, 1]) p.add(geo('cone8'), 0xe8dcc0, [sx * hr * 0.42, cy + hr * 0.62, hr * 0.48], [0.35, 0, -sx * 0.55], [0.055, 0.2, 0.055]);
      // 下巴與鬍渣
      p.add(geo('sphere'), 0x9a6a3e, [0, cy - hr * 0.62, hr * 0.5], 0, [hr * 0.55, hr * 0.32, hr * 0.42]);
      // 頭頂刺青般的綠紋
      p.add(geo('box'), 0x6f9a2a, [0, cy + hr * 0.92, 0.0], [0, 0, 0], [0.03, 0.02, hr * 1.2]);
    }
    if (id === 'raiga') {
      face(p, { browTilt: 0.55, iris: 0xb08a10, eyeY: 0.92 });
      const hc = 0xf3e6a0, hl = 0xfff7d0;
      const cap = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, 1.4);
      p.add(cap, hc, [0, cy + 0.02, -0.01], [-0.4, 0, 0], [hr * 1.08, hr * 1.06, hr * 1.1]);
      // 短而四散的尖刺（偏向上）
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, r = 0.55 + (i % 3) * 0.12;
        const x = Math.sin(a) * hr * 0.55, z = Math.cos(a) * hr * 0.5 - 0.02;
        p.add(geo('cone6'), i % 2 ? hl : hc, [x, cy + hr * 0.62, z], [Math.cos(a) * r - 0.2, 0, -Math.sin(a) * r], [0.055, 0.16 + (i % 3) * 0.03, 0.05]);
      }
      p.add(geo('cone6'), hl, [0, cy + hr * 0.95, 0], [-0.2, 0, 0], [0.06, 0.2, 0.055]);
      // 面罩：遮住口鼻
      const mask = new THREE.SphereGeometry(1, 14, 8, Math.PI * 0.05, Math.PI * 0.9, 1.65, 1.0);
      p.add(mask, 0x3a3633, [0, cy + 0.005, 0], [0, 0, 0], [hr * 1.04, hr * 1.04, hr * 1.06]);
      p.add(geo('box'), 0xffd23a, [0, cy - hr * 0.28, hr * 0.98], 0, [0.12, 0.014, 0.012]);
    }
    out.head = p.build();
  }

  /* ------- arms ------- */
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    // upper
    {
      const p = new Parts();
      const upC = { homura: d.skin, shimo: 0x4a6e70, iwao: d.skin, raiga: d.skin }[id];
      p.add(geo('sphere'), upC, [0, -0.01, 0], 0, d.arm * 1.35);
      p.add(limb(d.arm * 1.1, d.arm * 0.92, d.upper, 8), upC, [0, 0, 0]);
      // 二頭肌
      if (id !== 'shimo') p.add(geo('sphere'), upC, [0, -d.upper * 0.42, d.arm * 0.25], 0, [d.arm * 1.08, d.upper * 0.3, d.arm * 1.1]);
      // 隊伍色臂章（左臂）
      p.add(cyl(d.arm * 1.16, d.arm * 1.12, 0.1, 10), tc, [0, -d.upper * 0.3, 0]);
      if (id === 'raiga') p.add(cyl(d.arm * 1.05, d.arm * 1.0, 0.05, 10), 0x26282b, [0, -d.upper * 0.85, 0]);
      out['upper' + side] = p.build();
    }
    // forearm + hand
    {
      const p = new Parts();
      const L = d.lower;
      if (id === 'homura') {
        p.add(limb(d.fore * 1.02, d.fore * 0.85, L, 8), 0x24201d, [0, 0, 0]);
        for (let i = 0; i < 4; i++) p.add(cyl(d.fore * 1.05 - i * 0.004, d.fore * 1.0 - i * 0.004, 0.018, 10), 0x3a332e, [0, -L * (0.2 + i * 0.2), 0], [0.25, 0, 0]);
        p.add(geo('sphere'), d.skin, [0, -L - d.fist * 0.6, 0.01], 0, [d.fist, d.fist * 1.05, d.fist * 1.05]);
        p.add(geo('box'), 0x24201d, [0, -L - d.fist * 0.2, 0.0], 0, [d.fist * 1.5, d.fist * 0.6, d.fist * 1.6]);
      } else if (id === 'shimo') {
        p.add(limb(d.fore * 1.05, d.fore * 0.95, L * 0.55, 8), 0x4a6e70, [0, 0, 0]);
        p.add(cyl(d.fore * 1.5, d.fore * 1.2, L * 0.18, 10), 0x4a6e70, [0, -L * 0.6, 0]); // 袖口
        p.add(cyl(d.fore * 1.52, d.fore * 1.52, 0.02, 10, true), 0xa8e8ff, [0, -L * 0.69, 0]);
        p.add(limb(d.fore * 0.9, d.fore * 0.85, L * 0.35, 8), 0x222c30, [0, -L * 0.65, 0]);
        p.add(geo('sphere'), 0x222c30, [0, -L - d.fist * 0.5, 0.01], 0, [d.fist, d.fist * 1.1, d.fist * 1.0]);
      } else if (id === 'iwao') {
        p.add(limb(d.fore * 0.95, d.fore * 0.9, L * 0.4, 8), d.skin, [0, 0, 0]);
        // 石臂鎧（巨大前臂）
        p.add(geo('dodec'), 0x8d8a80, [0, -L * 0.62, 0.0], [0.3, 0.6, 0.2], [d.fore * 1.65, L * 0.42, d.fore * 1.6]);
        p.add(geo('dodec'), 0x6d6a62, [sx * d.fore * 0.6, -L * 0.55, -d.fore * 0.5], [0.8, 0.2, 0.5], [d.fore * 0.8, L * 0.25, d.fore * 0.8]);
        p.add(geo('box'), 0xa8823f, [0, -L * 0.36, 0], 0, [d.fore * 2.2, 0.04, d.fore * 2.1]);
        p.add(geo('dodec'), 0x77746b, [0, -L - d.fist * 0.45, 0.02], [0.2, 0.3, 0], [d.fist * 1.05, d.fist * 0.95, d.fist * 1.1]);
      } else {
        p.add(limb(d.fore * 1.0, d.fore * 0.85, L, 8), 0x26282b, [0, 0, 0]);
        // 短臂刃（自手肘朝後延伸）
        const blade = new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0);
        p.add(blade, 0xd8d4c4, [sx * d.fore * 0.75, -L * 0.25, -d.fore * 0.6], [-2.55, 0, sx * 0.12], [0.03, 0.42, 0.012]);
        p.add(geo('box'), 0xffd23a, [sx * d.fore * 0.95, -L * 0.45, 0], 0, [0.02, L * 0.5, 0.05]);
        p.add(geo('sphere'), d.skin, [0, -L - d.fist * 0.55, 0.01], 0, [d.fist, d.fist * 1.05, d.fist * 1.05]);
      }
      out['fore' + side] = p.build();
    }
  }

  /* ------- legs ------- */
  for (const side of ['L', 'R']) {
    const pantsC = { homura: 0x3b302a, shimo: 0x283135, iwao: 0x5a4632, raiga: 0x26282b }[id];
    {
      const p = new Parts();
      const loose = id === 'homura' ? 1.25 : id === 'iwao' ? 1.15 : 1.0;
      p.add(geo('sphere'), pantsC, [0, -0.02, 0], 0, d.thigh * loose * 1.05);
      p.add(limb(d.thigh * loose, d.shin * loose * 1.12, d.thighLen, 8), pantsC, [0, 0, 0]);
      out['thigh' + side] = p.build();
    }
    {
      const p = new Parts();
      const S = d.shinLen;
      const loose = id === 'homura' ? 1.3 : 1.0;
      p.add(geo('sphere'), pantsC, [0, 0, 0], 0, d.shin * loose * 1.1);
      if (id === 'homura') {
        p.add(limb(d.shin * 1.3, d.shin * 1.1, S * 0.75, 8), pantsC, [0, 0, 0]);
        p.add(limb(d.shin * 0.75, d.shin * 0.7, S * 0.3, 8), 0x24201d, [0, -S * 0.72, 0]);
        p.add(geo('box'), 0x6b4a2c, [0, -S - 0.02, 0.05], 0, [d.shin * 1.6, 0.035, d.shin * 3.4]);
        p.add(geo('sphere'), d.skin, [0, -S + 0.01, 0.06], 0, [d.shin * 0.75, 0.035, d.shin * 1.4]);
      } else if (id === 'shimo') {
        p.add(limb(d.shin * 1.0, d.shin * 0.85, S * 0.45, 8), pantsC, [0, 0, 0]);
        p.add(limb(d.shin * 1.15, d.shin * 1.05, S * 0.6, 8), 0x1f2427, [0, -S * 0.42, 0]); // 長靴
        p.add(geo('sphere'), 0x1f2427, [0, -S - 0.01, 0.05], 0, [d.shin * 1.1, 0.05, d.shin * 2.1]);
        p.add(cyl(d.shin * 1.18, d.shin * 1.18, 0.02, 10, true), 0xa8e8ff, [0, -S * 0.42, 0]);
      } else if (id === 'iwao') {
        p.add(limb(d.shin * 1.05, d.shin * 0.9, S * 0.55, 8), pantsC, [0, 0, 0]);
        p.add(limb(d.shin * 0.95, d.shin * 0.85, S * 0.45, 8), d.skin, [0, -S * 0.55, 0]);
        for (let i = 0; i < 3; i++) p.add(cyl(d.shin * 0.98, d.shin * 0.95, 0.035, 10), 0xd9cfb8, [0, -S * (0.68 + i * 0.09), 0], [0.15 * (i % 2 ? 1 : -1), 0, 0]);
        p.add(geo('sphere'), d.skin, [0, -S - 0.01, 0.06], 0, [d.shin * 1.25, 0.06, d.shin * 1.9]);
      } else {
        p.add(limb(d.shin * 1.0, d.shin * 0.8, S, 8), pantsC, [0, 0, 0]);
        p.add(limb(d.shin * 0.9, d.shin * 0.85, S * 0.3, 8), 0x3a3633, [0, -S * 0.7, 0]); // 綁腿
        p.add(geo('sphere'), 0x1c1d1f, [0, -S - 0.01, 0.045], 0, [d.shin * 1.0, 0.045, d.shin * 1.9]);
      }
      out['shin' + side] = p.build();
    }
  }

  /* ------- 次級擺動：布尾、馬尾、辮子、圍巾 ------- */
  const tailSeg = (w, len, c, thick = 0.022) => { const p = new Parts(); p.add(geo('box'), c, [0, -len / 2, 0], 0, [w, len, thick]); return p.build(); };
  if (id === 'raiga') {
    out.scarf = [tailSeg(0.1, 0.28, tc), tailSeg(0.09, 0.26, tc), tailSeg(0.075, 0.22, TEAM_LIGHT[team])];
    out.braid = [0, 1, 2].map((i) => { const p = new Parts(); const r = 0.042 - i * 0.006; p.add(geo('lsphere'), i === 2 ? 0xffd23a : 0xf3e6a0, [0, -0.07, 0], 0, [r, 0.08, r]); return p.build(); });
  } else {
    out.sash = [tailSeg(0.13, 0.3, tc), tailSeg(0.12, 0.28, tc), tailSeg(0.1, 0.22, TEAM_LIGHT[team])];
  }
  if (id === 'shimo') {
    out.pony = [0, 1, 2, 3].map((i) => {
      const p = new Parts(); const len = 0.24, r0 = 0.07 - i * 0.012, r1 = 0.06 - i * 0.014;
      p.add(limb(r0, Math.max(0.012, r1), len, 8), i % 2 ? 0x9fbfcc : 0xc9dde6, [0, 0, 0], 0, [1, 1, 0.8]);
      return p.build();
    });
  }
  if (id === 'homura') {
    // 額前的隊伍色頭帶尾
    out.band = [tailSeg(0.04, 0.16, tc, 0.012), tailSeg(0.035, 0.16, TEAM_LIGHT[team], 0.012)];
  }
  return out;
}

/* ---------------- 姿勢 ---------------- */
const KEYS = ['hipsY', 'hipsZ', 'hipsRX', 'hipsRY', 'hipsRZ', 'torsoX', 'torsoY', 'torsoZ', 'headX', 'headY', 'headZ',
  'shLX', 'shLY', 'shLZ', 'elL', 'shRX', 'shRY', 'shRZ', 'elR', 'thLX', 'thLZ', 'knL', 'thRX', 'thRZ', 'knR', 'spin'];
function blank() { const p = {}; for (const k of KEYS) p[k] = 0; p.shLZ = 0.12; p.shRZ = 0.12; p.elL = -0.15; p.elR = -0.15; return p; }
function lerpPose(a, b, k, out = {}) { for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k; return out; }
const ease = (k) => k * k * (3 - 2 * k);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function stance(style, t) {
  const p = blank();
  const br = Math.sin(t * 2.6);
  if (style === 'mage') {
    Object.assign(p, { hipsY: -0.015 - 0.01 * br, torsoX: 0.02 + 0.015 * br, torsoY: 0.25, headY: -0.2,
      shLX: -0.2, shLZ: 0.2, elL: -0.5, shRX: -0.75, shRZ: 0.35, elR: -1.5,
      thLX: -0.12, thLZ: 0.06, knL: 0.15, thRX: 0.15, thRZ: 0.06, knR: 0.2 });
  } else if (style === 'tank') {
    Object.assign(p, { hipsY: -0.06 - 0.015 * br, torsoX: 0.18 + 0.02 * br, torsoY: 0.15, headX: -0.15,
      shLX: -0.55, shLZ: 0.45, elL: -1.2, shRX: -0.45, shRZ: 0.45, elR: -1.3,
      thLX: -0.2, thLZ: 0.22, knL: 0.38, thRX: 0.2, thRZ: 0.22, knR: 0.38 });
  } else if (style === 'ninja') {
    Object.assign(p, { hipsY: -0.09 - 0.012 * br, torsoX: 0.3 + 0.02 * br, torsoY: 0.35, headX: -0.25, headY: -0.3,
      shLX: -1.0, shLZ: 0.3, elL: -1.7, shRX: 0.5, shRZ: 0.35, elR: -0.6,
      thLX: -0.45, thLZ: 0.12, knL: 0.75, thRX: 0.35, thRZ: 0.1, knR: 0.6 });
  } else {
    Object.assign(p, { hipsY: -0.04 - 0.015 * br, torsoX: 0.08 + 0.02 * br, torsoY: 0.35, headY: -0.3,
      shLX: -0.95, shLZ: 0.25, elL: -1.75, shRX: -0.6, shRZ: 0.3, elR: -2.0,
      thLX: -0.22, thLZ: 0.1, knL: 0.3, thRX: 0.28, thRZ: 0.1, knR: 0.32 });
  }
  return p;
}

// 攻擊：起手 → 打擊（ti 命中）→ 停留 → 收招
function strike(t, ti, base, W, S, rec = 0.36) {
  const a = ti * 0.55;
  if (t < a) return lerpPose(base, W, ease(t / a));
  if (t < ti) return lerpPose(W, S, (t - a) / (ti - a));
  if (t < ti + 0.07) return S;
  return lerpPose(S, base, ease(clamp((t - ti - 0.07) / Math.max(0.05, rec - ti - 0.07), 0, 1)));
}
export const IMPACT = { atk1: 0.1, atk2: 0.12, atk3: 0.16, cast: 0.16, beam: 0.4 };

function heroPose(d, name, t, k, phase, out) {
  const base = stance(d.style, t);
  const P = (o) => Object.assign({ ...base }, o);
  let p = base;
  switch (name) {
    case 'run': {
      const s = Math.sin(phase), c = Math.cos(phase);
      const ninja = d.style === 'ninja';
      p = P({ hipsY: -0.05 + 0.06 * Math.abs(c), torsoX: ninja ? 0.75 : d.style === 'tank' ? 0.32 : 0.28, torsoY: 0.14 * s, headX: ninja ? -0.55 : -0.15, headY: 0,
        thLX: s * 0.95, thRX: -s * 0.95, thLZ: 0.04, thRZ: 0.04,
        knL: 0.35 + 1.1 * Math.max(0, -c), knR: 0.35 + 1.1 * Math.max(0, c),
        shLX: ninja ? 1.25 : -s * 0.85, shRX: ninja ? 1.25 : s * 0.85, shLZ: ninja ? 0.35 : 0.15, shRZ: ninja ? 0.35 : 0.15,
        elL: ninja ? -0.2 : -1.35, elR: ninja ? -0.2 : -1.35 });
      break;
    }
    case 'atk1': {
      const W = P({ torsoY: 0.1, shRX: -0.5, shRZ: 0.25, elR: -2.2, hipsZ: -0.02 });
      const S = P({ torsoY: 0.95, torsoX: 0.15, shRX: -1.55, shRZ: 0.05, shRY: 0, elR: -0.05, hipsZ: 0.08, thRX: 0.45, knR: 0.2, headY: -0.6 });
      p = strike(t, IMPACT.atk1, base, W, S, 0.3);
      break;
    }
    case 'atk2': {
      const W = P({ torsoY: 0.75, shLX: -0.6, shLZ: 1.15, elL: -1.4 });
      const S = P({ torsoY: -0.75, torsoX: 0.18, shLX: -1.45, shLZ: 0.35, elL: -0.75, hipsZ: 0.1, thLX: -0.55, knL: 0.45, headY: 0.4 });
      p = strike(t, IMPACT.atk2, base, W, S, 0.34);
      break;
    }
    case 'atk3': {
      if (d.atk3 === 'smash') {
        const W = P({ torsoX: -0.3, shLX: -2.9, shRX: -2.9, shLZ: 0.2, shRZ: 0.2, elL: -0.6, elR: -0.6, hipsY: 0.02, headX: -0.3 });
        const S = P({ torsoX: 0.75, shLX: -0.85, shRX: -0.85, shLZ: -0.05, shRZ: -0.05, elL: -0.2, elR: -0.2, hipsY: -0.16, hipsZ: 0.12, knL: 0.8, knR: 0.8, thLX: -0.6, thRX: -0.1 });
        p = strike(t, IMPACT.atk3, base, W, S, 0.45);
      } else if (d.atk3 === 'palm') {
        const W = P({ torsoY: -0.8, shRX: 0.4, shRZ: 0.6, elR: -1.6, shLX: -0.8, elL: -1.2 });
        const S = P({ torsoY: 1.1, torsoX: 0.1, shRX: -1.55, shRZ: -0.2, elR: 0, shLX: 0.5, shLZ: 0.5, elL: -0.4, hipsZ: 0.12, thLX: -0.6, knL: 0.5, thRX: 0.5 });
        p = strike(t, IMPACT.atk3, base, W, S, 0.42);
      } else {
        // 迴旋踢
        const W = P({ torsoY: -0.7, torsoX: 0.1, thRX: 0.6, knR: 1.6, hipsY: -0.08 });
        const S = P({ torsoY: 1.0, torsoX: -0.35, torsoZ: 0.25, thRX: -1.65, thRZ: 0.25, knR: 0.05, thLX: 0.1, knL: 0.35, hipsY: 0.04, hipsZ: 0.04,
          shLX: -0.6, shLZ: 0.9, elL: -0.8, shRX: 0.4, shRZ: 0.8, elR: -0.5, headY: -0.7 });
        p = strike(t, IMPACT.atk3, base, W, S, 0.42);
      }
      break;
    }
    case 'cast': {
      const W = P({ torsoY: -0.7, shRX: 0.65, shRZ: 0.3, elR: -1.9, shLX: -0.6, elL: -1.4 });
      const S = P({ torsoY: 0.75, torsoX: 0.1, shRX: -1.6, shRZ: 0.0, elR: 0, shLX: 0.3, shLZ: 0.45, elL: -0.6, hipsZ: 0.08, thLX: -0.45, knL: 0.4, thRX: 0.4, headY: -0.5 });
      p = strike(t, IMPACT.cast, base, W, S, 0.4);
      break;
    }
    case 'beam': {
      const W = P({ torsoY: -1.1, torsoX: 0.1, shLX: 0.35, shLZ: -0.25, elL: -1.7, shRX: 0.55, shRZ: 0.05, elR: -1.6, hipsY: -0.1, thLX: -0.5, knL: 0.6, thRX: 0.5, knR: 0.35, headY: 0.9 });
      const tr = Math.sin(t * 60) * 0.025;
      const S = P({ torsoY: 0.05, torsoX: 0.12 + tr, shLX: -1.5, shLZ: -0.2, elL: -0.12, shRX: -1.5, shRZ: -0.2, elR: -0.12, hipsY: -0.14, hipsZ: 0.06,
        thLX: -0.65, thLZ: 0.2, knL: 0.7, thRX: 0.55, thRZ: 0.15, knR: 0.25, headY: 0, headX: 0.05 });
      if (t < 0.32) p = lerpPose(base, W, ease(clamp(t / 0.25, 0, 1)));
      else if (t < IMPACT.beam) p = lerpPose(W, S, (t - 0.32) / (IMPACT.beam - 0.32));
      else p = S;
      break;
    }
    case 'dash':
      p = P({ torsoX: 0.95, torsoY: 0, headX: -0.75, shLX: 1.05, shRX: 1.05, shLZ: 0.35, shRZ: 0.35, elL: -0.3, elR: -0.3,
        thLX: -0.7, knL: 1.3, thRX: 0.55, knR: 0.9, hipsY: -0.08 });
      break;
    case 'rush': {
      const per = 0.11, i = Math.floor(t / per), f = (t % per) / per;
      const ext = f < 0.45 ? ease(f / 0.45) : 1 - ease((f - 0.45) / 0.55) * 0.85;
      const left = i % 2 === 0;
      const a = left ? ext : 1 - ext;
      p = P({ torsoX: 0.25, torsoY: (left ? -0.5 : 0.5) * ext, hipsZ: 0.05,
        shLX: -0.6 - 1.0 * a, shLZ: 0.15, elL: -1.9 + 1.85 * a, shRX: -0.6 - 1.0 * (1 - a), shRZ: 0.15, elR: -1.9 + 1.85 * (1 - a),
        thLX: -0.5, knL: 0.5, thRX: 0.45, knR: 0.35, hipsY: -0.07 });
      break;
    }
    case 'vanish':
      p = P({ hipsY: -0.28 * Math.min(1, t * 6), torsoX: 0.6, shLX: -1.3, shRX: -1.3, shLZ: -0.4, shRZ: -0.4, elL: -1.8, elR: -1.8, knL: 1.4, knR: 1.4, thLX: -1.0, thRX: -1.0, spin: t * 22 });
      break;
    case 'charge': {
      const tr = Math.sin(t * 70) * 0.02;
      p = P({ hipsY: -0.13, torsoX: -0.18 + tr, torsoY: 0, headX: -0.32, headY: 0,
        shLX: 0.12, shLZ: 0.6, elL: -0.55, shRX: 0.12, shRZ: 0.6, elR: -0.55,
        thLX: -0.32, thLZ: 0.28, knL: 0.6, thRX: -0.32, thRZ: 0.28, knR: 0.6 });
      break;
    }
    case 'stun': {
      const w = Math.sin(t * 6);
      p = P({ torsoZ: 0.22 * w, torsoX: 0.2, torsoY: 0, headZ: 0.32 * Math.sin(t * 6 + 1), headX: 0.25, shLX: 0.1, shLZ: 0.35, elL: -0.3, shRX: 0.1, shRZ: 0.35, elR: -0.3,
        knL: 0.35, knR: 0.35, thLX: -0.15, thRX: -0.15, hipsY: -0.06, hipsZ: 0.03 * w });
      break;
    }
    case 'air': {
      const f = Math.sin(t * 14);
      p = P({ torsoX: -0.7, torsoY: 0, headX: -0.4, shLX: -2.4 + 0.5 * f, shLZ: 0.7, elL: -0.6, shRX: -2.4 - 0.5 * f, shRZ: 0.7, elR: -0.6,
        thLX: -0.7 + 0.4 * f, knL: 1.1, thRX: -0.4 - 0.4 * f, knR: 0.9, hipsRX: -0.25 });
      break;
    }
    case 'dead': {
      const kk = ease(clamp(k != null ? k : t / 0.7, 0, 1));
      const lie = P({ hipsRX: -Math.PI / 2, hipsY: -(d.L - 0.16), torsoX: 0, torsoY: 0, headX: 0.15, headY: 0.4,
        shLX: -0.4, shLZ: 1.3, elL: -0.4, shRX: -0.2, shRZ: 1.1, elR: -0.6, thLX: 0, thLZ: 0.2, knL: 0.4, thRX: -0.3, thRZ: 0.1, knR: 0.8 });
      p = lerpPose(base, lie, kk);
      break;
    }
    case 'win': {
      const b = Math.abs(Math.sin(t * 4));
      p = P({ hipsY: -0.02 + 0.03 * b, torsoX: -0.1, torsoY: 0, headX: -0.3, headY: 0, shRX: -2.95, shRZ: 0.15, elR: -0.25 - 0.2 * b, shLX: 0.15, shLZ: 0.6, elL: -1.6,
        thLX: -0.1, thLZ: 0.15, knL: 0.1, thRX: 0.1, thRZ: 0.15, knR: 0.1 });
      break;
    }
    case 'leap':
      p = P({ torsoX: 0.5, torsoY: 0, headX: -0.4, thLX: -1.5, knL: 1.8, thRX: -1.2, knR: 1.9, shLX: -0.6, shLZ: 0.9, elL: -1.0, shRX: -0.6, shRZ: 0.9, elR: -1.0, hipsY: 0.05 });
      break;
    default: break;
  }
  return lerpPose(p, p, 0, out);
}

/* ---------------- 氣焰（additive shader） ---------------- */
const AURA_VS = `
uniform float uTime; varying vec2 vUv; varying float vRim;
void main(){
  vUv = uv;
  vec3 p = position;
  float a = atan(p.z, p.x);
  float w = 1.0 + 0.22 * sin(uv.y * 7.0 - uTime * 9.0 + a * 3.0) * uv.y + 0.12 * sin(a * 5.0 + uTime * 5.0);
  p.xz *= w;
  p.y += 0.08 * sin(a * 4.0 + uTime * 11.0) * uv.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const AURA_FS = `
uniform float uTime; uniform float uLevel; uniform vec3 uColor; varying vec2 vUv; varying float vRim;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 q = vec2(vUv.x * 9.0, vUv.y * 2.6 - uTime * 2.8);
  float n = n2(q) * 0.65 + n2(q * 2.3 + 4.0) * 0.35;
  float body = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
  float tongue = smoothstep(vUv.y * 0.85 + 0.05, vUv.y * 0.85 + 0.35, n);
  float a = tongue * body * (0.12 + 0.75 * vRim) * uLevel * 0.7;
  vec3 c = mix(uColor, vec3(1.0), clamp(tongue * (1.0 - vUv.y) * 0.4, 0.0, 1.0));
  gl_FragColor = vec4(c * a, a);
  #include <colorspace_fragment>
}`;
let _auraGeo = null;
function makeAura(H) {
  if (!_auraGeo) _auraGeo = new THREE.CylinderGeometry(0.22, 0.58, 1, 20, 6, true).translate(0, 0.5, 0);
  const g = new THREE.Group();
  const mats = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: i * 3.7 }, uLevel: { value: 0 }, uColor: { value: new THREE.Color(0xffffff) } },
      vertexShader: AURA_VS, fragmentShader: AURA_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, toneMapped: false,
    });
    const mesh = new THREE.Mesh(_auraGeo, m);
    const s = i === 0 ? 1 : 0.78;
    mesh.scale.set(s * H / 1.9, H * (i === 0 ? 1.35 : 1.15), s * H / 1.9);
    mesh.position.y = -0.05;
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    g.add(mesh);
    mats.push(m);
  }
  g.visible = false;
  return { group: g, mats };
}

/* ---------------- buildHero ---------------- */
export function buildHero(id, team = 0) {
  const d = HERO[id];
  if (!d) throw new Error('unknown hero ' + id);
  const key = id + ':' + team;
  if (!heroGeoCache.has(key)) heroGeoCache.set(key, buildHeroGeos(id, team));
  const gs = heroGeoCache.get(key);

  const root = new THREE.Group(); root.name = 'hero-' + id;
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = d.L; body.add(hips);
  meshPair(gs.hips, hips);
  const torso = new THREE.Group(); torso.position.y = 0.02; hips.add(torso);
  meshPair(gs.torso, torso);
  const head = new THREE.Group(); head.position.y = d.torso + 0.04; torso.add(head);
  meshPair(gs.head, head);
  const chest = new THREE.Object3D(); chest.position.set(0, d.torso * 0.66, d.chest[2] * 0.5); torso.add(chest);
  const J = { hips, torso, head };
  const hands = {};
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = new THREE.Group(); sh.position.set(sx * d.sw, d.torso - 0.05, 0); torso.add(sh);
    meshPair(gs['upper' + side], sh);
    const el = new THREE.Group(); el.position.y = -d.upper; sh.add(el);
    meshPair(gs['fore' + side], el);
    const hand = new THREE.Object3D(); hand.position.y = -d.lower - d.fist * 0.55; el.add(hand);
    hands[side] = hand;
    const th = new THREE.Group(); th.position.set(sx * d.hip * 0.62, -0.03, 0); hips.add(th);
    meshPair(gs['thigh' + side], th);
    const kn = new THREE.Group(); kn.position.y = -d.thighLen; th.add(kn);
    meshPair(gs['shin' + side], kn);
    J['sh' + side] = sh; J['el' + side] = el; J['th' + side] = th; J['kn' + side] = kn;
  }

  // 次級擺動鏈
  const chains = [];
  const chain = (geos, parent, pos, base, opt = {}) => {
    let par = parent; const segs = [];
    geos.forEach((g, i) => {
      const s = new THREE.Group();
      if (i === 0) s.position.set(pos[0], pos[1], pos[2]); else s.position.y = -opt.lens[i - 1];
      par.add(s);
      meshPair(g, s, { w: opt.w || 0.02 });
      segs.push(s); par = s;
    });
    chains.push({ segs, base, yaw: opt.yaw || 0, lift: opt.lift ?? 1, flutter: opt.flutter ?? 0.25, cur: segs.map(() => base), phase: Math.random() * 6 });
  };
  if (gs.sash) chain(gs.sash, hips, [0.1, 0.07, -d.waist * 1.05], 0.2, { lens: [0.3, 0.28], yaw: 0.2 });
  if (gs.scarf) {
    chain(gs.scarf, head, [0.05, d.hr * 0.55, -d.hr * 0.85], 0.35, { lens: [0.28, 0.26], yaw: 0.2, lift: 1.4, flutter: 0.4 });
    chain(gs.scarf, head, [-0.05, d.hr * 0.5, -d.hr * 0.85], 0.3, { lens: [0.28, 0.26], yaw: -0.25, lift: 1.3, flutter: 0.45 });
  }
  if (gs.braid) chain(gs.braid, head, [0, d.hr * 0.95, -d.hr * 0.85], 0.25, { lens: [0.14, 0.14], lift: 0.9, w: 0.016 });
  if (gs.pony) chain(gs.pony, head, [0, d.hr * 1.9, -d.hr * 0.62], 0.65, { lens: [0.24, 0.24, 0.24], lift: 0.8, flutter: 0.18 });
  if (gs.band) chain(gs.band, head, [0, d.hr * 1.2, -d.hr * 0.98], 0.4, { lens: [0.16], lift: 1.5, flutter: 0.5, w: 0.014 });

  const aura = makeAura(d.H);
  root.add(aura.group);

  // 狀態
  const cur = stance(d.style, 0), tgt = {};
  let phase = 0, time = 0, lastName = 'idle';
  const last = new THREE.Vector3(), vel = new THREE.Vector3();
  let hasLast = false, speed = 0, fwd = 0;

  function update(dt, anim) {
    dt = Math.min(dt, 0.1);
    time += dt;
    const name = (anim && anim.name) || 'idle';
    const t = (anim && anim.t) || 0;
    const k = anim ? anim.k : undefined;
    // 速度（由 root 位移推得）
    if (hasLast && dt > 0) {
      vel.subVectors(root.position, last).divideScalar(dt);
      if (vel.lengthSq() > 900) vel.set(0, 0, 0); // 傳送
      const s = Math.hypot(vel.x, vel.z);
      speed += (s - speed) * (1 - Math.exp(-10 * dt));
      const ry = root.rotation.y;
      fwd = vel.x * Math.sin(ry) + vel.z * Math.cos(ry);
    }
    last.copy(root.position); hasLast = true;
    if (name === 'run') phase += dt * clamp(speed * 1.65, 9, 15);
    heroPose(d, name, t, k, phase, tgt);
    const fast = name.startsWith('atk') || name === 'cast' || name === 'rush' || name === 'vanish' || (name === 'beam' && t > 0.3);
    const rate = name !== lastName && fast ? 45 : fast ? 38 : name === 'dead' ? 9 : 13;
    lastName = name;
    const a = 1 - Math.exp(-rate * dt);
    for (const key of KEYS) cur[key] += (tgt[key] - cur[key]) * a;
    if (name === 'vanish') cur.spin = tgt.spin; else cur.spin = 0;
    apply();
    // 擺動鏈
    const lift = clamp(speed * 0.13, 0, 1.25) + (name === 'dash' || name === 'rush' ? 0.6 : 0) + (name === 'air' ? -0.4 : 0) + (name === 'charge' ? 0.5 : 0);
    for (const c of chains) {
      c.phase += dt * (6 + speed * 1.3);
      c.segs.forEach((s, i) => {
        const fl = Math.sin(c.phase - i * 1.1) * c.flutter * (0.25 + clamp(speed / 7, 0, 1)) * (name === 'charge' ? 2 : 1);
        const target = (i === 0 ? c.base + lift * c.lift : lift * 0.18 * c.lift) + fl;
        c.cur[i] += (target - c.cur[i]) * (1 - Math.exp(-(9 - i * 2) * dt));
        s.rotation.x = c.cur[i];
        if (i === 0) s.rotation.y = c.yaw;
      });
    }
    // 氣焰
    if (aura.group.visible) for (const m of aura.mats) m.uniforms.uTime.value += dt;
    // 集氣時的顫動
    if (name === 'charge') { body.position.x = (Math.random() - 0.5) * 0.02; body.position.z = (Math.random() - 0.5) * 0.02; }
    else { body.position.x = 0; }
  }
  function apply() {
    hips.position.y = d.L + cur.hipsY;
    body.position.z = cur.hipsZ;
    hips.rotation.set(cur.hipsRX, cur.hipsRY, cur.hipsRZ);
    body.rotation.y = cur.spin;
    torso.rotation.set(cur.torsoX, cur.torsoY, cur.torsoZ, 'YXZ');
    head.rotation.set(cur.headX, cur.headY - cur.torsoY * 0.5, cur.headZ, 'YXZ');
    J.shL.rotation.set(cur.shLX, cur.shLY, cur.shLZ);
    J.shR.rotation.set(cur.shRX, -cur.shRY, -cur.shRZ);
    J.elL.rotation.x = cur.elL; J.elR.rotation.x = cur.elR;
    J.thL.rotation.set(cur.thLX, 0, cur.thLZ);
    J.thR.rotation.set(cur.thRX, 0, -cur.thRZ);
    J.knL.rotation.x = cur.knL; J.knR.rotation.x = cur.knR;
  }
  apply();

  function setAura(level, color) {
    const l = clamp(level || 0, 0, 1);
    aura.group.visible = l > 0.005;
    for (const m of aura.mats) {
      m.uniforms.uLevel.value = l;
      if (color != null) m.uniforms.uColor.value.set(color);
    }
    const s = 0.85 + 0.25 * l;
    aura.group.scale.set(s, 0.8 + 0.3 * l, s);
  }
  setAura(0, d.element);

  return {
    root, height: d.H, element: d.element, update, setAura,
    handL: hands.L, handR: hands.R, chest, head,
    get speed() { return speed; }, get forwardSpeed() { return fwd; },
    dispose() { if (root.parent) root.parent.remove(root); for (const m of aura.mats) m.dispose(); },
  };
}

/* ---------------- 小兵 ---------------- */
const minionGeoCache = new Map();
function minionGeos(team, kind) {
  const key = team + kind;
  if (minionGeoCache.has(key)) return minionGeoCache.get(key);
  const tc = TEAM[team], tl = TEAM_LIGHT[team];
  const out = {};
  if (kind === 'melee') {
    const clay = 0xb9734a, clayD = 0x8f5434;
    {
      const p = new Parts();
      p.add(geo('lsphere'), clay, [0, 0.42, 0], 0, [0.27, 0.3, 0.24]);           // 軀幹
      p.add(geo('lsphere'), clay, [0, 0.83, 0.01], 0, [0.2, 0.19, 0.19]);          // 頭
      p.add(cyl(0.21, 0.24, 0.1, 10), tc, [0, 0.93, 0]);                          // 頭盔帶
      p.add(geo('cone8'), clayD, [0, 0.95, 0], 0, [0.22, 0.17, 0.22]);             // 斗笠
      p.add(geo('cone6'), tc, [0, 1.11, 0], 0, [0.025, 0.08, 0.025]);
      for (const sx of [-1, 1]) {
        p.add(geo('box'), 0x2b1a10, [sx * 0.065, 0.82, 0.18], 0, [0.06, 0.018, 0.02]); // 眼縫
      }
      p.add(cyl(0.255, 0.27, 0.08, 10), tc, [0, 0.36, 0]);                          // 腰帶
      p.add(geo('box'), clayD, [0, 0.55, 0.2], [0.2, 0, 0], [0.18, 0.12, 0.04]);     // 胸甲片
      out.body = p.build();
    }
    {
      const p = new Parts();
      for (const sx of [-1, 1]) p.add(geo('lsphere'), clayD, [sx * 0.11, 0.07, 0.03], 0, [0.08, 0.07, 0.11]);
      out.feet = p.build();
    }
    {
      // 盾臂（左），盾面朝 +z
      const p = new Parts();
      p.add(limb(0.06, 0.055, 0.2, 8), clay, [0, 0, 0]);
      p.add(geo('disc'), tc, [0.04, -0.2, 0.1], [Math.PI / 2, 0, 0], [0.22, 0.04, 0.22]);
      p.add(cyl(0.235, 0.235, 0.035, 14, true), clayD, [0.04, -0.2, 0.1], [Math.PI / 2, 0, 0]);
      p.add(geo('lsphere'), 0xd9c08a, [0.04, -0.2, 0.125], 0, [0.05, 0.05, 0.03]);
      out.shield = p.build();
    }
    {
      // 棍臂（右），棍向前下
      const p = new Parts();
      p.add(limb(0.06, 0.055, 0.2, 8), clay, [0, 0, 0]);
      p.add(geo('lsphere'), clay, [0, -0.22, 0], 0, 0.065);
      const club = limb(0.035, 0.07, 0.42, 8);
      p.add(club, 0x7a5634, [0, -0.22, 0.02], [-Math.PI * 0.62, 0, 0]);
      out.club = p.build();
    }
  } else {
    const paper = 0xf2e3c4, wood = 0x5a3a22;
    {
      const p = new Parts();
      p.add(geo('lsphere'), paper, [0, 0, 0], 0, [0.26, 0.3, 0.26]);
      for (const y of [-0.17, 0, 0.17]) p.add(new THREE.TorusGeometry(0.255 * Math.sqrt(1 - (y / 0.31) ** 2), 0.012, 3, 12), 0x8a5a30, [0, y, 0], [Math.PI / 2, 0, 0]);
      p.add(cyl(0.12, 0.14, 0.06, 8), wood, [0, 0.3, 0]);
      p.add(cyl(0.14, 0.12, 0.06, 8), wood, [0, -0.3, 0]);
      p.add(new THREE.TorusGeometry(0.06, 0.012, 4, 10), wood, [0, 0.37, 0]);
      // 臉窗
      p.add(geo('lsphere'), tl, [0, 0.0, 0.205], 0, [0.15, 0.15, 0.06]);
      for (const sx of [-1, 1]) p.add(geo('lsphere'), 0x1d1410, [sx * 0.055, 0.02, 0.255], 0, [0.025, 0.04, 0.012]);
      p.add(geo('lsphere'), 0x1d1410, [0, -0.05, 0.255], 0, [0.03, 0.012, 0.01]);
      // 流蘇
      p.add(geo('cone6'), tc, [0, -0.33, 0], [Math.PI, 0, 0], [0.05, 0.22, 0.05]);
      p.add(geo('lsphere'), tc, [0, -0.36, 0], 0, 0.035);
      out.body = p.build();
    }
  }
  minionGeoCache.set(key, out);
  return out;
}

export function buildMinion(team = 0, kind = 'melee') {
  const gs = minionGeos(team, kind);
  const root = new THREE.Group(); root.name = 'minion-' + kind;
  const body = new THREE.Group(); root.add(body);
  let time = 0;
  if (kind === 'melee') {
    meshPair(gs.body, body, { w: 0.022 });
    const feet = meshPair(gs.feet, root, { outline: false });
    const shield = new THREE.Group(); shield.position.set(0.27, 0.5, 0.02); body.add(shield);
    meshPair(gs.shield, shield, { w: 0.02 });
    const club = new THREE.Group(); club.position.set(-0.27, 0.5, 0.02); body.add(club);
    meshPair(gs.club, club, { outline: false });
    shield.rotation.set(-0.5, 0, 0.25);
    const update = (dt, anim) => {
      time += dt;
      const name = (anim && anim.name) || 'idle', t = (anim && anim.t) || 0;
      body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); feet.visible = true; root.scale.setScalar(1);
      feet.position.set(0, 0, 0);
      let clubX = 0.3;
      if (name === 'walk') {
        const s = Math.sin(time * 11);
        body.rotation.z = 0.13 * s; body.position.y = 0.04 * Math.abs(s); body.rotation.x = 0.1;
        feet.rotation.y = 0.15 * s;
        clubX = 0.3 + 0.25 * s;
      } else if (name === 'atk') {
        // 0.15 秒落棍
        const k = t < 0.12 ? -ease(t / 0.12) : t < 0.2 ? -1 + 2.2 * ease((t - 0.12) / 0.08) : 1.2 - 0.9 * ease(clamp((t - 0.2) / 0.3, 0, 1));
        clubX = -k * 1.3;
        body.rotation.x = 0.1 + 0.25 * Math.max(0, k);
        body.rotation.y = -0.2 * k;
      } else if (name === 'dead') {
        body.rotation.z = -1.4 * ease(clamp(t / 0.4, 0, 1));
        body.position.y = -0.4 * clamp((t - 0.6) / 0.8, 0, 1);
        body.position.x = -0.35 * ease(clamp(t / 0.4, 0, 1));
        feet.visible = t < 0.4;
        const sc = 1 - clamp((t - 1.0) / 0.5, 0, 1);
        root.scale.setScalar(Math.max(0.001, sc));
        clubX = 0.3;
      } else {
        body.position.y = 0.012 * Math.sin(time * 3);
      }
      club.rotation.x = clubX;
    };
    return { root, update, muzzle: club };
  }
  // ranged
  const lantern = new THREE.Group(); lantern.position.y = 0.72; body.add(lantern);
  const lm = meshPair(gs.body, lantern, { w: 0.02 });
  const glowMat = new THREE.MeshBasicMaterial({ color: TEAM_LIGHT[team], transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(geo('lsphere'), glowMat); glow.scale.setScalar(0.34); lantern.add(glow);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.3); lantern.add(muzzle);
  const update = (dt, anim) => {
    time += dt;
    const name = (anim && anim.name) || 'idle', t = (anim && anim.t) || 0;
    root.scale.setScalar(1);
    lantern.position.set(0, 0.72 + 0.07 * Math.sin(time * 2.6), 0);
    lantern.rotation.set(0, 0, 0.06 * Math.sin(time * 1.7));
    glowMat.opacity = 0;
    if (name === 'walk') { lantern.rotation.x = 0.22; lantern.rotation.z = 0.1 * Math.sin(time * 6); }
    else if (name === 'atk') {
      const k = t < 0.1 ? -t / 0.1 : t < 0.18 ? -1 + 2 * (t - 0.1) / 0.08 : Math.max(0, 1 - (t - 0.18) / 0.25);
      lantern.rotation.x = 0.4 * k; lantern.position.z = 0.12 * Math.max(0, k);
      glowMat.opacity = 0.5 * Math.max(0, k);
    } else if (name === 'dead') {
      lantern.rotation.x = 1.3 * ease(clamp(t / 0.5, 0, 1));
      lantern.position.y = 0.72 - 0.6 * ease(clamp(t / 0.7, 0, 1));
      root.scale.setScalar(Math.max(0.001, 1 - clamp((t - 0.9) / 0.5, 0, 1)));
    }
  };
  lm.userData.lantern = true;
  return { root, update, muzzle };
}

/* ---------------- 防禦塔 ---------------- */
const WHITE = new THREE.Color(0xffffff);
const STONE = 0xc2b8a3, STONE_D = 0x8f8676, STONE_DD = 0x6f6759, BRONZE = 0xa8823f;
const towerGeoCache = {};
function towerGeos(team) {
  if (towerGeoCache[team]) return towerGeoCache[team];
  const tc = TEAM[team];
  const out = {};
  {
    const p = new Parts();
    p.add(cyl(2.0, 2.2, 0.45, 8), STONE_D, [0, 0.22, 0], [0, Math.PI / 8, 0]);
    p.add(cyl(1.55, 1.7, 0.45, 8), STONE, [0, 0.66, 0], [0, Math.PI / 8, 0]);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      p.add(geo('box'), STONE_DD, [Math.cos(a) * 1.75, 0.55, Math.sin(a) * 1.75], [0, -a, 0], [0.35, 0.7, 0.35]);
    }
    out.base = p.build();
  }
  {
    const p = new Parts();
    p.add(cyl(0.62, 0.95, 4.3, 8), STONE, [0, 0.9 + 2.15, 0], [0, Math.PI / 8, 0]);
    p.add(cyl(1.0, 1.0, 0.18, 8), BRONZE, [0, 1.25, 0], [0, Math.PI / 8, 0]);
    p.add(cyl(0.75, 0.75, 0.16, 8), BRONZE, [0, 4.3, 0], [0, Math.PI / 8, 0]);
    // 隊伍色布幡
    for (const sx of [-1, 1]) {
      p.add(geo('box'), tc, [sx * 0.78, 3.0, 0], [0, 0, sx * 0.08], [0.06, 2.0, 0.55]);
      p.add(geo('cone6'), tc, [sx * 0.82, 1.98, 0], [Math.PI, 0, 0], [0.32, 0.25, 0.04]);
      p.add(geo('box'), 0xefe2c0, [sx * 0.815, 3.3, 0], [0, 0, sx * 0.08], [0.02, 0.5, 0.25]);
    }
    // 頂部蓮座
    p.add(cyl(1.15, 0.6, 0.55, 8), STONE_D, [0, 5.32, 0], [0, Math.PI / 8, 0]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      p.add(geo('cone6'), STONE, [Math.cos(a) * 0.95, 5.55, Math.sin(a) * 0.95], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], [0.16, 0.5, 0.12]);
    }
    out.pillar = p.build();
  }
  {
    const p = new Parts();
    // 裂痕（細深色條）
    const cracks = [[0.7, 2.4, 0.3, 0.5], [0.72, 3.4, -0.4, -0.3], [-0.68, 2.0, 0.2, 0.9], [0.1, 3.9, 0.66, 0.2], [-0.2, 2.8, -0.75, -0.6]];
    for (const [x, y, z, r] of cracks) {
      const a = Math.atan2(z, x);
      p.add(geo('box'), 0x2d241c, [x * 1.08, y, z * 1.08], [0, -a + Math.PI / 2, r], [0.04, 0.55, 0.03]);
      p.add(geo('box'), 0x2d241c, [x * 1.08, y - 0.25, z * 1.08], [0, -a + Math.PI / 2, -r], [0.035, 0.35, 0.03]);
    }
    out.cracks = p.build();
  }
  {
    const p = new Parts();
    p.add(cyl(0.7, 0.95, 1.2, 8), STONE, [0, 1.5, 0], [0, Math.PI / 8, 0]);
    const ch = [[1.2, 0.3, 0.6, 0.5], [-1.0, 0.25, 1.1, 0.4], [0.4, 0.3, -1.4, 0.55], [-1.5, 0.2, -0.6, 0.35], [1.6, 0.2, -0.9, 0.3], [0.2, 2.15, 0.1, 0.35], [-0.5, 0.35, 0.2, 0.45]];
    ch.forEach(([x, y, z, s], i) => p.add(geo('dodec'), i % 2 ? STONE : STONE_D, [x, y + 0.6, z], [i, i * 2, i * 0.5], [s * 1.4, s, s * 1.2]));
    p.add(geo('box'), tc, [1.3, 0.85, 0.2], [0.2, 0.4, 1.4], [0.06, 1.2, 0.5]);
    out.rubble = p.build();
  }
  towerGeoCache[team] = out;
  return out;
}

export function buildTower(team = 0) {
  const gs = towerGeos(team);
  const root = new THREE.Group(); root.name = 'tower';
  meshPair(gs.base, root, { w: 0.05 });
  const top = new THREE.Group(); root.add(top);
  meshPair(gs.pillar, top, { w: 0.05 });
  const cracks = new THREE.Mesh(gs.cracks, toonVC()); cracks.visible = false; top.add(cracks);
  const rubble = new THREE.Group(); rubble.visible = false; root.add(rubble);
  meshPair(gs.rubble, rubble, { w: 0.05 });
  const orbMat = new THREE.MeshToonMaterial({ color: TEAM[team], emissive: TEAM_LIGHT[team], emissiveIntensity: 0.6, gradientMap: gradientMap() });
  const orb = new THREE.Mesh(geo('oct'), orbMat); orb.scale.set(0.55, 0.8, 0.55); orb.castShadow = true;
  const orbO = new THREE.Mesh(geo('oct'), outlineMat(0.05)); orb.add(orbO);
  const muzzle = new THREE.Group(); muzzle.position.y = 6.75; top.add(muzzle);
  muzzle.add(orb);
  const ringMat = new THREE.MeshBasicMaterial({ color: TEAM_LIGHT[team], transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 4, 32), ringMat); ring.rotation.x = Math.PI / 2; muzzle.add(ring);
  let time = 0;
  const base = new THREE.Color(TEAM_LIGHT[team]);
  const update = (dt, s = {}) => {
    time += dt;
    const charge = clamp(s.charge || 0, 0, 1), hp = s.hp == null ? 1 : s.hp;
    if (s.dead) { top.visible = false; rubble.visible = true; return; }
    top.visible = true; rubble.visible = false;
    orb.rotation.y += dt * (0.8 + charge * 6);
    muzzle.position.y = 6.75 + 0.15 * Math.sin(time * 1.8);
    orbMat.emissiveIntensity = 0.55 + charge * 1.1;
    orbMat.emissive.copy(base).lerp(WHITE, charge * 0.2);
    const sc = 1 + charge * 0.35;
    orb.scale.set(0.55 * sc, 0.8 * sc, 0.55 * sc);
    ring.scale.setScalar(1 + charge * 0.4 + 0.05 * Math.sin(time * 3));
    ring.rotation.z += dt * 0.6;
    ringMat.opacity = 0.35 + charge * 0.5;
    cracks.visible = hp < 0.66;
    top.rotation.z = hp < 0.33 ? 0.035 : 0;
    top.rotation.x = hp < 0.33 ? -0.02 : 0;
  };
  update(0, {});
  return { root, update, muzzle };
}

/* ---------------- 主堡 ---------------- */
const coreGeoCache = {};
function coreGeos(team) {
  if (coreGeoCache[team]) return coreGeoCache[team];
  const tc = TEAM[team];
  const out = {};
  {
    const p = new Parts();
    p.add(cyl(4.2, 4.5, 0.5, 16), STONE_D, [0, 0.25, 0]);
    p.add(cyl(3.3, 3.5, 0.5, 16), STONE, [0, 0.75, 0]);
    p.add(cyl(2.2, 2.4, 0.4, 12), STONE_D, [0, 1.2, 0]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      p.add(geo('box'), i % 2 ? tc : STONE_DD, [Math.cos(a) * 3.9, 0.62, Math.sin(a) * 3.9], [0, -a, 0], [0.5, 0.25, 0.8]);
    }
    // 四支小柱
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      p.add(cyl(0.22, 0.28, 2.2, 8), STONE, [Math.cos(a) * 3.0, 2.0, Math.sin(a) * 3.0]);
      p.add(geo('oct'), BRONZE, [Math.cos(a) * 3.0, 3.25, Math.sin(a) * 3.0], 0, [0.25, 0.35, 0.25]);
    }
    out.dais = p.build();
  }
  {
    const p = new Parts();
    p.add(new THREE.TorusGeometry(2.6, 0.13, 6, 40), STONE_D, [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; p.add(geo('box'), BRONZE, [Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6], [0, -a, 0], [0.2, 0.36, 0.36]); }
    out.ringA = p.build();
    const q = new Parts();
    q.add(new THREE.TorusGeometry(2.2, 0.08, 6, 40), BRONZE, [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; q.add(geo('oct'), tc, [Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2], 0, 0.18); }
    out.ringB = q.build();
  }
  {
    const p = new Parts();
    const sh = [[1.6, 0.3, 0.8, 0.5, 0.9], [-1.2, 0.25, 1.4, 0.4, 0.7], [0.3, 0.35, -1.6, 0.6, 1.0], [-1.8, 0.2, -0.5, 0.35, 0.6], [0.6, 0.25, 0.2, 0.7, 1.2], [-0.4, 0.2, -0.3, 0.45, 0.8]];
    sh.forEach(([x, y, z, s, h], i) => p.add(geo('oct'), i % 2 ? tc : TEAM_LIGHT[team], [x, y + 1.35, z], [i * 0.7, i, 0.6 + i * 0.3], [s * 0.6, h, s * 0.6]));
    out.shards = p.build();
  }
  coreGeoCache[team] = out;
  return out;
}
const SHIELD_FS = `
uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float band = 0.5 + 0.5 * sin(vP.y * 5.0 - uTime * 2.5);
  float hex = step(0.92, fract(vP.y * 3.0 + sin(vP.x * 2.0) * 0.2)) * 0.4;
  float a = (rim * 0.55 + band * rim * 0.25 + hex * rim) * 0.85;
  gl_FragColor = vec4(uColor * a, a);
  #include <colorspace_fragment>
}`;
const SHIELD_VS = `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;

export function buildCore(team = 0) {
  const gs = coreGeos(team);
  const root = new THREE.Group(); root.name = 'core';
  meshPair(gs.dais, root, { w: 0.06 });
  const crystalMat = new THREE.MeshToonMaterial({ color: TEAM[team], emissive: TEAM_LIGHT[team], emissiveIntensity: 0.55, gradientMap: gradientMap() });
  const crystal = new THREE.Group(); crystal.position.y = 4.6; root.add(crystal);
  const big = new THREE.Mesh(geo('oct'), crystalMat); big.scale.set(1.5, 2.6, 1.5); big.castShadow = true; crystal.add(big);
  big.add(new THREE.Mesh(geo('oct'), outlineMat(0.06)));
  const sats = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(geo('oct'), crystalMat); s.scale.set(0.35, 0.7, 0.35); s.castShadow = true;
    s.add(new THREE.Mesh(geo('oct'), outlineMat(0.04)));
    crystal.add(s); sats.push(s);
  }
  const ringA = new THREE.Group(); ringA.position.y = 4.4; root.add(ringA); meshPair(gs.ringA, ringA, { w: 0.04 });
  const ringB = new THREE.Group(); ringB.position.y = 4.4; root.add(ringB); meshPair(gs.ringB, ringB, { w: 0.03 });
  ringA.rotation.x = 0.35; ringB.rotation.z = -0.5;
  const ringAP = new THREE.Group(); ringAP.position.y = 4.4; root.add(ringAP); ringAP.add(ringA); ringA.position.y = 0;
  const ringBP = new THREE.Group(); ringBP.position.y = 4.4; root.add(ringBP); ringBP.add(ringB); ringB.position.y = 0;
  const shards = new THREE.Group(); shards.visible = false; root.add(shards); meshPair(gs.shards, shards, { w: 0.04 });
  const shieldMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(TEAM_LIGHT[team]) } }, vertexShader: SHIELD_VS, fragmentShader: SHIELD_FS,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.FrontSide, toneMapped: false });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(4.6, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), shieldMat);
  shield.position.y = 0.6; shield.renderOrder = 4; root.add(shield);
  let time = 0;
  const update = (dt, s = {}) => {
    time += dt;
    const hp = s.hp == null ? 1 : s.hp;
    if (s.dead) {
      crystal.visible = false; ringAP.visible = false; ringBP.visible = false; shield.visible = false; shards.visible = true; return;
    }
    crystal.visible = true; ringAP.visible = ringBP.visible = true; shards.visible = false;
    crystal.position.y = 4.6 + 0.2 * Math.sin(time * 1.2);
    big.rotation.y += dt * 0.4;
    sats.forEach((m, i) => { const a = time * 0.9 + i * 2.094; m.position.set(Math.cos(a) * 2.0, Math.sin(time * 1.5 + i) * 0.5, Math.sin(a) * 2.0); m.rotation.y = a; });
    ringAP.rotation.y += dt * 0.5; ringBP.rotation.y -= dt * 0.7;
    let ei = 0.55 + 0.15 * Math.sin(time * 2);
    if (hp < 0.35) ei *= (Math.sin(time * 23) > 0.2 ? 1.6 : 0.35);
    crystalMat.emissiveIntensity = ei;
    shield.visible = !s.vulnerable;
    shieldMat.uniforms.uTime.value = time;
  };
  update(0, {});
  return { root, update };
}
