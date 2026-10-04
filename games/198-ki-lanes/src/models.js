// 程式建模：英雄（七龍珠 FighterZ 同人致敬，全部以基本幾何程式產生，不使用任何原作素材）、小兵、野怪、防禦塔、主堡。全部由基本幾何合併而成（頂點色＋一個共用卡通材質），外框用反向殼。
// 介面見 SPEC.md §4。root 朝 +z 為正面。
import * as THREE from 'three';

export const HERO_IDS = ['goku', 'vegeta', 'trunks', 'piccolo', 'frieza', 'a18'];

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
    case 'sphere': G[name] = new THREE.SphereGeometry(1, 10, 8); break;
    case 'hsphere': G[name] = new THREE.SphereGeometry(1, 14, 10); break;
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

/* ---------------- 英雄定義（七龍珠 FighterZ 同人致敬，程式建模） ---------------- */
const HERO = {
  goku: { H: 1.85, L: 0.8, hr: 0.218, sw: 0.26, chest: [0.26, 0.31, 0.19], waist: 0.18, arm: 0.078, fore: 0.073, fist: 0.098, thigh: 0.13, shin: 0.098, hip: 0.13,
    skin: 0xf2c49b, style: 'brawler', atk3: 'kick', element: 0x4fc3ff, saiyan: true },
  vegeta: { H: 1.72, L: 0.74, hr: 0.208, sw: 0.25, chest: [0.25, 0.3, 0.185], waist: 0.165, arm: 0.076, fore: 0.071, fist: 0.095, thigh: 0.118, shin: 0.092, hip: 0.122,
    skin: 0xefc29a, style: 'proud', atk3: 'kick', element: 0xffd84a, saiyan: true },
  trunks: { H: 1.85, L: 0.82, hr: 0.208, sw: 0.24, chest: [0.235, 0.3, 0.172], waist: 0.155, arm: 0.068, fore: 0.064, fist: 0.087, thigh: 0.108, shin: 0.084, hip: 0.118,
    skin: 0xf3cba5, style: 'sword', atk3: 'sword', element: 0xffb03a, saiyan: true },
  piccolo: { H: 2.12, L: 0.95, hr: 0.2, sw: 0.275, chest: [0.27, 0.32, 0.185], waist: 0.17, arm: 0.078, fore: 0.072, fist: 0.098, thigh: 0.125, shin: 0.092, hip: 0.13,
    skin: 0x62b23e, style: 'tank', atk3: 'kick', element: 0xc8ff5a },
  frieza: { H: 1.55, L: 0.66, hr: 0.19, sw: 0.19, chest: [0.19, 0.26, 0.15], waist: 0.125, arm: 0.058, fore: 0.055, fist: 0.07, thigh: 0.088, shin: 0.07, hip: 0.105,
    skin: 0xf6f3ef, style: 'regal', atk3: 'palm', element: 0xff4fb4 },
  a18: { H: 1.72, L: 0.8, hr: 0.196, sw: 0.2, chest: [0.2, 0.27, 0.15], waist: 0.13, arm: 0.056, fore: 0.052, fist: 0.07, thigh: 0.096, shin: 0.075, hip: 0.118,
    skin: 0xf6d2b8, style: 'cool', atk3: 'kick', element: 0xc7f0ff },
};
for (const id in HERO) {
  const d = HERO[id];
  d.torso = d.H - d.L - d.hr * 1.95 - 0.04;
  d.upper = d.torso * 0.5; d.lower = d.torso * 0.47;
  d.thighLen = d.L * 0.5; d.shinLen = d.L * 0.44;
}

const C = {
  // 悟空
  gi: 0xff8a1c, giD: 0xe06a10, blue: 0x2346a8, blueD: 0x182f78, red: 0xc8302a, yellow: 0xf2c230, black: 0x1b1714,
  // 貝吉塔
  suit: 0x2f4fc8, armor: 0xf4f2ea, ochre: 0xe2ad2c,
  // 特南克斯
  jacket: 0x1d2238, tank: 0x141416, grey: 0x707480, lav: 0xb9a6e6, lavD: 0x9784cc, steel: 0xdfe6ee, hilt: 0x3a2a1e, sheath: 0x5a4a2a,
  // 比克
  pgi: 0x5b3c8e, pgiD: 0x46296f, sash: 0x5ab4e4, brown: 0x6a4024, pink: 0xe08e9c, gD: 0x3f8a28,
  // 弗利沙
  dome: 0x7a3dc0, domeL: 0xb27ae8,
  // 18 號
  denim: 0x3d6db6, denimD: 0x2c5290, blonde: 0xf3d977, blondeD: 0xd9b84e, stripeW: 0xf2f0ea, legging: 0x1c1c22, boot: 0x7a4a2a,
  gold: 0xffd23f, goldL: 0xfff0a0,
};

const heroGeoCache = new Map();

function buildHeroGeos(id, team) {
  const d = HERO[id];
  const tc = TEAM[team];
  const out = {};
  const hr = d.hr, s = hr / 0.21;
  const cy = hr * 0.9;
  const T = d.torso, [cx, cyc, cz] = d.chest;

  const face = (p0, { brow = 0x2a1a12, iris = 0x1d1410, browTilt = 0.35, eyeY = 0.86, pupil = null, sharp = 1, browW = 0.075, lid = 0x1a120c } = {}) => {
    const p = p0.face || p0;
    for (const sx of [-1, 1]) {
      const x = 0.07 * s * sx, y = cy - hr * (1 - eyeY) - 0.005;
      const z = Math.sqrt(Math.max(0, hr * hr - x * x - (y - cy) * (y - cy))) * 0.985;
      const tilt = -sx * 0.22 * sharp, yaw = sx * 0.3;
      // 動畫眼：白色眼白（外眼角上揚）、深色瞳孔、上眼線、反光
      p.add(geo('sphere'), 0xfbf8f2, [x, y, z], [0, yaw, tilt], [0.041 * s, 0.031 * s, 0.012 * s]);
      p.add(geo('sphere'), iris, [x - sx * 0.006 * s, y - 0.002 * s, z + 0.006 * s], [0, yaw, 0], [0.018 * s, 0.025 * s, 0.009 * s]);
      if (pupil != null) p.add(geo('lsphere'), pupil, [x - sx * 0.006 * s, y - 0.002 * s, z + 0.011 * s], [0, yaw, 0], [0.007 * s, 0.011 * s, 0.004 * s]);
      p.add(geo('lsphere'), 0xffffff, [x + 0.003 * s, y + 0.008 * s, z + 0.014 * s], 0, [0.006 * s, 0.007 * s, 0.003 * s]);
      p.add(geo('box'), lid, [x, y + 0.023 * s, z + 0.004 * s], [0, yaw, tilt * 1.2], [0.08 * s, 0.009 * s, 0.012 * s]);
      if (brow != null) p.add(geo('box'), brow, [x * 1.05, y + 0.058 * s, z - 0.002], [0, yaw, sx * browTilt], [browW * s, 0.019 * s, 0.02 * s]);
    }
    p.add(geo('lsphere'), 0x8a5a40, [0, cy - hr * 0.3, hr * 0.99], 0, [0.007, 0.005, 0.004]);
    p.add(geo('box'), 0x6a3a2a, [0, cy - hr * 0.5, hr * 0.9], 0, [0.04 * s, 0.006, 0.006]);
  };
  const skull = (p, skin) => {
    p.add(geo('hsphere'), skin, [0, cy, 0], 0, [hr * 0.98, hr, hr * 0.96]);
    // 下顎（略尖）
    p.add(geo('sphere'), skin, [0, cy - hr * 0.45, hr * 0.28], 0, [hr * 0.62, hr * 0.5, hr * 0.62]);
  };
  const ears = (p, skin) => { for (const sx of [-1, 1]) p.add(geo('lsphere'), skin, [sx * hr * 0.95, cy - 0.01, -0.01], 0, [0.03, 0.05, 0.035]); };
  // 尖刺（cone6 頂點朝 +y）：從 [x,y,z]（以 hr=0.21 為基準）以旋轉 r 放置
  const spike = (p, c, x, y, z, rx, rz, w, h, ry = 0) => p.add(geo('cone6'), c, [x * s, cy + y * s, z * s], [rx, ry, rz], [w * s, h * s, w * 0.85 * s]);

  /* ---------------- 頭（含髮型、各型態） ---------------- */
  const heads = {};
  if (id === 'goku') {
    for (const form of ['base', 'ssj']) {
      const p = new Parts(); p.face = new Parts();
      skull(p, d.skin); ears(p, d.skin);
      const ssj = form === 'ssj';
      face(p, { browTilt: ssj ? 0.5 : 0.32, iris: ssj ? 0x1f9a88 : 0x1d1410, sharp: ssj ? 1.4 : 1 });
      const hc = ssj ? C.gold : C.black, hl = ssj ? C.goldL : 0x2c2622;
      const cap = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, 1.3);
      p.add(cap, hc, [0, cy + 0.02, -0.02], [-0.5, 0, 0], [hr * 1.08, hr * 1.08, hr * 1.1]);
      if (!ssj) {
        // 棕櫚葉般向外放射的大尖刺
        const S = [
          [0.0, 0.22, 0.02, -0.15, 0, 0.12, 0.36], [0.1, 0.19, -0.02, -0.3, -0.75, 0.11, 0.34], [-0.1, 0.19, -0.02, -0.3, 0.75, 0.11, 0.34],
          [0.17, 0.08, -0.04, -0.2, -1.45, 0.1, 0.32], [-0.17, 0.08, -0.04, -0.2, 1.45, 0.1, 0.32],
          [0.13, 0.12, -0.14, -1.0, -0.9, 0.1, 0.32], [-0.13, 0.12, -0.14, -1.0, 0.9, 0.1, 0.32],
          [0.0, 0.08, -0.18, -1.5, 0, 0.11, 0.3], [0.08, -0.02, -0.18, -2.0, -0.4, 0.09, 0.26], [-0.08, -0.02, -0.18, -2.0, 0.4, 0.09, 0.26],
          [0.19, -0.02, -0.06, 0.3, -2.0, 0.08, 0.24], [-0.19, -0.02, -0.06, 0.3, 2.0, 0.08, 0.24],
        ];
        S.forEach(([x, y, z, rx, rz, w, h], i) => spike(p, i % 3 === 1 ? hl : hc, x, y, z, rx, rz, w, h));
        // 前額瀏海：3～4 綹往下垂
        [[-0.1, 2.5, 0.35, 0.15], [-0.03, 2.75, 0.1, 0.17], [0.05, 2.65, -0.2, 0.15], [0.12, 2.4, -0.45, 0.12]].forEach(([x, rx, rz, h]) =>
          spike(p, hc, x, 0.16, 0.13, rx, rz, 0.045, h));
      } else {
        // 超級賽亞人：全部往上、往後豎起
        const S = [
          [0.0, 0.2, 0.06, -0.12, 0, 0.12, 0.46], [0.09, 0.2, 0.0, -0.25, -0.38, 0.12, 0.44], [-0.09, 0.2, 0.0, -0.25, 0.38, 0.12, 0.44],
          [0.16, 0.12, -0.04, -0.3, -0.85, 0.1, 0.4], [-0.16, 0.12, -0.04, -0.3, 0.85, 0.1, 0.4],
          [0.08, 0.16, -0.12, -0.75, -0.35, 0.11, 0.42], [-0.08, 0.16, -0.12, -0.75, 0.35, 0.11, 0.42],
          [0.0, 0.1, -0.17, -1.1, 0, 0.11, 0.38], [0.15, 0.02, -0.13, -1.3, -0.8, 0.09, 0.32], [-0.15, 0.02, -0.13, -1.3, 0.8, 0.09, 0.32],
        ];
        S.forEach(([x, y, z, rx, rz, w, h], i) => spike(p, i % 3 === 1 ? hl : hc, x, y, z, rx, rz, w, h));
        spike(p, hc, -0.04, 0.16, 0.14, 2.7, 0.25, 0.045, 0.17); // 單一綹瀏海
      }
      heads[form] = { main: p.build(), face: p.face.build() };
    }
  } else if (id === 'vegeta') {
    for (const form of ['base', 'ssj']) {
      const p = new Parts(); p.face = new Parts();
      skull(p, d.skin); ears(p, d.skin);
      const ssj = form === 'ssj';
      face(p, { browTilt: 0.55, iris: ssj ? 0x1f9a88 : 0x1d1410, sharp: 1.6, browW: 0.085 });
      const hc = ssj ? C.gold : C.black, hl = ssj ? C.goldL : 0x2c2622;
      // 高髮際：髮帽只蓋頭頂與後腦
      const cap = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, 1.15);
      p.add(cap, hc, [0, cy + 0.03, -0.035], [-0.62, 0, 0], [hr * 1.06, hr * 1.06, hr * 1.08]);
      // 美人尖（M 形髮際）
      spike(p, hc, 0, 0.17, 0.14, 2.35, 0, 0.07, 0.12);
      for (const sx of [-1, 1]) spike(p, hc, sx * 0.1, 0.15, 0.1, 2.2, sx * 0.4, 0.05, 0.08);
      // 火焰狀：一束束幾乎垂直往上
      const S = [
        [0.0, 0.24, -0.02, -0.08, 0, 0.13, 0.55], [0.08, 0.22, -0.03, -0.12, -0.18, 0.12, 0.52], [-0.08, 0.22, -0.03, -0.12, 0.18, 0.12, 0.52],
        [0.14, 0.17, -0.04, -0.15, -0.38, 0.1, 0.44], [-0.14, 0.17, -0.04, -0.15, 0.38, 0.1, 0.44],
        [0.04, 0.2, -0.1, -0.3, -0.08, 0.12, 0.5], [-0.05, 0.2, -0.1, -0.3, 0.1, 0.12, 0.5],
        [0.18, 0.08, -0.06, -0.2, -0.6, 0.08, 0.32], [-0.18, 0.08, -0.06, -0.2, 0.6, 0.08, 0.32],
        [0.0, 0.14, -0.16, -0.55, 0, 0.11, 0.4],
      ];
      S.forEach(([x, y, z, rx, rz, w, h], i) => spike(p, i % 3 === 2 ? hl : hc, x, y, z, rx, rz, w, h * (ssj ? 1.08 : 1)));
      heads[form] = { main: p.build(), face: p.face.build() };
    }
  } else if (id === 'trunks') {
    for (const form of ['base', 'ssj']) {
      const p = new Parts(); p.face = new Parts();
      skull(p, d.skin); ears(p, d.skin);
      const ssj = form === 'ssj';
      face(p, { brow: ssj ? 0xc9a02a : 0x8a74c0, browTilt: ssj ? 0.48 : 0.3, iris: ssj ? 0x1f9a88 : 0x3a5ab0, sharp: ssj ? 1.3 : 1 });
      if (!ssj) {
        // 淡紫中分短髮：兩片髮罩＋垂到下顎的鬢髮
        for (const sx of [-1, 1]) {
          const half = new THREE.SphereGeometry(1, 10, 8, sx > 0 ? 0 : Math.PI, Math.PI, 0, 1.75);
          p.add(half, C.lav, [sx * 0.008, cy + 0.015, -0.01], [-0.18, 0, 0], [hr * 1.1, hr * 1.1, hr * 1.12]);
          p.add(geo('box'), C.lav, [sx * hr * 0.92, cy - hr * 0.25, hr * 0.12], [0.05, 0, sx * 0.06], [0.06, hr * 1.1, hr * 0.85]);
          // 瀏海分兩邊斜垂
          spike(p, C.lavD, sx * 0.06, 0.13, 0.15, 2.45, -sx * 0.55, 0.06, 0.15);
          spike(p, C.lav, sx * 0.13, 0.08, 0.14, 2.6, -sx * 0.3, 0.05, 0.16);
        }
        p.add(geo('box'), C.lav, [0, cy - hr * 0.1, -hr * 0.75], [-0.2, 0, 0], [hr * 1.5, hr * 1.1, 0.08]);
      } else {
        const cap = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, 1.3);
        p.add(cap, C.gold, [0, cy + 0.02, -0.02], [-0.5, 0, 0], [hr * 1.08, hr * 1.08, hr * 1.1]);
        const S = [
          [0.0, 0.2, 0.05, -0.15, 0, 0.11, 0.38], [0.09, 0.19, 0.0, -0.3, -0.45, 0.11, 0.36], [-0.09, 0.19, 0.0, -0.3, 0.45, 0.11, 0.36],
          [0.15, 0.1, -0.06, -0.4, -0.95, 0.09, 0.32], [-0.15, 0.1, -0.06, -0.4, 0.95, 0.09, 0.32],
          [0.06, 0.14, -0.14, -0.9, -0.3, 0.1, 0.34], [-0.06, 0.14, -0.14, -0.9, 0.3, 0.1, 0.34], [0.0, 0.05, -0.18, -1.4, 0, 0.1, 0.3],
        ];
        S.forEach(([x, y, z, rx, rz, w, h], i) => spike(p, i % 3 === 1 ? C.goldL : C.gold, x, y, z, rx, rz, w, h));
        for (const sx of [-1, 1]) spike(p, C.gold, sx * 0.07, 0.15, 0.14, 2.6, -sx * 0.35, 0.045, 0.14);
      }
      heads[form] = { main: p.build(), face: p.face.build() };
    }
  } else if (id === 'piccolo') {
    const p = new Parts(); p.face = new Parts();
    // 略長的光頭
    p.add(geo('hsphere'), d.skin, [0, cy + 0.01, -0.01], 0, [hr * 0.96, hr * 1.06, hr * 1.0]);
    p.add(geo('sphere'), d.skin, [0, cy - hr * 0.45, hr * 0.28], 0, [hr * 0.6, hr * 0.52, hr * 0.62]);
    face(p, { brow: C.gD, browTilt: 0.5, sharp: 1.5, browW: 0.09 });
    // 眉骨稜線與兩頰紋
    p.add(geo('box'), C.gD, [0, cy + hr * 0.16, hr * 0.88], [0.25, 0, 0], [hr * 1.3, 0.03, 0.05]);
    // 尖長耳
    for (const sx of [-1, 1]) p.add(geo('cone6'), d.skin, [sx * hr * 0.9, cy + 0.01, -0.02], [-0.55, 0, -sx * 0.75], [0.042, 0.16, 0.022]);
    // 觸角
    for (const sx of [-1, 1]) {
      p.add(cyl(0.014, 0.02, 0.3, 6), d.skin, [sx * 0.055, cy + hr * 0.95 + 0.09, hr * 0.38 + 0.07], [0.6, 0, -sx * 0.2]);
      p.add(geo('lsphere'), C.gD, [sx * 0.085, cy + hr * 0.95 + 0.21, hr * 0.38 + 0.18], 0, 0.026);
    }
    // 頭頂的紋路
    p.add(geo('box'), C.gD, [0, cy + hr * 0.9, -0.02], [0.2, 0, 0], [0.02, 0.015, hr * 1.1]);
    heads.base = { main: p.build(), face: p.face.build() };
  } else if (id === 'frieza') {
    const p = new Parts(); p.face = new Parts();
    p.add(geo('hsphere'), d.skin, [0, cy, 0], 0, [hr * 0.95, hr, hr * 0.95]);
    p.add(geo('sphere'), d.skin, [0, cy - hr * 0.45, hr * 0.25], 0, [hr * 0.55, hr * 0.48, hr * 0.6]);
    face(p, { brow: null, iris: 0xd0203a, pupil: 0x1a0a0a, sharp: 1.8, eyeY: 0.88, lid: 0x3a1030 });
    // 紫色頭頂圓頂（光滑，帶一點反光）
    const dome = new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, 1.25);
    p.add(dome, C.dome, [0, cy + 0.035, -0.045], [-0.42, 0, 0], [hr * 1.08, hr * 1.25, hr * 1.3]);
    p.add(geo('lsphere'), C.domeL, [0.05, cy + hr * 0.95, hr * 0.15], 0, [0.04, 0.02, 0.06]);
    // 黑唇、臉頰的黑線
    p.add(geo('box'), 0x2a1a22, [0, cy - hr * 0.48, hr * 0.84], 0, [0.05, 0.012, 0.01]);
    heads.base = { main: p.build(), face: p.face.build() };
  } else if (id === 'a18') {
    const p = new Parts(); p.face = new Parts();
    skull(p, d.skin);
    face(p, { brow: 0xc9a24a, browTilt: 0.15, iris: 0x5fa8d8, pupil: 0x1a2a3a, sharp: 0.7, browW: 0.065 });
    // 嘴唇淡粉
    p.add(geo('box'), 0xd98a8a, [0, cy - hr * 0.45, hr * 0.86], 0, [0.035, 0.008, 0.01]);
    // 金色及下顎的鮑伯頭（側分）
    const cap = new THREE.SphereGeometry(1, 14, 9, 0, Math.PI * 2, 0, 1.55);
    p.add(cap, C.blonde, [0, cy + 0.01, -0.015], [-0.25, 0, 0], [hr * 1.1, hr * 1.1, hr * 1.12]);
    for (const sx of [-1, 1]) {
      p.add(geo('box'), C.blonde, [sx * hr * 0.92, cy - hr * 0.38, hr * 0.05], [0, 0, sx * 0.05], [0.06, hr * 1.25, hr * 1.2]);
      p.add(geo('box'), C.blondeD, [sx * hr * 0.9, cy - hr * 0.98, hr * 0.12], [0.15, 0, 0], [0.05, 0.03, hr * 0.9]);
    }
    p.add(geo('box'), C.blonde, [0, cy - hr * 0.35, -hr * 0.78], [-0.1, 0, 0], [hr * 1.7, hr * 1.25, 0.08]);
    // 側分瀏海：大片斜掃
    p.add(geo('box'), C.blonde, [-0.03, cy + hr * 0.55, hr * 0.8], [0.55, 0, -0.45], [0.26, 0.07, 0.07]);
    spike(p, C.blondeD, 0.1, 0.08, 0.16, 2.7, -0.2, 0.05, 0.16);
    heads.base = { main: p.build(), face: p.face.build() };
  }
  out.heads = heads;

  /* ---------------- 腰臀 ---------------- */
  {
    const p = new Parts();
    const pantsC = { goku: C.gi, vegeta: C.suit, trunks: C.grey, piccolo: C.pgi, frieza: d.skin, a18: C.denim }[id];
    p.add(geo('sphere'), pantsC, [0, -0.02, 0], 0, [d.hip * 1.75, d.hip * 1.1, d.hip * 1.35]);
    const belt = (c, h = 0.09) => p.add(cyl(d.waist * 1.1, d.waist * 1.14, h, 14), c, [0, 0.07, 0], 0, [1, 1, cz / cx * 1.05 + 0.05]);
    if (id === 'goku') {
      belt(C.blue, 0.1);
      p.add(geo('sphere'), C.blue, [0.11, 0.06, cz * 0.98], 0, [0.05, 0.045, 0.04]);
      for (const sx of [0.06, 0.15]) p.add(geo('box'), C.blue, [sx, -0.06, cz * 0.95], [0.1, 0, 0.15], [0.05, 0.18, 0.02]); // 結的兩端
    } else if (id === 'vegeta') {
      // 腰下的黃甲片
      p.add(cyl(d.waist * 1.15, d.waist * 1.2, 0.06, 14), C.armor, [0, 0.1, 0], 0, [1, 1, cz / cx * 1.05 + 0.05]);
      for (const sx of [-1, 1]) p.add(geo('box'), C.ochre, [sx * d.hip * 0.95, -0.06, 0.02], [0, 0, sx * 0.15], [0.12, 0.2, 0.22]);
    } else if (id === 'trunks') {
      belt(0x1a1a1a, 0.06);
      p.add(geo('box'), 0x8a8a90, [0, 0.07, cz * 1.02], 0, [0.05, 0.04, 0.02]);
    } else if (id === 'piccolo') {
      belt(C.sash, 0.12);
      p.add(geo('box'), C.sash, [0.09, -0.08, cz * 0.98], [0.1, 0, 0.1], [0.07, 0.2, 0.02]);
    } else if (id === 'frieza') {
      // 光滑白身，腿根略細
      p.add(geo('sphere'), 0xe6e1dc, [0, -0.06, 0], 0, [d.hip * 1.4, d.hip * 0.8, d.hip * 1.2]);
    } else if (id === 'a18') {
      // 牛仔短裙
      p.add(cyl(d.waist * 1.15, d.hip * 1.75, 0.3, 14), C.denim, [0, -0.08, 0], 0, [1, 1, 0.85]);
      p.add(cyl(d.hip * 1.76, d.hip * 1.76, 0.025, 14, true), C.denimD, [0, -0.225, 0], 0, [1, 1, 0.85]);
      belt(0x5a3a22, 0.04);
    }
    out.hips = p.build();
  }

  /* ---------------- 軀幹 ---------------- */
  {
    const p = new Parts();
    const topC = { goku: C.gi, vegeta: C.suit, trunks: C.jacket, piccolo: C.pgi, frieza: d.skin, a18: C.stripeW }[id];
    p.add(geo('sphere'), topC, [0, T * 0.28, 0], 0, [d.waist * 1.05, T * 0.3, cz * 0.95]);
    p.add(geo('sphere'), topC, [0, T * 0.66, 0], 0, [cx, cyc * T / 0.62 * 0.62, cz * 0.92]);
    p.add(geo('box'), topC, [0, T * 0.7, -0.005], 0, [cx * 1.55, cyc * 0.75, cz * 1.45]);
    p.add(limb(hr * 0.33, hr * 0.38, 0.12, 8), id === 'vegeta' ? C.suit : d.skin, [0, T + 0.06, 0]);
    if (id === 'goku') {
      // 交領：藍色內衫從 V 領露出
      p.add(new THREE.ConeGeometry(1, 1, 3), C.blue, [0, T * 0.82, cz * 0.93], [Math.PI, 0, 0], [0.09, 0.22, 0.014]);
      p.add(geo('box'), C.giD, [0.035, T * 0.66, cz * 0.97], [0, 0, 0.45], [0.02, 0.26, 0.012]);
      p.add(geo('box'), C.giD, [-0.035, T * 0.66, cz * 0.97], [0, 0, -0.45], [0.02, 0.26, 0.012]);
      for (const sx of [-1, 1]) p.add(geo('sphere'), C.gi, [sx * d.sw * 0.85, T * 0.86, 0], 0, [0.11, 0.09, 0.13]);
      // 背後的圓形徽記底
      p.add(geo('disc'), 0xf4efe2, [0, T * 0.7, -cz * 1.0], [Math.PI / 2, 0, 0], [0.09, 0.01, 0.09]);
      p.add(geo('box'), C.black, [0, T * 0.7, -cz * 1.02], 0, [0.05, 0.06, 0.01]);
    } else if (id === 'vegeta') {
      // 白色胸甲＋黃色肩片
      p.add(geo('sphere'), C.armor, [0, T * 0.66, 0.005], 0, [cx * 1.08, cyc * 1.02, cz * 1.04]);
      p.add(geo('box'), C.armor, [0, T * 0.72, 0], 0, [cx * 1.65, cyc * 0.72, cz * 1.5]);
      for (const sx of [-1, 1]) {
        p.add(geo('box'), C.ochre, [sx * d.sw * 0.95, T * 0.95, 0], [0, 0, -sx * 0.35], [0.18, 0.05, 0.2]);
        p.add(geo('box'), C.ochre, [sx * d.sw * 1.1, T * 0.88, 0], [0, 0, -sx * 0.9], [0.13, 0.04, 0.19]);
      }
      p.add(geo('box'), C.ochre, [0, T * 0.32, cz * 0.9], [-0.1, 0, 0], [0.2, 0.1, 0.03]);
      p.add(geo('box'), 0xd8d4c8, [0, T * 0.5, cz * 1.02], 0, [0.2, 0.012, 0.01]);
    } else if (id === 'trunks') {
      // 黑背心從敞開的短夾克露出、立領
      p.add(geo('box'), C.tank, [0, T * 0.6, cz * 0.93], 0, [cx * 0.5, T * 0.5, 0.02]);
      p.add(cyl(hr * 0.6, hr * 0.48, 0.13, 12, true, Math.PI * 0.75, Math.PI * 1.5), C.jacket, [0, T + 0.05, 0]);
      for (const sx of [-1, 1]) {
        p.add(geo('box'), 0x2c3350, [sx * cx * 0.32, T * 0.62, cz * 0.96], [0, 0, sx * 0.05], [0.025, T * 0.55, 0.012]);
        p.add(geo('sphere'), C.jacket, [sx * d.sw * 0.85, T * 0.86, 0], 0, [0.1, 0.085, 0.12]);
      }
      // 夾克下擺
      p.add(cyl(d.waist * 1.2, d.waist * 1.3, 0.1, 14, true), C.jacket, [0, T * 0.12, 0], 0, [1, 1, cz / cx * 1.1]);
      // 背後的劍鞘帶
      p.add(geo('box'), 0x3a2a1e, [0, T * 0.62, cz * 0.98], [0, 0, 0.75], [0.03, T * 0.7, 0.012]);
      p.add(geo('box'), 0x3a2a1e, [0, T * 0.62, -cz * 0.98], [0, 0, -0.75], [0.03, T * 0.7, 0.012]);
    } else if (id === 'piccolo') {
      // 無袖紫道服：V 領露出綠胸
      p.add(new THREE.ConeGeometry(1, 1, 3), d.skin, [0, T * 0.8, cz * 0.93], [Math.PI, 0, 0], [0.09, 0.24, 0.014]);
      for (const sx of [-1, 1]) p.add(geo('sphere'), d.skin, [sx * d.sw * 0.88, T * 0.86, 0], 0, [0.11, 0.1, 0.12]);
      p.add(geo('box'), C.gD, [0, T * 0.74, cz * 0.97], 0, [0.012, 0.12, 0.01]);
    } else if (id === 'frieza') {
      // 胸前紫色圓甲＋鎖骨線
      p.add(geo('sphere'), C.dome, [0, T * 0.72, cz * 0.32], 0, [cx * 0.85, cyc * 0.5, cz * 0.8]);
      p.add(geo('lsphere'), C.domeL, [0.04, T * 0.8, cz * 1.05], 0, [0.04, 0.02, 0.02]);
      for (const sx of [-1, 1]) p.add(geo('sphere'), C.dome, [sx * d.sw * 0.95, T * 0.9, 0], 0, [0.1, 0.085, 0.1]);
      p.add(geo('box'), 0xc8c2bc, [0, T * 0.32, cz * 0.94], 0, [0.012, T * 0.25, 0.01]);
    } else if (id === 'a18') {
      // 橫條紋上衣（黑白環）＋牛仔背心
      for (let i = 0; i < 5; i++) p.add(cyl(cx * 0.98, cx * 1.0, 0.035, 14, true), 0x1a1a1e, [0, T * (0.2 + i * 0.16), 0], 0, [1, 1, cz / cx * 1.02]);
      const vest = new THREE.SphereGeometry(1, 12, 8, Math.PI / 2 + 0.45, Math.PI * 2 - 0.9, 0.3, 2.1);
      p.add(vest, C.denim, [0, T * 0.6, 0], 0, [cx * 1.08, cyc * 1.25, cz * 1.12]);
      for (const sx of [-1, 1]) p.add(geo('box'), C.denimD, [sx * cx * 0.42, T * 0.68, cz * 0.98], [0, 0, sx * 0.1], [0.02, T * 0.5, 0.012]);
      p.add(cyl(hr * 0.42, hr * 0.42, 0.04, 12, true), 0x1a1a1e, [0, T + 0.01, 0]);
    }
    out.torso = p.build();
  }

  /* ---------------- 手臂 ---------------- */
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    {
      const p = new Parts();
      const upC = { goku: d.skin, vegeta: C.suit, trunks: C.jacket, piccolo: d.skin, frieza: d.skin, a18: C.stripeW }[id];
      p.add(geo('sphere'), upC, [0, -0.01, 0], 0, d.arm * 1.35);
      p.add(limb(d.arm * 1.1, d.arm * 0.92, d.upper, 8), upC, [0, 0, 0]);
      if (id !== 'a18' && id !== 'frieza') p.add(geo('sphere'), upC, [0, -d.upper * 0.42, d.arm * 0.25], 0, [d.arm * 1.08, d.upper * 0.3, d.arm * 1.1]);
      if (id === 'goku') p.add(cyl(d.arm * 1.25, d.arm * 1.15, d.upper * 0.35, 10), C.blue, [0, -d.upper * 0.12, 0]); // 藍內衫短袖
      if (id === 'trunks') p.add(cyl(d.arm * 1.3, d.arm * 1.2, 0.04, 10, true), 0x2c3350, [0, -d.upper * 0.95, 0]);
      if (id === 'piccolo') p.add(geo('sphere'), C.pink, [sx * d.arm * 0.2, -d.upper * 0.42, d.arm * 0.5], 0, [d.arm * 0.7, d.upper * 0.22, d.arm * 0.65]);
      if (id === 'a18') for (let i = 0; i < 3; i++) p.add(cyl(d.arm * 1.12, d.arm * 1.08, 0.03, 10), 0x1a1a1e, [0, -d.upper * (0.25 + i * 0.25), 0]);
      // 隊伍色臂環（只在左臂）
      if (side === 'L') p.add(cyl(d.arm * 1.2, d.arm * 1.18, 0.045, 12), tc, [0, -d.upper * 0.62, 0]);
      out['upper' + side] = p.build();
    }
    {
      const p = new Parts();
      const L = d.lower;
      if (id === 'goku') {
        p.add(limb(d.fore * 1.02, d.fore * 0.88, L, 8), d.skin, [0, 0, 0]);
        p.add(cyl(d.fore * 1.12, d.fore * 1.05, L * 0.32, 10), C.blue, [0, -L * 0.82, 0]); // 藍護腕
        p.add(geo('sphere'), d.skin, [0, -L - d.fist * 0.6, 0.01], 0, [d.fist, d.fist * 1.05, d.fist * 1.05]);
      } else if (id === 'vegeta') {
        p.add(limb(d.fore * 1.0, d.fore * 0.9, L * 0.55, 8), C.suit, [0, 0, 0]);
        p.add(limb(d.fore * 1.2, d.fore * 1.05, L * 0.5, 8), C.armor, [0, -L * 0.5, 0]); // 白手套
        p.add(geo('sphere'), C.armor, [0, -L - d.fist * 0.6, 0.01], 0, [d.fist * 1.05, d.fist * 1.08, d.fist * 1.08]);
      } else if (id === 'trunks') {
        p.add(limb(d.fore * 1.0, d.fore * 0.86, L, 8), d.skin, [0, 0, 0]);
        p.add(cyl(d.fore * 1.0, d.fore * 0.95, 0.05, 10), 0x1a1a1a, [0, -L * 0.88, 0]);
        p.add(geo('sphere'), d.skin, [0, -L - d.fist * 0.6, 0.01], 0, [d.fist, d.fist * 1.05, d.fist * 1.05]);
      } else if (id === 'piccolo') {
        p.add(limb(d.fore * 1.02, d.fore * 0.88, L, 8), d.skin, [0, 0, 0]);
        p.add(geo('sphere'), C.pink, [sx * d.fore * 0.25, -L * 0.42, d.fore * 0.45], 0, [d.fore * 0.7, L * 0.25, d.fore * 0.65]);
        p.add(cyl(d.fore * 1.1, d.fore * 1.0, L * 0.18, 10), 0x8a2a2a, [0, -L * 0.9, 0]);
        p.add(geo('sphere'), d.skin, [0, -L - d.fist * 0.6, 0.01], 0, [d.fist, d.fist * 1.05, d.fist * 1.05]);
      } else if (id === 'frieza') {
        p.add(limb(d.fore * 1.0, d.fore * 0.85, L, 8), d.skin, [0, 0, 0]);
        p.add(geo('sphere'), C.dome, [sx * d.fore * 0.3, -L * 0.45, -d.fore * 0.2], 0, [d.fore * 1.0, L * 0.4, d.fore * 1.05]);
        p.add(geo('sphere'), d.skin, [0, -L - d.fist * 0.55, 0.01], 0, [d.fist * 0.95, d.fist * 1.1, d.fist]);
      } else {
        p.add(limb(d.fore * 1.0, d.fore * 0.86, L, 8), C.stripeW, [0, 0, 0]);
        for (let i = 0; i < 3; i++) p.add(cyl(d.fore * 1.04, d.fore * 1.0, 0.028, 10), 0x1a1a1e, [0, -L * (0.2 + i * 0.27), 0]);
        p.add(geo('sphere'), d.skin, [0, -L - d.fist * 0.55, 0.01], 0, [d.fist, d.fist * 1.05, d.fist]);
      }
      out['fore' + side] = p.build();
    }
  }

  /* ---------------- 腿 ---------------- */
  for (const side of ['L', 'R']) {
    const pantsC = { goku: C.gi, vegeta: C.suit, trunks: C.grey, piccolo: C.pgi, frieza: d.skin, a18: C.legging }[id];
    const loose = id === 'goku' || id === 'piccolo' ? 1.28 : 1.0;
    {
      const p = new Parts();
      p.add(geo('sphere'), pantsC, [0, -0.02, 0], 0, d.thigh * loose * 1.05);
      p.add(limb(d.thigh * loose, d.shin * loose * 1.12, d.thighLen, 8), pantsC, [0, 0, 0]);
      out['thigh' + side] = p.build();
    }
    {
      const p = new Parts();
      const S = d.shinLen;
      p.add(geo('sphere'), pantsC, [0, 0, 0], 0, d.shin * loose * 1.1);
      const boot = (c, toe, h = 0.42, trim = null) => {
        p.add(limb(d.shin * 1.18, d.shin * 1.08, S * h, 8), c, [0, -S * (1 - h), 0]);
        p.add(geo('sphere'), c, [0, -S - 0.005, 0.05], 0, [d.shin * 1.15, 0.06, d.shin * 2.1]);
        if (toe != null) p.add(geo('sphere'), toe, [0, -S - 0.005, 0.1], 0, [d.shin * 1.0, 0.055, d.shin * 1.2]);
        if (trim != null) p.add(cyl(d.shin * 1.22, d.shin * 1.22, 0.035, 10), trim, [0, -S * (1 - h) + 0.01, 0]);
      };
      if (id === 'goku') {
        p.add(limb(d.shin * 1.3, d.shin * 1.15, S * 0.62, 8), C.gi, [0, 0, 0]);
        boot(C.blueD, null, 0.42, C.red);
        p.add(geo('box'), C.yellow, [0, -S * 0.78, d.shin * 1.1], 0, [0.025, S * 0.25, 0.01]);
      } else if (id === 'vegeta') {
        p.add(limb(d.shin * 1.0, d.shin * 0.9, S * 0.6, 8), C.suit, [0, 0, 0]);
        boot(C.armor, C.ochre, 0.5);
      } else if (id === 'trunks') {
        p.add(limb(d.shin * 1.05, d.shin * 0.95, S * 0.65, 8), C.grey, [0, 0, 0]);
        boot(0xd8a62a, 0x3a2a1a, 0.42);
      } else if (id === 'piccolo') {
        p.add(limb(d.shin * 1.3, d.shin * 1.1, S * 0.75, 8), C.pgi, [0, 0, 0]);
        boot(C.brown, null, 0.28);
      } else if (id === 'frieza') {
        p.add(limb(d.shin * 1.0, d.shin * 0.8, S, 8), d.skin, [0, 0, 0]);
        p.add(geo('sphere'), C.dome, [0, -S * 0.45, d.shin * 0.45], 0, [d.shin * 0.9, S * 0.33, d.shin * 0.7]);
        // 三趾腳
        for (const tx of [-0.035, 0, 0.035]) p.add(geo('sphere'), d.skin, [tx, -S - 0.01, 0.07], 0, [0.022, 0.03, 0.06]);
        p.add(geo('sphere'), d.skin, [0, -S, 0.0], 0, [d.shin * 0.95, 0.045, d.shin * 1.1]);
      } else {
        p.add(limb(d.shin * 1.0, d.shin * 0.85, S * 0.5, 8), C.legging, [0, 0, 0]);
        boot(C.boot, null, 0.55, 0x5a361e);
      }
      out['shin' + side] = p.build();
    }
  }

  /* ---------------- 次級擺動 ---------------- */
  const tailSeg = (w, len, c, thick = 0.022) => { const p = new Parts(); p.add(geo('box'), c, [0, -len / 2, 0], 0, [w, len, thick]); return p.build(); };
  if (id === 'goku') out.sash = [tailSeg(0.06, 0.18, C.blue), tailSeg(0.055, 0.16, C.blue)];
  if (id === 'piccolo') out.sash = [tailSeg(0.08, 0.2, C.sash), tailSeg(0.07, 0.18, C.sash)];
  if (id === 'frieza') {
    out.tail = [0, 1, 2, 3, 4].map((i) => {
      const p = new Parts(); const len = 0.2, r0 = 0.07 - i * 0.011, r1 = 0.07 - (i + 1) * 0.011;
      p.add(limb(r0, Math.max(0.015, r1), len, 8), i === 4 ? C.dome : d.skin, [0, 0, 0]);
      p.add(geo('lsphere'), i === 4 ? C.dome : d.skin, [0, 0, 0], 0, r0 * 1.02);
      if (i === 4) p.add(geo('cone6'), C.dome, [0, -len, 0], [Math.PI, 0, 0], [0.02, 0.07, 0.02]);
      return p.build();
    });
  }
  if (id === 'trunks') {
    // 劍：握把在原點，刃沿 +y
    const p = new Parts();
    p.add(cyl(0.018, 0.02, 0.2, 6), C.hilt, [0, 0.0, 0]);
    p.add(geo('lsphere'), 0x8a6a2a, [0, -0.11, 0], 0, 0.028);
    p.add(geo('box'), 0x8a6a2a, [0, 0.11, 0], 0, [0.14, 0.03, 0.05]);
    p.add(geo('box'), C.steel, [0, 0.58, 0], 0, [0.045, 0.9, 0.012]);
    p.add(new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0), C.steel, [0, 1.03, 0], [0, Math.PI / 4, 0], [0.032, 0.08, 0.008]);
    p.add(geo('box'), 0xffffff, [0.012, 0.58, 0.007], 0, [0.008, 0.86, 0.002]);
    out.sword = p.build();
    const q = new Parts();
    q.add(geo('box'), C.sheath, [0, 0.6, 0], 0, [0.075, 0.95, 0.04]);
    q.add(geo('box'), 0x8a6a2a, [0, 0.16, 0], 0, [0.085, 0.05, 0.05]);
    q.add(geo('box'), 0x8a6a2a, [0, 1.05, 0], 0, [0.085, 0.06, 0.05]);
    out.sheath = q.build();
  }
  return out;
}

/* ---------------- 姿勢 ---------------- */
const KEYS = ['hipsY', 'hipsZ', 'hipsRX', 'hipsRY', 'hipsRZ', 'torsoX', 'torsoY', 'torsoZ', 'headX', 'headY', 'headZ',
  'shLX', 'shLY', 'shLZ', 'elL', 'shRX', 'shRY', 'shRZ', 'elR', 'thLX', 'thLZ', 'knL', 'thRX', 'thRZ', 'knR', 'spin', 'stretch'];
function blank() { const p = {}; for (const k of KEYS) p[k] = 0; p.shLZ = 0.12; p.shRZ = 0.12; p.elL = -0.15; p.elR = -0.15; return p; }
function lerpPose(a, b, k, out = {}) { for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k; return out; }
const ease = (k) => k * k * (3 - 2 * k);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function stance(style, t) {
  const p = blank();
  const br = Math.sin(t * 2.6);
  if (style === 'tank') { // 比克：低而寬，一手前伸
    Object.assign(p, { hipsY: -0.07 - 0.012 * br, torsoX: 0.14 + 0.02 * br, torsoY: 0.35, headX: -0.12, headY: -0.3,
      shLX: -1.15, shLZ: 0.3, elL: -0.9, shRX: -0.35, shRZ: 0.35, elR: -1.6,
      thLX: -0.3, thLZ: 0.25, knL: 0.45, thRX: 0.25, thRZ: 0.25, knR: 0.45 });
  } else if (style === 'proud') { // 貝吉塔：挺胸抬下巴，拳低垂，偶爾抱胸
    const fold = Math.sin(t * 0.35) > 0.55;
    Object.assign(p, { hipsY: -0.02 - 0.01 * br, torsoX: -0.06 + 0.01 * br, torsoY: 0.2, headX: -0.16, headY: -0.2,
      thLX: -0.1, thLZ: 0.12, knL: 0.12, thRX: 0.12, thRZ: 0.12, knR: 0.15 });
    if (fold) Object.assign(p, { shLX: -1.15, shLZ: -0.35, elL: -1.95, shRX: -1.05, shRZ: -0.4, elR: -2.05 });
    else Object.assign(p, { shLX: -0.15, shLZ: 0.32, elL: -0.55, shRX: -0.2, shRZ: 0.3, elR: -0.6 });
  } else if (style === 'sword') { // 特南克斯：右手靠近劍柄
    Object.assign(p, { hipsY: -0.05 - 0.012 * br, torsoX: 0.08 + 0.015 * br, torsoY: 0.4, headY: -0.35,
      shLX: -0.8, shLZ: 0.3, elL: -1.5, shRX: -0.3, shRZ: 0.55, elR: -1.0,
      thLX: -0.28, thLZ: 0.12, knL: 0.35, thRX: 0.3, thRZ: 0.12, knR: 0.35 });
  } else if (style === 'regal') { // 弗利沙：直立、雙手微收、從容
    Object.assign(p, { hipsY: -0.01 - 0.008 * br, torsoX: -0.04 + 0.01 * br, torsoY: 0.1, headX: -0.08, headY: -0.12,
      shLX: -0.35, shLZ: 0.25, elL: -1.2, shRX: -0.3, shRZ: 0.22, elR: -1.0,
      thLX: -0.05, thLZ: 0.05, knL: 0.08, thRX: 0.06, thRZ: 0.05, knR: 0.1 });
  } else if (style === 'cool') { // 18 號：重心在一腳、手輕垂
    Object.assign(p, { hipsY: -0.02 - 0.008 * br, hipsRZ: 0.05, torsoX: 0.0 + 0.01 * br, torsoY: 0.15, torsoZ: -0.05, headY: -0.15, headZ: 0.06,
      shLX: -0.1, shLZ: 0.18, elL: -0.35, shRX: -0.25, shRZ: 0.25, elR: -1.2,
      thLX: -0.08, thLZ: 0.04, knL: 0.06, thRX: 0.12, thRZ: 0.1, knR: 0.25 });
  } else { // 悟空：經典格鬥架式
    Object.assign(p, { hipsY: -0.05 - 0.015 * br, torsoX: 0.1 + 0.02 * br, torsoY: 0.38, headY: -0.32,
      shLX: -1.0, shLZ: 0.25, elL: -1.8, shRX: -0.6, shRZ: 0.3, elR: -2.05,
      thLX: -0.25, thLZ: 0.12, knL: 0.35, thRX: 0.3, thRZ: 0.12, knR: 0.38 });
  }
  return p;
}

function strike(t, ti, base, W, S, rec = 0.36) {
  const a = ti * 0.55;
  if (t < a) return lerpPose(base, W, ease(t / a));
  if (t < ti) return lerpPose(W, S, (t - a) / (ti - a));
  if (t < ti + 0.07) return S;
  return lerpPose(S, base, ease(clamp((t - ti - 0.07) / Math.max(0.05, rec - ti - 0.07), 0, 1)));
}
export const IMPACT = { atk1: 0.1, atk2: 0.12, atk3: 0.16, slash: 0.12, cast: 0.16, beam: 0.4, grab: 0.18, overhead: 0.3 };

function heroPose(d, name, t, k, phase, out) {
  const base = stance(d.style, t);
  const P = (o) => Object.assign({ ...base }, o);
  let p = base;
  const sword = d.style === 'sword';
  if (name === 'slash' && !sword) name = 'atk2';
  switch (name) {
    case 'run': {
      const s = Math.sin(phase), c = Math.cos(phase);
      const glide = d.style === 'regal';
      p = P({ hipsY: -0.05 + 0.06 * Math.abs(c) * (glide ? 0.3 : 1), torsoX: glide ? 0.35 : d.style === 'tank' ? 0.32 : 0.3, torsoY: 0.14 * s, headX: -0.15, headY: 0,
        thLX: s * (glide ? 0.35 : 0.95), thRX: -s * (glide ? 0.35 : 0.95), thLZ: 0.04, thRZ: 0.04,
        knL: 0.35 + (glide ? 0.4 : 1.1) * Math.max(0, -c), knR: 0.35 + (glide ? 0.4 : 1.1) * Math.max(0, c),
        shLX: glide ? 0.5 : -s * 0.85, shRX: glide ? 0.5 : s * 0.85, shLZ: 0.18, shRZ: 0.18,
        elL: glide ? -0.4 : -1.35, elR: glide ? -0.4 : -1.35 });
      if (sword) Object.assign(p, { shRX: 0.9, shRZ: 0.35, elR: -0.3 });
      break;
    }
    case 'atk1': {
      if (sword) { // 斜劈
        const W = P({ torsoY: 0.5, shRX: -2.7, shRZ: 0.55, elR: -0.7, headY: -0.3 });
        const S = P({ torsoY: -0.45, torsoX: 0.25, shRX: -0.65, shRZ: -0.35, elR: -0.2, hipsZ: 0.08, thRX: 0.4, thLX: -0.5, knL: 0.5, headY: 0.2 });
        p = strike(t, IMPACT.atk1, base, W, S, 0.3); break;
      }
      const W = P({ torsoY: 0.1, shRX: -0.5, shRZ: 0.25, elR: -2.2, hipsZ: -0.02 });
      const S = P({ torsoY: 0.95, torsoX: 0.15, shRX: -1.55, shRZ: 0.05, shRY: 0, elR: -0.05, hipsZ: 0.08, thRX: 0.45, knR: 0.2, headY: -0.6 });
      p = strike(t, IMPACT.atk1, base, W, S, 0.3);
      break;
    }
    case 'slash':
    case 'atk2': {
      if (sword) { // 橫斬
        const W = P({ torsoY: 1.0, shRX: -1.45, shRZ: 1.35, elR: -0.35 });
        const S = P({ torsoY: -0.95, torsoX: 0.15, shRX: -1.5, shRZ: -0.35, elR: -0.1, hipsZ: 0.1, thLX: -0.55, knL: 0.45, headY: 0.4 });
        p = strike(t, IMPACT.atk2, base, W, S, 0.34); break;
      }
      const W = P({ torsoY: 0.75, shLX: -0.6, shLZ: 1.15, elL: -1.4 });
      const S = P({ torsoY: -0.75, torsoX: 0.18, shLX: -1.45, shLZ: 0.35, elL: -0.75, hipsZ: 0.1, thLX: -0.55, knL: 0.45, headY: 0.4 });
      p = strike(t, IMPACT.atk2, base, W, S, 0.34);
      break;
    }
    case 'atk3': {
      if (d.atk3 === 'sword') { // 上撩
        const W = P({ torsoY: 0.4, torsoX: 0.35, shRX: 0.7, shRZ: 0.35, elR: -0.3, hipsY: -0.12, knL: 0.7, knR: 0.6 });
        const S = P({ torsoY: -0.2, torsoX: -0.35, shRX: -2.9, shRZ: 0.1, elR: -0.1, hipsY: 0.06, hipsZ: 0.06, thLX: -0.3, knL: 0.2, headX: -0.4 });
        p = strike(t, IMPACT.atk3, base, W, S, 0.42);
      } else if (d.atk3 === 'palm') {
        const W = P({ torsoY: -0.8, shRX: 0.4, shRZ: 0.6, elR: -1.6, shLX: -0.8, elL: -1.2 });
        const S = P({ torsoY: 1.1, torsoX: 0.1, shRX: -1.55, shRZ: -0.2, elR: 0, shLX: 0.5, shLZ: 0.5, elL: -0.4, hipsZ: 0.12, thLX: -0.6, knL: 0.5, thRX: 0.5 });
        p = strike(t, IMPACT.atk3, base, W, S, 0.42);
      } else {
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
    case 'grab': { // 手臂前伸；比克會把手臂拉長
      const kk = k != null ? clamp(k, 0, 1) : (t < IMPACT.grab ? ease(t / IMPACT.grab) : Math.max(0, 1 - (t - IMPACT.grab - 0.15) / 0.25));
      const S = P({ torsoY: 0.7, torsoX: 0.2, shRX: -1.55, shRZ: -0.05, elR: -0.02, shLX: 0.4, shLZ: 0.4, elL: -0.5, hipsZ: 0.1, thLX: -0.55, knL: 0.5, thRX: 0.45, headY: -0.5 });
      p = lerpPose(base, S, Math.min(1, kk * 1.6));
      p.stretch = d.style === 'tank' ? kk * 2.0 : 0;
      break;
    }
    case 'overhead': { // 單手高舉（死亡球、魔空包圍彈）
      const kk = ease(clamp(t / IMPACT.overhead, 0, 1));
      const S = P({ torsoX: -0.18, torsoY: 0.1, headX: -0.45, headY: 0, shRX: -3.05, shRZ: 0.12, elR: -0.12, shLX: 0.25, shLZ: 0.55, elL: -1.7,
        thLX: -0.1, thLZ: 0.15, knL: 0.12, thRX: 0.1, thRZ: 0.15, knR: 0.12, hipsY: -0.02 });
      p = lerpPose(base, S, kk);
      break;
    }
    case 'barrier': {
      const tr = Math.sin(t * 50) * 0.015;
      p = P({ hipsY: -0.12, torsoX: -0.18 + tr, torsoY: 0, headX: -0.25, headY: 0, shLX: -0.45, shLZ: 1.35, elL: -0.25, shRX: -0.45, shRZ: 1.35, elR: -0.25,
        thLX: -0.3, thLZ: 0.32, knL: 0.55, thRX: -0.3, thRZ: 0.32, knR: 0.55 });
      break;
    }
    case 'dash':
      p = P({ torsoX: 0.95, torsoY: 0, headX: -0.75, shLX: 1.05, shRX: 1.05, shLZ: 0.35, shRZ: 0.35, elL: -0.3, elR: -0.3,
        thLX: -0.7, knL: 1.3, thRX: 0.55, knR: 0.9, hipsY: -0.08 });
      if (sword) Object.assign(p, { shRX: 0.6, shRZ: 0.9, elR: -0.2 });
      break;
    case 'rush': {
      const per = 0.11, i = Math.floor(t / per), f = (t % per) / per;
      const ext = f < 0.45 ? ease(f / 0.45) : 1 - ease((f - 0.45) / 0.55) * 0.85;
      const left = i % 2 === 0;
      const a = left ? ext : 1 - ext;
      if (sword) { // 連斬：右手左右來回
        p = P({ torsoX: 0.25, torsoY: (left ? 0.8 : -0.8) * ext, hipsZ: 0.05, shRX: -1.5, shRZ: left ? 1.2 * (1 - ext) - 0.3 : -0.3 + 1.2 * ext, elR: -0.15,
          shLX: -0.8, shLZ: 0.3, elL: -1.4, thLX: -0.5, knL: 0.5, thRX: 0.45, knR: 0.35, hipsY: -0.07 });
        break;
      }
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
      if (d.style === 'proud') Object.assign(p, { shLX: -1.15, shLZ: -0.35, elL: -1.95, shRX: -1.05, shRZ: -0.4, elR: -2.05, headX: -0.3 });
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
  float a = tongue * body * (0.08 + 0.8 * vRim) * uLevel * 0.62;
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
const SWORD_IN_HAND = new Set(['atk1', 'atk2', 'atk3', 'slash', 'rush', 'dash']);
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
  const headForms = {};
  for (const f in gs.heads) {
    const g = new THREE.Group(); head.add(g); meshPair(gs.heads[f].main, g); meshPair(gs.heads[f].face, g, { outline: false, shadow: false }); g.visible = f === 'base'; headForms[f] = g;
  }
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
    chains.push({ segs, base, yaw: opt.yaw || 0, lift: opt.lift ?? 1, flutter: opt.flutter ?? 0.25, curl: opt.curl || 0, sway: opt.sway || 0, cur: segs.map(() => base), phase: Math.random() * 6 });
  };
  if (gs.sash) chain(gs.sash, hips, [0.12, 0.05, d.chest[2] * 0.95], -0.15, { lens: [0.18], yaw: 0.1, lift: -0.6, flutter: 0.2 });
  // 弗利沙的尾巴：從臀後垂下再往上捲
  if (gs.tail) chain(gs.tail, hips, [0, -0.04, -d.hip * 1.05], 0.75, { lens: [0.2, 0.2, 0.2, 0.2], lift: 0.22, flutter: 0.1, curl: 0.16, sway: 0.4, w: 0.018 });

  // 特南克斯的劍：背上的鞘與在手上的劍
  let sword = null, swordState = 'back', backSocket = null, handSocket = null;
  if (gs.sword) {
    backSocket = new THREE.Group();
    backSocket.position.set(-0.11, d.torso * 0.98, -d.chest[2] * 1.02);
    backSocket.rotation.set(0, 0, -2.6);
    torso.add(backSocket);
    meshPair(gs.sheath, backSocket, { w: 0.016 });
    sword = new THREE.Group();
    meshPair(gs.sword, sword, { w: 0.014 });
    backSocket.add(sword);
    handSocket = new THREE.Group();
    handSocket.rotation.set(Math.PI - 0.5, 0, 0);
    hands.R.add(handSocket);
  }

  const aura = makeAura(d.H);
  root.add(aura.group);

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
    if (hasLast && dt > 0) {
      vel.subVectors(root.position, last).divideScalar(dt);
      if (vel.lengthSq() > 900) vel.set(0, 0, 0);
      const s = Math.hypot(vel.x, vel.z);
      speed += (s - speed) * (1 - Math.exp(-10 * dt));
      const ry = root.rotation.y;
      fwd = vel.x * Math.sin(ry) + vel.z * Math.cos(ry);
    }
    last.copy(root.position); hasLast = true;
    if (name === 'run') phase += dt * clamp(speed * 1.65, 9, 15);
    heroPose(d, name, name === 'idle' ? time : t, k, phase, tgt);
    const fast = name.startsWith('atk') || name === 'slash' || name === 'cast' || name === 'rush' || name === 'vanish' || name === 'grab' || (name === 'beam' && t > 0.3);
    const rate = name !== lastName && fast ? 45 : fast ? 38 : name === 'dead' ? 9 : 13;
    lastName = name;
    const a = 1 - Math.exp(-rate * dt);
    for (const key of KEYS) cur[key] += (tgt[key] - cur[key]) * a;
    if (name === 'vanish') cur.spin = tgt.spin; else cur.spin = 0;
    apply();
    // 劍：攻擊時在手上，平常收在背上
    if (sword) {
      const want = SWORD_IN_HAND.has(name) ? 'hand' : 'back';
      if (want !== swordState) {
        swordState = want;
        (want === 'hand' ? handSocket : backSocket).add(sword);
        sword.position.set(0, want === 'hand' ? -0.02 : 0, 0);
      }
    }
    const lift = clamp(speed * 0.13, 0, 1.25) + (name === 'dash' || name === 'rush' ? 0.6 : 0) + (name === 'air' ? -0.4 : 0) + (name === 'charge' ? 0.5 : 0);
    for (const c of chains) {
      c.phase += dt * (6 + speed * 1.3);
      c.segs.forEach((s, i) => {
        const fl = Math.sin(c.phase - i * 1.1) * c.flutter * (0.25 + clamp(speed / 7, 0, 1)) * (name === 'charge' ? 2 : 1);
        const target = (i === 0 ? c.base + lift * c.lift : lift * 0.18 * c.lift + c.curl) + fl;
        c.cur[i] += (target - c.cur[i]) * (1 - Math.exp(-(9 - i * 1.5) * dt));
        s.rotation.x = c.cur[i];
        if (i === 0) s.rotation.y = c.yaw + (c.sway ? Math.sin(time * 1.7) * c.sway : 0);
        else if (c.sway) s.rotation.z = Math.sin(time * 1.7 - i * 0.7) * c.sway * 0.35;
      });
    }
    if (aura.group.visible) for (const m of aura.mats) m.uniforms.uTime.value += dt;
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
    J.shR.scale.y = 1 + Math.max(0, cur.stretch);
  }
  apply();

  let form = 'base';
  function setForm(f) {
    if (!d.saiyan) return;
    form = f === 'ssj' ? 'ssj' : 'base';
    for (const k in headForms) headForms[k].visible = k === form;
  }

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
    root, height: d.H, element: d.element, update, setAura, setForm, sword,
    handL: hands.L, handR: hands.R, chest, head,
    get form() { return form; },
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

/* ---------------- 野怪：恐龍、紅緞帶機器人、大猿 ---------------- */
const monsterGeoCache = {};
function monsterGeos(kind) {
  if (monsterGeoCache[kind]) return monsterGeoCache[kind];
  const out = {};
  if (kind === 'dino') {
    const G1 = 0x6f8a3a, G2 = 0x56702c, BELLY = 0xdcc58e;
    { // 軀幹（沿 z 拉長）
      const p = new Parts();
      p.add(geo('sphere'), G1, [0, 0, 0], 0, [0.38, 0.42, 0.62]);
      p.add(geo('lsphere'), BELLY, [0, -0.1, 0.08], 0, [0.3, 0.32, 0.5]);
      for (let i = 0; i < 5; i++) p.add(geo('cone6'), G2, [0, 0.36 - i * 0.02, 0.3 - i * 0.16], [-0.3, 0, 0], [0.06, 0.14, 0.05]); // 背刺
      for (const [x, z] of [[0.25, 0.1]]) p.add(geo('lsphere'), G2, [x * 1.3, 0.12, z], 0, [0.06, 0.05, 0.08]);
      // 小短手
      for (const sx of [-1, 1]) p.add(limb(0.035, 0.025, 0.2, 6), G1, [sx * 0.24, -0.05, 0.42], [0.9, 0, -sx * 0.2]);
      out.body = p.build();
    }
    { // 脖子＋頭（上顎）
      const p = new Parts();
      p.add(limb(0.17, 0.2, 0.36, 6), G1, [0, 0.3, 0], [-0.6, 0, 0]);
      p.add(geo('lsphere'), G1, [0, 0.35, 0.28], 0, [0.22, 0.2, 0.34]);
      p.add(geo('box'), G1, [0, 0.32, 0.5], 0, [0.3, 0.14, 0.3]);
      for (const sx of [-1, 1]) {
        p.add(geo('lsphere'), 0xf2d84a, [sx * 0.15, 0.43, 0.36], 0, [0.045, 0.05, 0.04]);
        p.add(geo('lsphere'), 0x1a1410, [sx * 0.165, 0.43, 0.385], 0, [0.018, 0.035, 0.02]);
        p.add(geo('box'), G2, [sx * 0.13, 0.5, 0.36], [0, 0, sx * 0.35], [0.1, 0.03, 0.06]);
      }
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) p.add(geo('cone6'), 0xf6f2e6, [sx * 0.12, 0.25, 0.42 + i * 0.08], [Math.PI, 0, 0], [0.02, 0.055, 0.02]);
      out.head = p.build();
    }
    { // 下顎
      const p = new Parts();
      p.add(geo('box'), BELLY, [0, -0.04, 0.2], 0, [0.26, 0.08, 0.36]);
      for (let i = 0; i < 2; i++) for (const sx of [-1, 1]) p.add(geo('cone6'), 0xf6f2e6, [sx * 0.1, 0.0, 0.18 + i * 0.1], 0, [0.018, 0.05, 0.018]);
      out.jaw = p.build();
    }
    { // 腿
      const p = new Parts();
      p.add(geo('lsphere'), G1, [0, -0.05, 0], 0, [0.16, 0.24, 0.2]);
      p.add(limb(0.1, 0.07, 0.38, 6), G1, [0, -0.15, -0.04], [0.35, 0, 0]);
      p.add(geo('lsphere'), G2, [0, -0.52, 0.04], 0, [0.1, 0.05, 0.16]);
      for (const tx of [-0.05, 0, 0.05]) p.add(geo('cone6'), 0xe8e2d0, [tx, -0.53, 0.2], [Math.PI / 2, 0, 0], [0.02, 0.05, 0.02]);
      out.leg = p.build();
    }
    out.tail = [0, 1, 2].map((i) => { const p = new Parts(); p.add(limb(0.24 - i * 0.07, 0.17 - i * 0.07, 0.42, 6), i === 2 ? G2 : G1, [0, 0, 0]); return p.build(); });
  } else if (kind === 'robot') {
    const H1 = 0x7d8668, H2 = 0x596148, RED = 0xc8302a, MET = 0x9aa0a4;
    {
      const p = new Parts();
      p.add(geo('box'), H1, [0, 0, 0], 0, [0.72, 0.62, 0.6]);
      p.add(geo('box'), H2, [0, 0.33, -0.02], 0, [0.6, 0.06, 0.5]);
      p.add(geo('box'), H2, [0, -0.33, 0], 0, [0.66, 0.06, 0.56]);
      // 紅緞帶條紋：斜帶＋蝴蝶結形的兩片
      p.add(geo('box'), RED, [0, 0.0, 0.305], [0, 0, 0.5], [0.85, 0.08, 0.012]);
      for (const sx of [-1, 1]) p.add(new THREE.ConeGeometry(1, 1, 3), RED, [sx * 0.07, 0.18, 0.31], [Math.PI / 2, 0, sx * Math.PI / 2], [0.06, 0.012, 0.06]);
      // 圓頂紅眼（頭部艙蓋）
      p.add(geo('box'), H1, [0, 0.46, 0.04], 0, [0.4, 0.22, 0.38]);
      p.add(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), RED, [0, 0.44, 0.23], [Math.PI / 2, 0, 0], [0.12, 0.06, 0.12]);
      p.add(geo('lsphere'), 0xffd0c0, [0.03, 0.47, 0.28], 0, [0.025, 0.025, 0.015]);
      p.add(cyl(0.012, 0.012, 0.2, 4), MET, [0.13, 0.66, 0]);
      p.add(geo('lsphere'), RED, [0.13, 0.77, 0], 0, 0.025);
      // 鉚釘
      for (const [x, y] of [[-0.28, 0.22], [0.28, 0.22], [-0.28, -0.22], [0.28, -0.22]]) p.add(geo('lsphere'), MET, [x, y, 0.305], 0, 0.02);
      out.body = p.build();
    }
    { // 砲管手（右）
      const p = new Parts();
      p.add(geo('sphere'), H2, [0, 0, 0], 0, 0.12);
      p.add(cyl(0.085, 0.085, 0.55, 10), 0x4a4e4a, [0, -0.05, 0.25], [Math.PI / 2, 0, 0]);
      p.add(cyl(0.11, 0.11, 0.1, 10), H1, [0, -0.05, 0.08], [Math.PI / 2, 0, 0]);
      p.add(cyl(0.06, 0.06, 0.04, 10, true), 0x1a1a1a, [0, -0.05, 0.53], [Math.PI / 2, 0, 0]);
      out.cannon = p.build();
    }
    { // 夾爪手（左）
      const p = new Parts();
      p.add(geo('sphere'), H2, [0, 0, 0], 0, 0.1);
      p.add(limb(0.05, 0.045, 0.26, 6), MET, [0, 0, 0]);
      for (const sx of [-1, 1]) p.add(geo('box'), H2, [sx * 0.04, -0.32, 0.03], [0, 0, sx * 0.3], [0.03, 0.12, 0.06]);
      out.claw = p.build();
    }
    {
      const p = new Parts();
      p.add(geo('box'), H2, [0, -0.1, 0], 0, [0.15, 0.22, 0.17]);
      p.add(geo('box'), H1, [0, -0.25, 0.04], 0, [0.2, 0.08, 0.28]);
      out.leg = p.build();
    }
  } else if (kind === 'ape') {
    const F1 = 0x6b4426, F2 = 0x553319, TAN = 0xd6a878;
    {
      const p = new Parts();
      p.add(geo('sphere'), F1, [0, 1.3, -0.05], 0, [1.25, 1.45, 1.0]);
      p.add(geo('sphere'), TAN, [0, 1.15, 0.45], 0, [0.85, 1.05, 0.6]);
      p.add(geo('sphere'), F1, [0, 0.2, 0], 0, [0.95, 0.65, 0.8]);
      // 毛團（肩與背）
      const lumps = [[0.95, 2.15, -0.1, 0.55], [-0.95, 2.15, -0.1, 0.55], [0, 2.4, -0.45, 0.6], [0.6, 1.8, -0.7, 0.5], [-0.6, 1.8, -0.7, 0.5], [0, 1.3, -0.85, 0.55]];
      lumps.forEach(([x, y, z, r], i) => p.add(geo('dodec'), i % 2 ? F2 : F1, [x, y, z], [i, i * 0.7, 0], [r, r * 0.85, r]));
      p.add(limb(0.45, 0.55, 0.4, 10), F1, [0, 2.75, 0.05]);
      out.body = p.build();
    }
    {
      const p = new Parts();
      p.add(geo('sphere'), F1, [0, 0.45, 0], 0, [0.72, 0.68, 0.7]);
      p.add(geo('sphere'), TAN, [0, 0.3, 0.42], 0, [0.52, 0.42, 0.42]);
      p.add(geo('sphere'), TAN, [0, 0.62, 0.38], 0, [0.48, 0.2, 0.3]);
      p.add(geo('box'), F2, [0, 0.72, 0.5], [0.3, 0, 0], [0.9, 0.12, 0.2]); // 粗眉骨
      for (const sx of [-1, 1]) {
        p.add(geo('sphere'), TAN, [sx * 0.7, 0.55, -0.05], 0, [0.16, 0.2, 0.08]);
        p.add(geo('lsphere'), 0x2a0806, [sx * 0.22, 0.58, 0.68], 0, [0.12, 0.08, 0.05]);
      }
      p.add(geo('box'), 0x2a1408, [0, 0.13, 0.82], 0, [0.4, 0.04, 0.05]);
      for (const sx of [-1, 1]) p.add(geo('cone6'), 0xf2ead8, [sx * 0.16, 0.12, 0.78], [Math.PI, 0, 0], [0.04, 0.12, 0.04]);
      out.head = p.build();
    }
    { // 手臂（長，到膝）
      const p = new Parts();
      p.add(geo('sphere'), F1, [0, 0, 0], 0, 0.5);
      p.add(limb(0.42, 0.34, 1.2, 10), F1, [0, 0, 0]);
      p.add(geo('dodec'), F2, [0, -0.5, -0.15], [0.4, 0.2, 0], [0.4, 0.45, 0.35]);
      out.upper = p.build();
      const q = new Parts();
      q.add(limb(0.36, 0.3, 1.1, 10), F1, [0, 0, 0]);
      q.add(geo('sphere'), TAN, [0, -1.25, 0.05], 0, [0.38, 0.3, 0.42]);
      for (let i = 0; i < 4; i++) q.add(geo('sphere'), TAN, [(i - 1.5) * 0.16, -1.48, 0.2], 0, [0.09, 0.12, 0.1]);
      out.fore = q.build();
    }
    {
      const p = new Parts();
      p.add(geo('sphere'), F1, [0, 0, 0], 0, 0.58);
      p.add(limb(0.52, 0.42, 1.3, 10), F1, [0, 0, 0]);
      p.add(geo('sphere'), F2, [0, -1.38, 0.15], 0, [0.46, 0.2, 0.62]);
      out.leg = p.build();
    }
    out.tail = [0, 1, 2, 3].map((i) => { const p = new Parts(); p.add(limb(0.18 - i * 0.03, 0.15 - i * 0.03, 0.75, 8), i % 2 ? F2 : F1, [0, 0, 0]); return p.build(); });
    out.eyes = (() => { const p = new Parts(); for (const sx of [-1, 1]) p.add(geo('lsphere'), 0xff2a10, [sx * 0.22, 0.58, 0.71], 0, [0.075, 0.05, 0.03]); return p.build(); })();
  }
  monsterGeoCache[kind] = out;
  return out;
}

export function buildMonster(kind = 'dino') {
  const gs = monsterGeos(kind);
  const root = new THREE.Group(); root.name = 'monster-' + kind;
  const body = new THREE.Group(); root.add(body);
  let time = 0;
  const deadPose = (t, height) => {
    body.rotation.z = -1.35 * ease(clamp(t / 0.45, 0, 1));
    body.position.x = -height * 0.25 * ease(clamp(t / 0.45, 0, 1));
    body.position.y = -height * 0.35 * clamp((t - 0.7) / 0.8, 0, 1);
    root.scale.setScalar(Math.max(0.001, 1 - clamp((t - 1.1) / 0.4, 0, 1)));
  };

  if (kind === 'dino') {
    const H = 1.4;
    const torso = new THREE.Group(); torso.position.y = 0.82; body.add(torso);
    meshPair(gs.body, torso, { w: 0.025 });
    const neck = new THREE.Group(); neck.position.set(0, 0.05, 0.45); torso.add(neck);
    meshPair(gs.head, neck, { w: 0.025 });
    const jaw = new THREE.Group(); jaw.position.set(0, 0.26, 0.32); neck.add(jaw);
    meshPair(gs.jaw, jaw, { w: 0.02 });
    const legs = [-1, 1].map((sx) => { const g = new THREE.Group(); g.position.set(sx * 0.24, -0.12, -0.05); torso.add(g); meshPair(gs.leg, g, { w: 0.022 }); return g; });
    const tail = []; let par = torso;
    gs.tail.forEach((g, i) => { const s = new THREE.Group(); s.position.set(0, i ? -0.4 : 0.05, i ? 0 : -0.48); s.rotation.x = i ? 0.25 : -1.75; par.add(s); meshPair(g, s, { w: 0.022 }); tail.push(s); par = s; });
    const update = (dt, anim) => {
      time += dt;
      const name = (anim && anim.name) || 'idle', t = (anim && anim.t) || 0;
      body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); root.scale.setScalar(1);
      torso.rotation.x = 0; neck.rotation.x = 0.1 * Math.sin(time * 1.3); jaw.rotation.x = 0.08 + 0.05 * Math.sin(time * 2);
      legs.forEach((l) => { l.rotation.x = 0; });
      tail.forEach((s, i) => { s.rotation.y = 0.18 * Math.sin(time * 2.2 - i); });
      torso.position.y = 0.82 + 0.015 * Math.sin(time * 2.5);
      if (name === 'walk') {
        const s = Math.sin(time * 9);
        legs[0].rotation.x = 0.6 * s; legs[1].rotation.x = -0.6 * s;
        torso.position.y = 0.82 + 0.05 * Math.abs(s); torso.rotation.z = 0.06 * s;
        tail.forEach((sg, i) => { sg.rotation.y = 0.3 * Math.sin(time * 9 - i); });
      } else if (name === 'atk') {
        const k = t < 0.12 ? -ease(t / 0.12) : t < 0.2 ? -1 + 2 * ease((t - 0.12) / 0.08) : 1 - ease(clamp((t - 0.2) / 0.3, 0, 1));
        torso.rotation.x = 0.25 * k; body.position.z = 0.25 * Math.max(0, k);
        neck.rotation.x = 0.35 * k; jaw.rotation.x = t < 0.16 ? 0.7 * ease(t / 0.16) : 0.7 * (1 - ease(clamp((t - 0.16) / 0.06, 0, 1)));
      } else if (name === 'dead') deadPose(t, H);
    };
    return { root, update, height: H };
  }

  if (kind === 'robot') {
    const H = 1.6;
    const hull = new THREE.Group(); hull.position.y = 0.72; body.add(hull);
    meshPair(gs.body, hull, { w: 0.025 });
    const cannon = new THREE.Group(); cannon.position.set(-0.46, 0.05, 0); hull.add(cannon); meshPair(gs.cannon, cannon, { w: 0.022 });
    const claw = new THREE.Group(); claw.position.set(0.46, 0.08, 0); hull.add(claw); meshPair(gs.claw, claw, { w: 0.02 });
    const legs = [-1, 1].map((sx) => { const g = new THREE.Group(); g.position.set(sx * 0.2, -0.32, 0); hull.add(g); meshPair(gs.leg, g, { w: 0.02 }); return g; });
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.05, 0.56); cannon.add(muzzle);
    const update = (dt, anim) => {
      time += dt;
      const name = (anim && anim.name) || 'idle', t = (anim && anim.t) || 0;
      body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); root.scale.setScalar(1);
      hull.position.y = 0.72 + 0.01 * Math.sin(time * 4); hull.rotation.set(0, 0, 0);
      cannon.position.z = 0; cannon.rotation.x = 0; claw.rotation.x = 0.1 * Math.sin(time * 1.5);
      legs.forEach((l) => { l.rotation.x = 0; l.position.y = -0.32; });
      if (name === 'walk') {
        const s = Math.sin(time * 10);
        hull.rotation.z = 0.08 * s; hull.position.y = 0.72 + 0.04 * Math.abs(s);
        legs[0].position.y = -0.32 + 0.05 * Math.max(0, s); legs[1].position.y = -0.32 + 0.05 * Math.max(0, -s);
        legs[0].rotation.x = 0.3 * s; legs[1].rotation.x = -0.3 * s;
      } else if (name === 'atk') {
        const r = t < 0.15 ? ease(t / 0.15) * 0.15 : t < 0.2 ? 0.15 - 0.4 * (t - 0.15) / 0.05 : -0.25 * (1 - ease(clamp((t - 0.2) / 0.35, 0, 1)));
        cannon.position.z = r; hull.rotation.x = -Math.max(0, -r) * 0.4; cannon.rotation.x = -0.1;
      } else if (name === 'dead') deadPose(t, H);
    };
    return { root, update, height: H, muzzle };
  }

  // ape
  const H = 6.5;
  const HIP = 1.55;
  body.scale.setScalar(1.15);
  const hip = new THREE.Group(); hip.position.y = HIP; body.add(hip);
  const torso = new THREE.Group(); hip.add(torso);
  meshPair(gs.body, torso, { w: 0.06 });
  const head = new THREE.Group(); head.position.set(0, 2.85, 0.15); torso.add(head);
  meshPair(gs.head, head, { w: 0.05 });
  const eyes = new THREE.Mesh(gs.eyes, emissiveToon(0xff2a10, 1.6)); head.add(eyes);
  const arms = [-1, 1].map((sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 1.3, 2.25, 0); torso.add(sh); meshPair(gs.upper, sh, { w: 0.05 });
    const el = new THREE.Group(); el.position.y = -1.2; sh.add(el); meshPair(gs.fore, el, { w: 0.05 });
    return { sh, el, sx };
  });
  const legs = [-1, 1].map((sx) => { const g = new THREE.Group(); g.position.set(sx * 0.6, 0.0, 0); hip.add(g); meshPair(gs.leg, g, { w: 0.05 }); return g; });
  const tail = []; let par = hip;
  gs.tail.forEach((g, i) => { const s = new THREE.Group(); s.position.set(0, i ? -0.75 : 0.3, i ? 0 : -0.75); s.rotation.x = i ? -0.35 : -2.0; par.add(s); meshPair(g, s, { w: 0.04 }); tail.push(s); par = s; });
  const update = (dt, anim) => {
    time += dt;
    const name = (anim && anim.name) || 'idle', t = (anim && anim.t) || 0;
    body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); root.scale.setScalar(1);
    const br = Math.sin(time * 1.4);
    hip.position.y = HIP + 0.03 * br; torso.rotation.set(0.12 + 0.02 * br, 0, 0); head.rotation.set(-0.05, 0.15 * Math.sin(time * 0.6), 0);
    for (const a of arms) { a.sh.rotation.set(0.25, 0, a.sx * 0.18); a.el.rotation.x = -0.35; }
    legs.forEach((l) => { l.rotation.x = 0; });
    tail.forEach((s, i) => { s.rotation.z = 0.15 * Math.sin(time * 1.3 - i * 0.6); });
    if (name === 'walk') {
      const s = Math.sin(time * 4.5);
      legs[0].rotation.x = 0.45 * s; legs[1].rotation.x = -0.45 * s;
      hip.position.y = HIP + 0.12 * Math.abs(s); torso.rotation.z = 0.08 * s;
      arms[0].sh.rotation.x = 0.25 - 0.4 * s; arms[1].sh.rotation.x = 0.25 + 0.4 * s;
    } else if (name === 'atk') { // 雙手高舉後砸地
      const up = t < 0.35 ? ease(t / 0.35) : t < 0.48 ? 1 - ease((t - 0.35) / 0.13) * 1.6 : -0.6 * (1 - ease(clamp((t - 0.48) / 0.5, 0, 1)));
      for (const a of arms) { a.sh.rotation.x = 0.25 - 3.0 * Math.max(0, up) + 1.4 * Math.max(0, -up); a.sh.rotation.z = a.sx * 0.1; a.el.rotation.x = -0.35 - 0.3 * Math.max(0, up); }
      torso.rotation.x = 0.12 - 0.35 * Math.max(0, up) + 0.5 * Math.max(0, -up);
      hip.position.y = HIP - 0.25 * Math.max(0, -up);
    } else if (name === 'roar') {
      const k = ease(clamp(t / 0.4, 0, 1)), sh = Math.sin(time * 40) * 0.02 * k;
      torso.rotation.x = 0.12 - 0.4 * k + sh; head.rotation.x = -0.6 * k;
      for (const a of arms) { a.sh.rotation.x = 0.25 - 0.4 * k; a.sh.rotation.z = a.sx * (0.18 + 1.1 * k); a.el.rotation.x = -0.35 - 0.6 * k; }
    } else if (name === 'dead') deadPose(t, H * 0.6);
  };
  return { root, update, height: H };
}
