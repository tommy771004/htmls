// 英雄的骨架、程式動畫與組裝（網格由 Blender 腳本建模、烘在 models-baked.js；七龍珠 FighterZ 同人致敬，不使用任何原作素材），以及程式建模的小兵、野怪、防禦塔、主堡（基本幾何合併、頂點色＋共用卡通材質）。外框用反向殼。
// 介面見 SPEC.md §4。root 朝 +z 為正面。
import * as THREE from 'three';
import { PROPS, buildHeroParts, heroMaterial } from './models-heroes.js';

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
export const HERO = {
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
  Object.assign(d, PROPS[id]);
  d.torso = d.H - d.L - d.hr * 1.95 - 0.04;
  d.upper = d.torso * 0.5; d.lower = d.torso * 0.47;
  d.thighLen = d.L * 0.5; d.shinLen = d.L * 0.44;
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

/* ---------------- 英雄材質 ---------------- */
const _heroMats = new Map();
function heroMat(id, team) { const k = id + ':' + team; if (!_heroMats.has(k)) _heroMats.set(k, heroMaterial({ team: TEAM[team] })); return _heroMats.get(k); }
function headMat(id, form, tex, rect) { const k = id + form; if (!_heroMats.has(k)) _heroMats.set(k, heroMaterial({ face: tex, faceRect: rect, skinBias: 0.35 })); return _heroMats.get(k); }
// 蒙皮網格的外框：法線取蒙皮後的 transformedNormal；aOl 是逐頂點的外框粗細倍率（臉、手指較細）
const _skinOutline = {};
function skinOutlineMat(w) {
  if (_skinOutline[w]) return _skinOutline[w];
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uOutline = { value: w };
    s.vertexShader = 'uniform float uOutline;\nattribute float aOl;\n' + s.vertexShader.replace('#include <project_vertex>',
      'vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );\n' +
      '#ifdef USE_SKINNING\nvec3 _on = normalize( transformedNormal );\n#ifdef FLIP_SIDED\n_on = -_on;\n#endif\n#else\nvec3 _on = normalize( normalMatrix * normal );\n#endif\n' +
      'mvPosition.xyz += _on * uOutline * aOl * clamp(-mvPosition.z / 9.0, 0.3, 1.0) * (1.0 + 0.012 * max(0.0, -mvPosition.z - 10.0));\n' +
      'gl_Position = projectionMatrix * mvPosition;');
  };
  m.customProgramCacheKey = () => 'ki-skin-outline-' + w;
  _skinOutline[w] = m;
  return m;
}

/* ---------------- 骨架 ---------------- */
// 次級擺動鏈（骨頭，參與蒙皮）：parent 是掛點骨、pos 是掛點在該骨的位置、n 節、每節長 len
export function chainSpecs(id, d) {
  const out = [];
  if (id === 'goku' || id === 'piccolo') out.push({ name: 'sash', parent: 'hips', pos: [0.13, 0.03, d.chest[2] * 0.92], n: 2, len: id === 'piccolo' ? 0.19 : 0.17, base: -0.15, yaw: 0.1, lift: -0.6, flutter: 0.2 });
  if (id === 'frieza') out.push({ name: 'tail', parent: 'hips', pos: [0, -0.04, -d.hip * 1.05], n: 5, len: 0.2, base: 0.75, lift: 0.22, flutter: 0.1, curl: 0.16, sway: 0.4 });
  return out;
}
// 綁定姿勢（A 字）：模型在 Blender 以這個姿勢建模與刷權重
export const BIND = { shZ: 0.75, thZ: 0.1 };
export const BONE_ORDER = ['hips', 'torso', 'head', 'shL', 'elL', 'shR', 'elR', 'thL', 'knL', 'thR', 'knR'];

export function heroSkeleton(id) {
  const d = HERO[id];
  if (!d) throw new Error('unknown hero ' + id);
  const root = new THREE.Group(); root.name = 'hero-' + id;
  const body = new THREE.Group(); root.add(body);
  const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); return b; };
  const hips = bone('hips', body, 0, d.L, 0);
  const torso = bone('torso', hips, 0, 0.02, 0);
  const head = bone('head', torso, 0, d.torso + 0.04, 0);
  const J = { hips, torso, head };
  const hands = {};
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = bone('sh' + side, torso, sx * d.sw, d.torso - 0.05, 0);
    const el = bone('el' + side, sh, 0, -d.upper, 0);
    const hand = new THREE.Object3D(); hand.position.y = -d.lower - d.fist * 0.55; el.add(hand); hands[side] = hand;
    const th = bone('th' + side, hips, sx * d.hip * 0.62, -0.03, 0);
    const kn = bone('kn' + side, th, 0, -d.thighLen, 0);
    Object.assign(J, { ['sh' + side]: sh, ['el' + side]: el, ['th' + side]: th, ['kn' + side]: kn });
  }
  const bones = BONE_ORDER.map((n) => J[n]);
  const chains = chainSpecs(id, d).map((c) => {
    let par = J[c.parent]; const segs = [];
    for (let i = 0; i < c.n; i++) {
      const b = i === 0 ? bone(c.name + i, par, ...c.pos) : bone(c.name + i, par, 0, -c.len, 0);
      segs.push(b); bones.push(b); par = b;
    }
    return { ...c, segs };
  });
  const chest = new THREE.Object3D(); chest.position.set(0, d.torso * 0.66, d.chest[2] * 0.5); torso.add(chest);
  return { d, root, body, J, hands, chest, chains, bones };
}
export function bindPose(sk) {
  for (const b of sk.bones) b.rotation.set(0, 0, 0);
  sk.J.shL.rotation.z = BIND.shZ; sk.J.shR.rotation.z = -BIND.shZ;
  sk.J.thL.rotation.z = BIND.thZ; sk.J.thR.rotation.z = -BIND.thZ;
  sk.root.updateMatrixWorld(true);
}

/* ---------------- buildHero ---------------- */
const SWORD_IN_HAND = new Set(['atk1', 'atk2', 'atk3', 'slash', 'rush', 'dash']);
const OW = 0.012;
export function buildHero(id, team = 0) {
  const sk = heroSkeleton(id);
  const { d, root, body, J, hands, chest } = sk;
  const { hips, torso, head } = J;
  const gs = buildHeroParts(id, d);
  const pair = (geometry, parent, mat, w = OW) => {
    const m = new THREE.Mesh(geometry, mat); m.castShadow = true; parent.add(m);
    if (w) { const o = new THREE.Mesh(geometry, skinOutlineMat(w)); o.raycast = () => {}; parent.add(o); m.userData.outline = o; }
    return m;
  };
  const show = (m, on) => { m.visible = on; if (m.userData.outline) m.userData.outline.visible = on; };

  // 身體：一張蒙皮網格，以 A 字姿勢綁定到骨架
  bindPose(sk);
  const skeleton = new THREE.Skeleton(sk.bones);
  const skin = new THREE.SkinnedMesh(gs.body, heroMat(id, team));
  skin.castShadow = true; skin.frustumCulled = false; root.add(skin);
  const skinO = new THREE.SkinnedMesh(gs.body, skinOutlineMat(OW));
  skinO.frustumCulled = false; skinO.raycast = () => {}; root.add(skinO);
  root.updateMatrixWorld(true);
  skin.bind(skeleton, skin.matrixWorld); skinO.bind(skeleton, skinO.matrixWorld);

  // 頭顱共用、髮型依型態切換；臉部貼圖（眼睛顏色）也隨型態換材質
  const skull = pair(gs.skull, head, headMat(id, 'base', gs.faces.base, gs.faceRect));
  const hairForms = {};
  for (const f in gs.hair) { hairForms[f] = pair(gs.hair[f], head, heroMat(id, team)); show(hairForms[f], f === 'base'); }

  const chains = sk.chains.map((c) => ({ segs: c.segs, base: c.base, yaw: c.yaw || 0, lift: c.lift ?? 1, flutter: c.flutter ?? 0.25, curl: c.curl || 0, sway: c.sway || 0, cur: c.segs.map(() => c.base), phase: Math.random() * 6 }));

  // 特南克斯的劍：背上的鞘與在手上的劍
  let sword = null, swordState = 'back', backSocket = null, handSocket = null;
  if (gs.sword) {
    const bodyMat = heroMat(id, team);
    backSocket = new THREE.Group();
    backSocket.position.set(-0.11, d.torso * 0.98, -d.chest[2] * 1.02);
    backSocket.rotation.set(0, 0, -2.6);
    torso.add(backSocket);
    pair(gs.sheath, backSocket, bodyMat, 0.008);
    sword = new THREE.Group();
    pair(gs.sword, sword, bodyMat, 0.006);
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
    for (const k in hairForms) show(hairForms[k], k === form);
    if (gs.faces[form]) skull.material = headMat(id, form, gs.faces[form], gs.faceRect);
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
    // 戰鬥裝甲步兵：深色緊身衣、白色胸甲、隊伍色護肩與頭盔、單眼偵測器、警棍
    const suit = 0x262c40, plate = 0xf1ece0, plateD = 0xc9c1ae, skin = 0xd9a77e, boot = 0xe8e2d2;
    {
      const p = new Parts();
      p.add(geo('lsphere'), suit, [0, 0.44, 0], 0, [0.24, 0.3, 0.21]);              // 軀幹
      p.add(geo('hsphere'), plate, [0, 0.56, 0.015], 0, [0.27, 0.23, 0.24]);         // 胸甲
      p.add(cyl(0.25, 0.27, 0.07, 14), tc, [0, 0.36, 0]);                            // 腰帶
      p.add(geo('box'), plateD, [0, 0.27, 0.15], [0.15, 0, 0], [0.16, 0.12, 0.05]);   // 下襬
      for (const sx of [-1, 1]) {
        p.add(geo('hsphere'), tc, [sx * 0.25, 0.73, 0], [0, 0, sx * -0.35], [0.15, 0.06, 0.15]);   // 護肩
        p.add(geo('hsphere'), plateD, [sx * 0.25, 0.71, 0], [0, 0, sx * -0.35], [0.155, 0.04, 0.155]);
      }
      p.add(geo('lsphere'), skin, [0, 0.9, 0.01], 0, [0.15, 0.16, 0.15]);              // 頭
      p.add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), tc, [0, 0.92, -0.005], [-0.12, 0, 0], [0.165, 0.17, 0.165]); // 頭盔
      p.add(geo('box'), 0x1a1d27, [0, 0.885, 0.135], 0, [0.17, 0.035, 0.03]);        // 眼縫
      p.add(geo('box'), 0x3b4558, [0.14, 0.9, 0.06], 0, [0.03, 0.07, 0.08]);           // 偵測器
      p.add(geo('box'), 0x7dffa0, [0.12, 0.9, 0.15], [0, -0.3, 0], [0.07, 0.045, 0.012]);
      out.body = p.build();
    }
    {
      const p = new Parts();
      for (const sx of [-1, 1]) { p.add(limb(0.06, 0.055, 0.16, 8), suit, [sx * 0.1, 0.24, 0.0]); p.add(geo('lsphere'), boot, [sx * 0.1, 0.07, 0.03], 0, [0.075, 0.075, 0.11]); }
      out.feet = p.build();
    }
    {
      // 護臂（左）
      const p = new Parts();
      p.add(limb(0.055, 0.05, 0.2, 8), suit, [0, 0, 0]);
      p.add(cyl(0.07, 0.075, 0.12, 10), plate, [0, -0.15, 0]);
      p.add(geo('lsphere'), plateD, [0, -0.23, 0.01], 0, 0.06);
      out.shield = p.build();
    }
    {
      // 警棍臂（右）
      const p = new Parts();
      p.add(limb(0.055, 0.05, 0.2, 8), suit, [0, 0, 0]);
      p.add(cyl(0.07, 0.075, 0.12, 10), plate, [0, -0.15, 0]);
      p.add(geo('lsphere'), plateD, [0, -0.22, 0], 0, 0.06);
      p.add(limb(0.03, 0.035, 0.4, 8), 0x2d3240, [0, -0.22, 0.02], [-Math.PI * 0.62, 0, 0]);
      p.add(geo('lsphere'), tl, [0, -0.39, 0.33], 0, [0.045, 0.045, 0.045]);
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
  const MS = kind === 'melee' ? 1.3 : 1.2; // 視覺放大，碰撞半徑不變
  if (kind === 'melee') {
    meshPair(gs.body, body, { w: 0.022 });
    const feet = meshPair(gs.feet, root, { outline: false });
    const shield = new THREE.Group(); shield.position.set(0.27, 0.5, 0.02); body.add(shield);
    meshPair(gs.shield, shield, { w: 0.02 });
    const club = new THREE.Group(); club.position.set(-0.27, 0.5, 0.02); body.add(club);
    meshPair(gs.club, club, { outline: false });
    shield.rotation.set(-0.25, 0, 0.18);
    const update = (dt, anim) => {
      time += dt;
      const name = (anim && anim.name) || 'idle', t = (anim && anim.t) || 0;
      body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); feet.visible = true; root.scale.setScalar(MS);
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
        root.scale.setScalar(Math.max(0.001, sc) * MS);
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
    root.scale.setScalar(MS);
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
      root.scale.setScalar(Math.max(0.001, 1 - clamp((t - 0.9) / 0.5, 0, 1)) * MS);
    }
  };
  lm.userData.lantern = true;
  return { root, update, muzzle };
}

/* ---------------- 防禦塔 ---------------- */
const WHITE = new THREE.Color(0xffffff);
const STONE = 0xc2b8a3, STONE_D = 0x8f8676, STONE_DD = 0x6f6759, BRONZE = 0xa8823f;
const towerGeoCache = {};
// 白色天線塔：圓台座、半球底座、一節節的環紋細頸、上方帶深色腰帶與隊伍色燈窗的球形塔頭
const PORCELAIN = 0xeef0ee, PORC_D = 0xc4cbd2, STEEL = 0x3b4558;
function towerGeos(team) {
  if (towerGeoCache[team]) return towerGeoCache[team];
  const tc = TEAM[team], tl = TEAM_LIGHT[team];
  const out = {};
  {
    const p = new Parts();
    p.add(cyl(2.15, 2.3, 0.32, 24), PORC_D, [0, 0.16, 0]);
    p.add(cyl(2.0, 2.05, 0.1, 24), STEEL, [0, 0.36, 0]);
    p.add(cyl(1.85, 1.95, 0.22, 24), PORCELAIN, [0, 0.52, 0]);
    p.add(new THREE.TorusGeometry(1.9, 0.045, 4, 32), tl, [0, 0.42, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; p.add(geo('box'), STEEL, [Math.cos(a) * 1.95, 0.5, Math.sin(a) * 1.95], [0, -a, 0], [0.16, 0.28, 0.32]); }
    out.base = p.build();
  }
  {
    const p = new Parts();
    // 半球底座
    p.add(new THREE.SphereGeometry(1.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), PORCELAIN, [0, 0.62, 0], 0, [1, 0.75, 1]);
    p.add(new THREE.TorusGeometry(1.24, 0.06, 5, 32), STEEL, [0, 0.66, 0], [Math.PI / 2, 0, 0]);
    p.add(new THREE.TorusGeometry(0.92, 0.05, 5, 28), PORC_D, [0, 1.18, 0], [Math.PI / 2, 0, 0]);
    // 環紋細頸
    p.add(cyl(0.26, 0.34, 3.6, 14), PORC_D, [0, 3.2, 0]);
    for (let i = 0; i < 15; i++) p.add(new THREE.TorusGeometry(0.33 - i * 0.004, 0.075, 6, 16), i % 5 === 4 ? STEEL : PORCELAIN, [0, 1.6 + i * 0.22, 0], [Math.PI / 2, 0, 0]);
    // 球形塔頭
    p.add(geo('hsphere'), PORCELAIN, [0, 5.35, 0], 0, [1.05, 0.82, 1.05]);
    p.add(cyl(1.08, 1.08, 0.22, 28), STEEL, [0, 5.3, 0]);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p.add(geo('box'), tl, [Math.cos(a) * 1.05, 5.3, Math.sin(a) * 1.05], [0, -a, 0], [0.04, 0.12, 0.32]); }
    p.add(new THREE.TorusGeometry(0.72, 0.05, 5, 24), PORC_D, [0, 5.88, 0], [Math.PI / 2, 0, 0]);
    p.add(cyl(0.18, 0.26, 0.35, 10), STEEL, [0, 6.1, 0]);
    // 隊伍色細條
    p.add(cyl(0.36, 0.36, 0.12, 14), tc, [0, 1.42, 0]);
    out.pillar = p.build();
  }
  {
    const p = new Parts();
    const cracks = [[0.95, 5.5, 0.3, 0.5], [-0.6, 5.45, 0.8, -0.3], [0.2, 5.6, -0.98, 0.9], [0.9, 0.95, 0.4, 0.2], [-0.8, 0.9, -0.6, -0.6]];
    for (const [x, y, z, r] of cracks) {
      const a = Math.atan2(z, x);
      p.add(geo('box'), 0x2d3440, [x, y, z], [0, -a + Math.PI / 2, r], [0.04, 0.45, 0.03]);
      p.add(geo('box'), 0x2d3440, [x, y - 0.2, z], [0, -a + Math.PI / 2, -r], [0.035, 0.3, 0.03]);
    }
    out.cracks = p.build();
  }
  {
    const p = new Parts();
    p.add(new THREE.SphereGeometry(1.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), PORCELAIN, [0, 0.62, 0], [0.15, 0, 0.1], [1, 0.6, 1]);
    p.add(cyl(0.26, 0.34, 1.1, 12), PORC_D, [0.3, 1.4, 0], [0.4, 0, -0.5]);
    const ch = [[1.3, 0.3, 0.6, 0.45], [-1.1, 0.25, 1.1, 0.4], [0.4, 0.3, -1.5, 0.55], [-1.6, 0.2, -0.6, 0.35], [1.7, 0.2, -0.9, 0.3], [-0.5, 0.35, 0.2, 0.45]];
    ch.forEach(([x, y, z, sc], i) => p.add(geo('dodec'), i % 2 ? PORCELAIN : PORC_D, [x, y + 0.5, z], [i, i * 2, i * 0.5], [sc * 1.4, sc, sc * 1.2]));
    p.add(new THREE.SphereGeometry(1.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), PORCELAIN, [-1.6, 0.25, 1.4], [2.6, 0.4, 0.2], [1, 0.8, 1]);
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
  const orb = new THREE.Mesh(geo('hsphere'), orbMat); orb.scale.set(0.42, 0.42, 0.42); orb.castShadow = true;
  const orbO = new THREE.Mesh(geo('hsphere'), outlineMat(0.05)); orb.add(orbO);
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
    orb.scale.setScalar(0.42 * sc);
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
  if (kind === 'shenron') return buildShenron();
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

/* ---------------- 神龍 ---------------- */
// 從神龍坑盤旋升起的長龍：沿螺旋曲線掃出粗細漸變的身體（背綠、腹黃），背鰭、短臂、長吻、鹿角與長鬚。
// 動作：rise（從地底升起）、idle（緩慢擺動）、atk（低頭張口）、dead（沉回地底）。整條龍只會慢慢轉向。
function sweepTube(curve, n, radial, rFn, colFn) {
  const frames = curve.computeFrenetFrames(n, false), pos = [], col = [], idx = [];
  const P = new V3(), dir = new V3();
  for (let i = 0; i <= n; i++) {
    const t = i / n; curve.getPointAt(t, P); const r = rFn(t), N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      dir.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(P.x + dir.x * r, P.y + dir.y * r, P.z + dir.z * r);
      const c = colFn(t, P, dir); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed();
}
let shenronGeo = null;
function shenronGeos() {
  if (shenronGeo) return shenronGeo;
  const pts = [];
  for (let k = 0; k <= 18; k++) { const f = k / 18, ang = f * 2.1 * Math.PI * 2 + 0.6, r = 3.1 - f * 1.2; pts.push(new V3(Math.cos(ang) * r, -1.5 + f * 9.2, Math.sin(ang) * r)); }
  pts.push(new V3(0.6, 8.9, -0.4), new V3(0.15, 10.0, 0.5), new V3(0, 10.4, 1.5));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  const green = new THREE.Color(0x2f8f3c), greenD = new THREE.Color(0x287a35), belly = new THREE.Color(0xead27a), bellyD = new THREE.Color(0xc9a94e), tmp = new THREE.Color();
  const toAxis = new V3(), bdir = new V3();
  const body = sweepTube(curve, 220, 14,
    (t) => (t < 0.06 ? 0.35 + t / 0.06 * 0.55 : t > 0.86 ? 0.9 - (t - 0.86) / 0.14 * 0.32 : 0.9 + Math.sin(t * 9) * 0.04),
    (t, P, dir) => {
      toAxis.set(-P.x, 0, -P.z).normalize();
      bdir.copy(toAxis).lerp(new V3(0, -1, 0), clamp((t - 0.8) / 0.12, 0, 1)).normalize();
      const b = dir.dot(bdir);
      if (b > 0.35) { const ring = Math.sin(t * 260) > 0.55; return tmp.copy(ring ? bellyD : belly); }
      const stripe = Math.sin(t * 150 + dir.y * 3) > 0.82;
      return tmp.copy(stripe ? greenD : green).multiplyScalar(0.92 + 0.08 * b);
    });
  // 背鰭與短臂
  const fins = new Parts(), up = new V3(0, 1, 0), q = new THREE.Quaternion(), P = new V3();
  for (let i = 6; i < 47; i++) {
    const t = i / 50; curve.getPointAt(t, P);
    const out = new V3(P.x, 0, P.z).normalize().lerp(new V3(0, 1, 0), clamp((t - 0.78) / 0.12, 0, 1)).normalize();
    q.setFromUnitVectors(up, out);
    const r = t > 0.86 ? 0.7 : 0.88, s = 0.24 + 0.08 * Math.sin(i * 1.7);
    fins.addM(geo('cone6'), i % 2 ? 0xf0d98c : 0xd7b85a, new THREE.Matrix4().compose(P.clone().addScaledVector(out, r - 0.1), q, new V3(s, s * 2.1, s * 0.5)));
  }
  for (const sx of [-1, 1]) {
    const t = 0.8; curve.getPointAt(t, P);
    const side = new V3(-P.z, 0, P.x).normalize().multiplyScalar(sx);
    const base = P.clone().addScaledVector(side, 0.8);
    fins.add(limb(0.22, 0.17, 1.1, 8), green.getHex(), [base.x, base.y, base.z], [0.6, 0, sx * 0.9]);
    const hand = base.clone().add(new V3(sx * 0.7, -0.6, 0.45));
    for (let k = 0; k < 3; k++) fins.add(geo('cone6'), 0xf3ead2, [hand.x + sx * 0.05 * k, hand.y - 0.05, hand.z + 0.12 * k - 0.1], [Math.PI * 0.85, 0, sx * 0.3], [0.06, 0.32, 0.06]);
    fins.add(geo('lsphere'), green.getHex(), [hand.x, hand.y, hand.z], 0, 0.24);
  }
  // 頭（朝 +z），下顎另外一塊以便張口
  const head = new Parts();
  head.add(geo('hsphere'), 0x2f8f3c, [0, 0, 0], 0, [0.78, 0.6, 0.9]);
  head.add(geo('hsphere'), 0x35a044, [0, 0.05, 0.85], 0, [0.52, 0.36, 0.75]);
  head.add(geo('hsphere'), 0x2a7d35, [0, 0.22, 1.35], 0, [0.36, 0.2, 0.38]);
  for (const sx of [-1, 1]) {
    head.add(geo('lsphere'), 0x1f5f2a, [sx * 0.2, 0.32, 1.55], 0, [0.07, 0.05, 0.06]);              // 鼻孔
    head.add(geo('box'), 0x184d22, [sx * 0.33, 0.42, 0.5], [0, sx * -0.35, sx * 0.25], [0.32, 0.08, 0.12]); // 眉骨
    head.add(limb(0.08, 0.04, 1.4, 6), 0xe9dcc0, [sx * 0.35, 0.48, -0.15], [-1.05, 0, sx * -0.35]);       // 鹿角
    head.add(limb(0.05, 0.02, 0.55, 5), 0xe9dcc0, [sx * 0.55, 0.95, -0.55], [-0.3, 0, sx * -0.9]);
    head.add(geo('cone6'), 0xd7b85a, [sx * 0.62, -0.05, -0.05], [0, 0, sx * -1.9], [0.12, 0.55, 0.08]);   // 鬢鰭
  }
  head.add(geo('cone6'), 0xf3ead2, [0.22, -0.12, 1.4], [Math.PI, 0, 0], [0.06, 0.2, 0.06]);
  head.add(geo('cone6'), 0xf3ead2, [-0.22, -0.12, 1.4], [Math.PI, 0, 0], [0.06, 0.2, 0.06]);
  const jaw = new Parts();
  jaw.add(geo('hsphere'), 0x2f8f3c, [0, -0.1, 0.65], 0, [0.42, 0.18, 0.75]);
  jaw.add(geo('hsphere'), 0xead27a, [0, -0.02, 0.62], 0, [0.36, 0.1, 0.66]);
  const whisk = (sx) => { const c = new THREE.CatmullRomCurve3([new V3(sx * 0.3, 0.2, 1.5), new V3(sx * 1.2, 0.0, 1.6), new V3(sx * 2.0, -0.6, 1.0), new V3(sx * 2.6, -1.4, 0.2)]); return sweepTube(c, 24, 5, (t) => 0.06 * (1 - t * 0.8), () => new THREE.Color(0xf0e2b8)); };
  shenronGeo = { body, fins: fins.build(), head: head.build(), jaw: jaw.build(), whiskers: [whisk(1), whisk(-1)], curve };
  return shenronGeo;
}
export function buildShenron() {
  const gs = shenronGeos();
  const root = new THREE.Group(); root.name = 'shenron';
  const coil = new THREE.Group(); root.add(coil);
  meshPair(gs.body, coil, { w: 0.06 });
  meshPair(gs.fins, coil, { w: 0.04 });
  const end = gs.curve.getPointAt(1), tan = gs.curve.getTangentAt(1);
  const neck = new THREE.Group(); neck.position.copy(end); coil.add(neck);
  const head = new THREE.Group(); neck.add(head);
  head.rotation.x = Math.atan2(-tan.y, Math.hypot(tan.x, tan.z)) * 0.5 + 0.25;
  meshPair(gs.head, head, { w: 0.05 });
  for (const w of gs.whiskers) meshPair(w, head, { w: 0.02, shadow: false });
  const jaw = new THREE.Group(); jaw.position.set(0, -0.12, 0.1); head.add(jaw);
  meshPair(gs.jaw, jaw, { w: 0.04 });
  const eyeMat = emissiveToon(0xff2a2a, 1.6);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(geo('lsphere'), eyeMat); e.position.set(sx * 0.36, 0.3, 0.72); e.scale.set(0.11, 0.07, 0.07); head.add(e); }
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 14, 24, 1, true), glowMat); glow.position.y = 5; root.add(glow);
  let time = 0, yaw = Math.PI * 0.25, want = yaw;
  const setFacing = (f) => { want = f; };
  const update = (dt, anim) => {
    time += dt;
    const name = (anim && anim.name) || 'idle', t = (anim && anim.t) || 0;
    let dy = want - yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    yaw += dy * Math.min(1, dt * 1.2); root.rotation.y = yaw;
    coil.rotation.set(0.03 * Math.sin(time * 0.7), 0.06 * Math.sin(time * 0.5), 0.03 * Math.cos(time * 0.6));
    coil.position.y = 0.25 * Math.sin(time * 0.9);
    neck.rotation.set(0.08 * Math.sin(time * 1.1), 0.12 * Math.sin(time * 0.8), 0);
    jaw.rotation.x = 0.06 + 0.04 * Math.sin(time * 2);
    root.scale.setScalar(1); glowMat.opacity = 0;
    if (name === 'rise') {
      const k = ease(clamp(t / 2.2, 0, 1));
      coil.position.y = -12 * (1 - k); glowMat.opacity = 0.55 * (1 - clamp((t - 1.6) / 1.2, 0, 1));
    } else if (name === 'atk') {
      const k = t < 0.45 ? ease(t / 0.45) : 1 - ease(clamp((t - 0.45) / 0.6, 0, 1));
      neck.rotation.x += 0.45 * k; jaw.rotation.x = 0.06 + 0.55 * k;
    } else if (name === 'dead') {
      const k = clamp(t / 2.6, 0, 1);
      coil.position.y = -12 * ease(k); neck.rotation.x = -0.4 * k; glowMat.opacity = 0.4 * Math.sin(Math.PI * k);
    }
  };
  update(0, { name: 'rise', t: 0 });
  return { root, update, noFace: true, setFacing, muzzle: head };
}
