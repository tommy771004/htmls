// 關卡場景裝飾：主題光色（themeStyle）與棋盤外的背景、地標、貼在地塊側面的外觀板（buildScenery）。
// 全部不可互動。大量小零件用 Batch 依材質合併成少數網格；會動的東西用自己的材質，不碰 kit 的共用快取。
// 規則：可走地塊頂面上方不放任何東西（只允許 ≤0.05 m 的平面貼花）；側板距地塊側面 ≤0.06 m；
// 棋盤 [-1,25] 範圍內不放高物，棋盤外 4 m 內不超過 6 m。
/* global THREE */
import { toon, flat, roundedBoxGeoLo as roundedBoxGeo, outlineMat, textPlane, textTexture, gradientMap } from './kit.js';

const TH = 0.85;           // 每層高度
const GY = -0.04;          // 棋盤外地面高度
const W = (i) => i * 2 + 1; // 格中心世界座標

// ── 主題光色 ───────────────────────────────────────────
// 顏色皆為 '#rrggbb' 字串；sunDir 是「從棋盤中心指向太陽」的方向
const STY = {
  desert: {
    sky: ['#ff8a5c', '#ffd08a'], fog: '#ffc48e', fogNear: 70, fogFar: 230,
    hemiSky: '#ffe6c4', hemiGround: '#b07a50', hemiIntensity: 1.5, sun: '#fff0d4', sunIntensity: 2.4, sunDir: [-0.5, 0.8, 0.4],
    tileTop: ['#e8b273', '#d08a5a', '#b9704a', '#9a573a'], tileSide: '#8c4f33', tileEdge: '#5c2d1c', lava: '#ff5a1f', gridLine: '#c99560', accent: '#29d3c4',
  },
  parking: {
    sky: ['#2b2d6e', '#e2566a'], fog: '#c45a6c', fogNear: 70, fogFar: 220,
    hemiSky: '#ffe0e6', hemiGround: '#4a4a58', hemiIntensity: 1.6, sun: '#ffc09a', sunIntensity: 2.0, sunDir: [-0.55, 0.65, 0.35],
    tileTop: ['#666c77', '#a2a6ad', '#c0c3c8', '#d8d9dc'], tileSide: '#3e434b', tileEdge: '#22252b', lava: '#ff5a1f', gridLine: '#767c86', accent: '#ffd23f',
  },
  suburb: {
    sky: ['#5cc3ff', '#d7f3ff'], fog: '#d4effc', fogNear: 70, fogFar: 220,
    hemiSky: '#ffffff', hemiGround: '#6a8a4a', hemiIntensity: 1.6, sun: '#fffbe8', sunIntensity: 2.6, sunDir: [0.45, 1, 0.6],
    tileTop: ['#7ed25e', '#dcc6a0', '#c98f5a', '#e8dcc0'], tileSide: '#6b5a46', tileEdge: '#3d3326', lava: '#ff5a1f', gridLine: '#62b848', accent: '#ff7aa2',
  },
  swamp: {
    sky: ['#ffd36b', '#cfe39a'], fog: '#cddc96', fogNear: 60, fogFar: 200,
    hemiSky: '#fff0c0', hemiGround: '#5a6a30', hemiIntensity: 1.5, sun: '#ffe7a8', sunIntensity: 2.3, sunDir: [-0.4, 0.9, 0.5],
    tileTop: ['#928c4e', '#c4603c', '#ddd3b8', '#e8e0c8'], tileSide: '#5a4a30', tileEdge: '#33291a', lava: '#ff5a1f', gridLine: '#7c773f', accent: '#ff6fa8',
  },
  temple: {
    sky: ['#3a0d0d', '#c2471a'], fog: '#6e2412', fogNear: 55, fogFar: 170,
    hemiSky: '#ffd2a0', hemiGround: '#5a1a10', hemiIntensity: 1.55, sun: '#ffc278', sunIntensity: 2.3, sunDir: [-0.6, 0.9, 0.25],
    tileTop: ['#7e3828', '#b8622c', '#d68f2e', '#f3c94a'], tileSide: '#3e140e', tileEdge: '#1e0806', lava: '#ff5a1f', gridLine: '#924a32', accent: '#ffcf3a',
  },
  sewer: {
    sky: ['#06120c', '#0d3b2a'], fog: '#0e2e22', fogNear: 50, fogFar: 150,
    hemiSky: '#c4ffe0', hemiGround: '#26322c', hemiIntensity: 1.8, sun: '#dcfff2', sunIntensity: 1.7, sunDir: [0.3, 1, 0.4],
    tileTop: ['#4e6258', '#e0559a', '#a7b0b6', '#c8cfd3'], tileSide: '#26302b', tileEdge: '#0d1411', lava: '#5dff6a', gridLine: '#3e5047', accent: '#5dff9a',
  },
  bbq: {
    sky: ['#2a0a00', '#ff7a1a'], fog: '#a83c12', fogNear: 55, fogFar: 180,
    hemiSky: '#ffd2a0', hemiGround: '#4a2010', hemiIntensity: 1.55, sun: '#ffb468', sunIntensity: 2.4, sunDir: [0.4, 0.8, -0.5],
    tileTop: ['#a0704a', '#6a5850', '#4a4448', '#2e2c30'], tileSide: '#3a2418', tileEdge: '#140a06', lava: '#e0461a', gridLine: '#845a38', accent: '#ff8a1a',
  },
  diner: {
    sky: ['#060914', '#1c2636'], fog: '#151b28', fogNear: 60, fogFar: 160,
    hemiSky: '#fff4dc', hemiGround: '#8a7a60', hemiIntensity: 1.9, sun: '#fff0cc', sunIntensity: 1.8, sunDir: [0.2, 1, 0.35],
    tileTop: ['#e2dac8', '#c5cbd2', '#c4484a', '#e8e0d0'], tileSide: '#5a5048', tileEdge: '#2a2420', lava: '#ff5a1f', gridLine: '#c8bfae', accent: '#ff4f3a',
  },
  rooftop: {
    sky: ['#081430', '#6a3a4c'], fog: '#2a2236', fogNear: 70, fogFar: 240,
    hemiSky: '#c4dcff', hemiGround: '#3a3040', hemiIntensity: 1.8, sun: '#dce8ff', sunIntensity: 1.7, sunDir: [-0.4, 0.9, -0.3],
    tileTop: ['#4e5662', '#636e7c', '#7e8a98', '#45a8a0'], tileSide: '#262c35', tileEdge: '#0e1116', lava: '#ff5a1f', gridLine: '#606b78', accent: '#3ff0d8',
  },
  stage: {
    sky: ['#05030f', '#ff2a8a'], fog: '#3a0f30', fogNear: 75, fogFar: 240,
    hemiSky: '#ffdcf0', hemiGround: '#2a2040', hemiIntensity: 1.85, sun: '#ffffff', sunIntensity: 1.8, sunDir: [0.3, 1, 0.5],
    tileTop: ['#3e3854', '#5a527c', '#7c72a8', '#f0bf45'], tileSide: '#1a1626', tileEdge: '#ff2a8a', lava: '#ff5a1f', gridLine: '#4c4668', accent: '#ff2a8a',
  },
};
export function themeStyle(theme) {
  const s = STY[theme] || STY.desert;
  return { ...s, sky: [...s.sky], sunDir: [...s.sunDir], tileTop: [...s.tileTop] };
}

// ── 小工具 ────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
// 棋盤矩形外 m 公尺以上
const outside = (x, z, m) => x < -m || x > 24 + m || z < -m || z > 24 + m;
// 在棋盤外 [minM, maxM] 的方環內撒點；ok(x,z) 可排除區域
function scatter(R, n, minM, maxM, fn, ok = () => true) {
  let made = 0, tries = 0;
  while (made < n && tries < n * 60) {
    tries++;
    const x = lerp(-maxM, 24 + maxM, R()), z = lerp(-maxM, 24 + maxM, R());
    if (!outside(x, z, minM) || !ok(x, z)) continue;
    fn(x, z, made++);
  }
}

// 合併器：依材質收集幾何，最後每種材質輸出一個網格（＋一個描邊網格）
class Batch {
  constructor() { this.b = new Map(); this.gc = new Map(); }
  geo(key, mk) { let g = this.gc.get(key); if (!g) { g = mk(); this.gc.set(key, g); } return g; }
  add(geo, color, x, y, z, o = {}) {
    const ol = o.ol !== false && !o.flat && !o.mat;
    const key = o.mat ? 'M' + o.mat.uuid : JSON.stringify([o.flat ? 'f' : 't', color, o.emi || 0, o.ei || 1, o.op ?? 1, o.ds ? 1 : 0, ol, o.recv ? 1 : 0]);
    let bk = this.b.get(key);
    if (!bk) { bk = { color, o, ol, list: [] }; this.b.set(key, bk); }
    const e = new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    const s = o.s ?? 1;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(o.sx ?? s, o.sy ?? s, o.sz ?? s));
    bk.list.push([geo, m]);
  }
  box(w, h, d, c, x, y, z, o = {}) {
    const r = o.r ?? ((o.ol === false || o.flat || o.mat) ? 0 : Math.min(w, h, d) * 0.12);
    const g = this.geo(`b${w},${h},${d},${r}`, () => r > 0 ? roundedBoxGeo(w, h, d, r) : new THREE.BoxGeometry(w, h, d));
    this.add(g, c, x, y, z, o);
  }
  cyl(rt, rb, h, c, x, y, z, o = {}) { const sg = o.seg || 12; this.add(this.geo(`c${rt},${rb},${h},${sg}`, () => new THREE.CylinderGeometry(rt, rb, h, sg)), c, x, y, z, o); }
  cone(r, h, c, x, y, z, o = {}) { const sg = o.seg || 12; this.add(this.geo(`k${r},${h},${sg}`, () => new THREE.ConeGeometry(r, h, sg)), c, x, y, z, o); }
  sph(r, c, x, y, z, o = {}) { const sg = o.seg || 12; this.add(this.geo(`s${r},${sg}`, () => new THREE.SphereGeometry(r, sg, Math.max(4, Math.round(sg * 0.7)))), c, x, y, z, o); }
  cap(r, len, c, x, y, z, o = {}) { this.add(this.geo(`p${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 8)), c, x, y, z, o); }
  tor(r, t, c, x, y, z, o = {}) { const arc = o.arc ?? Math.PI * 2; this.add(this.geo(`t${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 6, o.seg || 16, arc)), c, x, y, z, o); }
  // 水平貼片（地面標線），y 為貼片高度
  flatQuad(w, d, c, x, y, z, o = {}) { this.add(this.geo('q', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), c, x, y, z, { ol: false, ...o, sx: w, sz: d }); }
  disc(r, c, x, y, z, o = {}) { const sg = o.seg || 20; this.add(this.geo(`d${sg}`, () => new THREE.CircleGeometry(1, sg).rotateX(-Math.PI / 2)), c, x, y, z, { ol: false, ...o, sx: r, sz: r }); }
  ring(r0, r1, c, x, y, z, o = {}) { this.add(this.geo(`r${r0},${r1}`, () => new THREE.RingGeometry(r0, r1, 32).rotateX(-Math.PI / 2)), c, x, y, z, { ol: false, ...o }); }
  // 局部座標系（繞 Y 轉 ry）；回傳同樣介面的代理
  at(x0, y0, z0, ry = 0) {
    const cs = Math.cos(ry), sn = Math.sin(ry), self = this;
    const tr = (fn) => (...a) => {
      // 最後三個數字參數之前是尺寸，位置為 x,y,z、選項 o
      const n = a.length; let o = a[n - 1], k = n - 1;
      if (typeof o !== 'object') { o = {}; k = n; }
      const lx = a[k - 3], ly = a[k - 2], lz = a[k - 1];
      const wx = x0 + lx * cs + lz * sn, wz = z0 - lx * sn + lz * cs;
      const args = a.slice(0, k - 3);
      return self[fn](...args, wx, y0 + ly, wz, { ...o, ry: (o.ry || 0) + ry });
    };
    return { box: tr('box'), cyl: tr('cyl'), cone: tr('cone'), sph: tr('sph'), cap: tr('cap'), tor: tr('tor'), flatQuad: tr('flatQuad'), disc: tr('disc') };
  }
  build(parent) {
    for (const bk of this.b.values()) {
      const geo = merge(bk.list);
      const o = bk.o;
      let mat = o.mat;
      if (!mat) {
        if (o.flat) mat = flat(bk.color, { transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : undefined });
        else mat = toon(bk.color, o.emi ? { emissive: o.emi, emissiveIntensity: o.ei || 1 } : ((o.op ?? 1) < 1 ? { transparent: true, opacity: o.op } : {}));
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = false; mesh.receiveShadow = !!o.recv;
      if (bk.ol) { const ol = new THREE.Mesh(geo, outlineMat()); ol.name = 'outline'; ol.raycast = () => {}; mesh.add(ol); }
      mesh.raycast = () => {};
      parent.add(mesh);
    }
    this.b.clear();
  }
}
function merge(list) {
  const parts = []; let n = 0;
  for (const [g, m] of list) {
    const c = g.index ? g.toNonIndexed() : g.clone();
    c.applyMatrix4(m); parts.push(c); n += c.attributes.position.count;
  }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let off = 0;
  for (const c of parts) {
    pos.set(c.attributes.position.array, off * 3);
    if (c.attributes.normal) nor.set(c.attributes.normal.array, off * 3);
    off += c.attributes.position.count; c.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

// 圓點貼圖（點雲用）
let _dotTex = null;
function dotTex() {
  if (_dotTex) return _dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  _dotTex = new THREE.CanvasTexture(c);
  return _dotTex;
}
// 點雲：pts=[x,y,z,...]，cols=[r,g,b,...]（0..1）
function dots(pts, cols, size, o = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.PointsMaterial({ size, map: dotTex(), vertexColors: true, sizeAttenuation: true, transparent: true, opacity: o.op ?? 1, depthWrite: false, fog: o.fog !== false, alphaTest: 0.02 });
  if (o.add) m.blending = THREE.AdditiveBlending;
  const p = new THREE.Points(g, m); p.raycast = () => {};
  return p;
}
const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
// 自有（可動畫）的不受光材質
const ownFlat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: !!o.transparent || o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? !(o.transparent || o.opacity != null), side: o.ds ? THREE.DoubleSide : THREE.FrontSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: o.fog !== false });

// 文字牌：放到 parent，位置/朝向（ry）
function sign(parent, text, w, x, y, z, ry = 0, o = {}) {
  const m = textPlane(text, w, o);
  m.position.set(x, y, z); m.rotation.y = ry;
  if (o.rx) { m.rotation.order = 'YXZ'; m.rotation.x = o.rx; }
  m.raycast = () => {};
  parent.add(m);
  return m;
}
// 平躺在地上的文字（從 +z 方向讀）
function floorText(parent, text, w, x, y, z, rz = 0, o = {}) {
  const m = textPlane(text, w, o);
  m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; m.rotation.y = rz;
  m.position.set(x, y, z); m.raycast = () => {}; m.renderOrder = 1;
  parent.add(m); return m;
}

// ── 地塊側面 ─────────────────────────────────────────
function cell(rows, x, z) { return (x < 0 || z < 0 || x > 11 || z > 11) ? null : rows[z][x]; }
function topOf(c) { if (c == null) return GY; if (c === '#') return -0.7; if (c === 'L') return -0.3; return +c * TH; }
// 回傳所有外露側面：{x,z,dx,dz,h,y0,y1,fx,fz}；fx/fz 為側面中心（平面上）
function faces(rows, pred = () => true) {
  const out = [];
  for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) {
    const c = rows[z][x];
    if (!/[1-3]/.test(c) || !pred(x, z, +c)) continue;
    const top = +c * TH;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nt = topOf(cell(rows, x + dx, z + dz));
      if (nt >= top - 1e-3) continue;
      out.push({ x, z, dx, dz, h: +c, y0: Math.max(nt, -0.6), y1: top, fx: dx ? x * 2 + 1 + dx : x * 2 + 1, fz: dz ? z * 2 + 1 + dz : z * 2 + 1 });
    }
  }
  return out;
}
// 側面上的薄板：along=沿面偏移（世界軸 +z 或 +x），yc 中心高，w 寬，h 高，off 離面距離，t 厚
function fbox(b, f, c, along, yc, w, h, off = 0.045, t = 0.015, o = {}) {
  if (f.dx) { const p = { ol: false, ...o }; if (p.rz) { p.rx = p.rz; delete p.rz; } b.box(t, h, w, c, f.fx + f.dx * off, yc, f.fz + along, p); }
  else b.box(w, h, t, c, f.fx + along, yc, f.fz + f.dz * off, { ol: false, ...o });
}
function fdisc(b, f, c, along, yc, r, off = 0.045, t = 0.015, o = {}) {
  if (f.dx) b.cyl(r, r, t, c, f.fx + f.dx * off, yc, f.fz + along, { ol: false, seg: 18, ...o, rz: Math.PI / 2 });
  else b.cyl(r, r, t, c, f.fx + along, yc, f.fz + f.dz * off, { ol: false, seg: 18, ...o, rx: Math.PI / 2 });
}
// 整面底板
function fpanel(b, f, c, o = {}) {
  const y0 = f.y0, y1 = f.y1 - 0.025;
  fbox(b, f, c, 0, (y0 + y1) / 2, 2, y1 - y0, 0.02, 0.03, o);
}
function ftext(parent, f, text, along, yc, w, o = {}, off = 0.056) {
  const ry = f.dx ? (f.dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (f.dz > 0 ? 0 : Math.PI);
  const x = f.fx + f.dx * off + (f.dx ? 0 : along), z = f.fz + f.dz * off + (f.dx ? along : 0);
  return sign(parent, text, w, x, yc, z, ry, o);
}

// 棋盤外的地面（中間挖空棋盤）
function groundRing(b, color, ext = 150, o = {}) {
  const c = 12, E = ext;
  b.flatQuad(E * 2, E - 12, color, c, GY, (-E + c + 0) / 2 + 0 - 0, { recv: true, ...o });
  b.flatQuad(E * 2, E - 12, color, c, GY, 24 + (E - 12) / 2, { recv: true, ...o });
  b.flatQuad(E - 12, 24, color, -(E - 12) / 2, GY, 12, { recv: true, ...o });
  b.flatQuad(E - 12, 24, color, 24 + (E - 12) / 2, GY, 12, { recv: true, ...o });
}

// 共用小物件
function lampPost(b, x, z, h, ry, head = '#e9e2c8', pole = '#3a3d44') {
  b.cyl(0.12, 0.18, h, pole, x, h / 2, z, { seg: 8 });
  const L = b.at(x, h, z, ry);
  L.box(1.6, 0.12, 0.14, pole, 0.8, 0, 0);
  L.box(0.8, 0.22, 0.5, pole, 1.5, -0.1, 0);
  L.box(0.6, 0.06, 0.38, head, 1.5, -0.24, 0, { flat: true });
}
function car(b, x, z, ry, color, o = {}) {
  const L = b.at(x, 0, z, ry);
  L.box(4.2, 0.75, 1.9, color, 0, 0.65, 0);
  L.box(2.3, 0.65, 1.7, o.glass || '#2c3a4c', -0.2, 1.3, 0);
  L.box(2.0, 0.08, 1.75, color, -0.2, 1.66, 0, { ol: false });
  for (const [ax, az] of [[-1.35, -0.95], [1.35, -0.95], [-1.35, 0.95], [1.35, 0.95]]) L.cyl(0.38, 0.38, 0.28, '#1c1c20', ax, 0.38, az, { rx: Math.PI / 2, seg: 10 });
  const hl = o.lightMat ? { mat: o.lightMat } : { flat: true };
  L.box(0.05, 0.16, 0.4, '#fff4c0', 2.12, 0.78, -0.6, hl); L.box(0.05, 0.16, 0.4, '#fff4c0', 2.12, 0.78, 0.6, hl);
  L.box(0.05, 0.14, 0.4, '#e0302a', -2.12, 0.78, -0.6, hl); L.box(0.05, 0.14, 0.4, '#e0302a', -2.12, 0.78, 0.6, hl);
  // 輪框、後照鏡、門縫
  for (const [ax, az] of [[-1.35, -1.1], [1.35, -1.1], [-1.35, 1.1], [1.35, 1.1]]) L.cyl(0.18, 0.18, 0.02, '#c9ccd1', ax, 0.38, az, { rx: Math.PI / 2, seg: 8, ol: false });
  L.box(0.12, 0.12, 0.2, color, 0.85, 1.12, -1.0, { ol: false }); L.box(0.12, 0.12, 0.2, color, 0.85, 1.12, 1.0, { ol: false });
  L.box(0.03, 0.6, 1.92, '#1b1226', -0.15, 0.7, 0, { ol: false, r: 0, sz: 1.0 });
}

// 煙柱：n 團煙從 (x,y,z) 往上飄，靠縮放淡出
function smoke(root, anims, x, y, z, o = {}) {
  const mat = new THREE.MeshToonMaterial({ color: o.color || '#cfc4b8', gradientMap: null, transparent: true, opacity: o.op ?? 0.55, depthWrite: false });
  const geo = new THREE.SphereGeometry(1, 10, 7);
  const n = o.n || 5, rise = o.rise || 6, size = o.size || 1, sp = o.speed || 0.25, dx = o.dx ?? 0.6, dz = o.dz ?? 0.2;
  const ps = [];
  for (let k = 0; k < n; k++) { const m = new THREE.Mesh(geo, mat); m.raycast = () => {}; root.add(m); ps.push(m); }
  anims.push(t => ps.forEach((m, k) => {
    const p = (t * sp + k / n) % 1;
    m.position.set(x + dx * p * rise * 0.4 + Math.sin(p * 6 + k) * 0.3 * size, y + p * rise, z + dz * p * rise * 0.4);
    m.scale.setScalar(size * (0.45 + p * 1.5) * (p > 0.85 ? (1 - p) / 0.15 : 1));
  }));
  return mat;
}

// ── 動態點綴工具（全部是 t 的純函數，重複呼叫無副作用）────────
// InstancedMesh 用的描邊（套 instanceMatrix；與 kit 描邊共用 uniform）
let _iol = null;
export function instOutline() {
  if (_iol) return _iol;
  const base = outlineMat();
  _iol = new THREE.ShaderMaterial({
    uniforms: { uColor: base.uniforms.uColor, uThick: base.uniforms.uThick },
    vertexShader: `
      uniform float uThick;
      void main() {
        mat4 im = modelViewMatrix * instanceMatrix;
        vec4 mv = im * vec4(position, 1.0);
        vec3 n = normalize(mat3(im) * normal);
        float k = uThick * clamp(-mv.z / 16.0, 0.6, 2.2);
        mv.xyz += n * k;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
  return _iol;
}
// 會動的實例群：set(i, x,y,z, rx,ry,rz, sx,sy,sz) 後呼叫 done()
function inst(root, geo, mat, n, o = {}) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.raycast = () => {}; m.castShadow = false; m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(m);
  let ol = null;
  if (o.ol) { ol = new THREE.InstancedMesh(geo, instOutline(), n); ol.instanceMatrix = m.instanceMatrix; ol.raycast = () => {}; ol.frustumCulled = false; root.add(ol); }
  if (o.colors) { const c = new THREE.Color(); for (let i = 0; i < n; i++) m.setColorAt(i, c.set(o.colors[i % o.colors.length])); }
  const d = new THREE.Object3D(); d.rotation.order = o.order || 'YXZ';
  return {
    mesh: m,
    set(i, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { d.position.set(x, y, z); d.rotation.set(rx, ry, rz); d.scale.set(sx, sy, sz); d.updateMatrix(); m.setMatrixAt(i, d.matrix); },
    done() { m.instanceMatrix.needsUpdate = true; },
  };
}
const ownToon = (color, o = {}) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: o.grad === false ? null : gradientMap(), transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null, side: o.ds ? THREE.DoubleSide : THREE.FrontSide }); return m; };
const fract = (v) => v - Math.floor(v);

// 遠景剪影環：type = 'mesa' | 'hill' | 'city' | 'pine'；顏色往霧色偏移做出空氣遠近
function ridge(ctx, r, n, hMin, hMax, color, type, o = {}) {
  const { b, R, st } = ctx;
  const c = new THREE.Color(color).lerp(new THREE.Color(st.fog), o.fade ?? 0.35).getStyle();
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = lerp(a0, a1, (i + R() * 0.6) / n), rr = r * (0.92 + R() * 0.16), h = lerp(hMin, hMax, R());
    const x = 12 + Math.cos(a) * rr, z = 12 + Math.sin(a) * rr, w = (rr * (a1 - a0) / n) * (1.1 + R() * 0.6);
    if (type === 'mesa') { b.cyl(w * 0.42, w * 0.55, h, c, x, h / 2 + GY, z, { seg: 6, ol: false, ry: R() * 3 }); b.cyl(w * 0.43, w * 0.43, h * 0.06, o.cap || c, x, h + GY, z, { seg: 6, ol: false }); }
    else if (type === 'hill') b.sph(w * 0.6, c, x, GY - w * 0.15, z, { sy: h / (w * 0.6), seg: 9, ol: false });
    else if (type === 'pine') { b.cone(w * 0.32, h, c, x, h / 2 + GY, z, { seg: 6, ol: false }); }
    else { b.box(w * 0.8, h, w * 0.6, c, x, h / 2 + GY, z, { ry: -a, ol: false, r: 0 }); if (o.lights) o.lights(x, h, z, w, a); }
  }
}
// 飄移雲：幾顆球合成一朵，實例化沿 +x 漂移、繞回
function clouds(ctx, n, color, o = {}) {
  const { root, anims, R } = ctx;
  const parts = [];
  for (const [x, y, z, s] of [[0, 0, 0, 1], [1.3, -0.2, 0.2, 0.75], [-1.3, -0.25, -0.1, 0.8], [0.5, 0.45, -0.3, 0.7], [-0.6, 0.35, 0.4, 0.6]]) { const g = new THREE.SphereGeometry(s * 2.2, 10, 7); g.translate(x * 2.2, y * 2.2, z * 2.2); parts.push([g, new THREE.Matrix4()]); }
  const geo = merge(parts); geo.scale(1, 0.62, 1);
  const I = inst(root, geo, ownToon(color, o.op ? { opacity: o.op } : {}), n, { ol: !o.op });
  const C = [];
  for (let i = 0; i < n; i++) C.push({ x: R(), z: lerp(-90, 110, R()), y: (o.y ?? 34) + R() * 12, s: 0.8 + R() * 1.4, sp: 0.6 + R() * 0.8 });
  const span = 280;
  anims.push(t => { C.forEach((c, i) => { const x = -130 + fract(c.x + t * c.sp / span) * span; I.set(i, x, c.y, c.z, 0, 0, 0, c.s * 1.4, c.s, c.s); }); I.done(); });
}
// 盤旋的鳥群（身體＋兩片會拍的翅膀）
function birds(ctx, n, cx, cz, r, y, o = {}) {
  const { root, anims, R } = ctx;
  const col = o.color || '#2a2230';
  const bodyG = new THREE.CapsuleGeometry(0.16, 0.5, 2, 6).rotateX(Math.PI / 2);
  const wingG = new THREE.BoxGeometry(1.0, 0.04, 0.36).translate(0.5, 0, 0);
  const mat = ownToon(col);
  const B = inst(root, bodyG, mat, n, { ol: true }), WL = inst(root, wingG, mat, n), WR = inst(root, wingG, mat, n);
  const P = []; for (let i = 0; i < n; i++) P.push({ ph: R() * 6.28, rr: r * (0.6 + R() * 0.5), yy: y + R() * 4, sp: (o.speed || 0.25) * (0.8 + R() * 0.4), fl: R() * 6 });
  const sc = o.scale || 1;
  anims.push(t => {
    P.forEach((p, i) => {
      const a = p.ph + t * p.sp, x = cx + Math.cos(a) * p.rr, z = cz + Math.sin(a) * p.rr, yy = p.yy + Math.sin(t * 0.7 + p.ph) * 0.8;
      const yaw = -a; // 沿切線（逆時針）飛
      const flap = Math.sin(t * (o.flap || 7) + p.fl) * 0.55 * (Math.sin(t * 0.5 + p.fl) > -0.2 ? 1 : 0.15);
      B.set(i, x, yy, z, 0, yaw, -0.25, sc);
      WL.set(i, x, yy + 0.05, z, 0, yaw, flap - 0.25, sc); WR.set(i, x, yy + 0.05, z, 0, yaw + Math.PI, flap + 0.25, sc);
    });
    B.done(); WL.done(); WR.done();
  });
}
// 揮旗：分段平面頂點波動（文字/圖案用 textTexture）
function waveFlag(ctx, x, y, z, ry, w, h, tex, o = {}) {
  const { root, anims } = ctx;
  const geo = new THREE.PlaneGeometry(w, h, 10, 3); geo.translate(w / 2, 0, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, color: o.tint || 0xffffff });
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.raycast = () => {}; root.add(m);
  const pos = geo.attributes.position, base = pos.array.slice();
  anims.push(t => {
    for (let i = 0; i < pos.count; i++) { const px = base[i * 3]; const k = px / w; pos.array[i * 3 + 2] = Math.sin(px * 2.2 - t * (o.speed || 5)) * 0.22 * k * (o.amp || 1); pos.array[i * 3 + 1] = base[i * 3 + 1] - k * k * 0.12 * (o.droop || 1); }
    pos.needsUpdate = true;
  });
  return m;
}
// 竿上掛布條旗（紋樣畫在 canvas）
function flagTex(draw, w = 128, h = 80) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 螢火蟲 / 火星 / 泡泡：點雲上下飄（模式 'float' 原地晃、'rise' 往上升、'fall' 往下掉）
function motes(ctx, n, area, cols, size, o = {}) {
  const { root, anims, R } = ctx;
  const [x0, x1, y0, y1, z0, z1] = area;
  const pts = [], cc = [], seed = [];
  for (let i = 0; i < n; i++) {
    let x, z, k = 0;
    do { x = lerp(x0, x1, R()); z = lerp(z0, z1, R()); k++; } while (o.out && !outside(x, z, o.out) && k < 30);
    pts.push(x, lerp(y0, y1, R()), z); cc.push(...rgb(cols[i % cols.length])); seed.push(R());
  }
  const p = dots(pts, cc, size, { add: o.add !== false, fog: o.fog });
  root.add(p);
  const a = p.geometry.attributes.position, base = a.array.slice(), H = y1 - y0;
  anims.push(t => {
    for (let i = 0; i < n; i++) {
      const s = seed[i], j = i * 3;
      if (o.mode === 'rise') { a.array[j + 1] = y0 + fract(s + t * (o.speed || 0.1) * (0.6 + s)) * H; a.array[j] = base[j] + Math.sin(t * 2 + s * 20) * 0.15; }
      else if (o.mode === 'fall') { a.array[j + 1] = y1 - fract(s + t * (o.speed || 0.1) * (0.6 + s)) * H; a.array[j] = base[j] + Math.sin(t * 1.3 + s * 20) * 0.6; a.array[j + 2] = base[j + 2] + Math.cos(t * 1.1 + s * 9) * 0.6; }
      else { a.array[j] = base[j] + Math.sin(t * 0.6 + s * 30) * 0.8; a.array[j + 1] = base[j + 1] + Math.sin(t * 0.9 + s * 17) * 0.4; a.array[j + 2] = base[j + 2] + Math.cos(t * 0.5 + s * 11) * 0.8; }
    }
    a.needsUpdate = true;
    if (o.blink) p.material.opacity = 0.55 + 0.45 * Math.sin(t * o.blink);
  });
  return p;
}
// 旋轉體：把 Batch 建的零件做成獨立群組，anim 裡轉
function spinGroup(ctx, x, y, z, build, fn) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const sb = new Batch(); build(sb); sb.build(g);
  ctx.root.add(g); ctx.anims.push(t => fn(g, t));
  return g;
}
// 充氣跳舞人：一節節套疊的圓筒，相位遞延做出甩動；雙臂亂揮
function tubeMan(ctx, x, z, color, arm) {
  const { root, b, anims } = ctx;
  b.box(0.9, 0.5, 0.9, '#3a3d44', x, 0.25, z); b.cyl(0.36, 0.4, 0.12, '#5a5e66', x, 0.56, z, { seg: 12 });
  const segG = new THREE.CylinderGeometry(0.3, 0.32, 0.62, 10).translate(0, 0.31, 0);
  const armG = new THREE.CylinderGeometry(0.13, 0.15, 0.7, 8).translate(0, 0.35, 0);
  const segs = [];
  let parent = new THREE.Group(); parent.position.set(x, 0.6, z); root.add(parent);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); g.position.y = i ? 0.6 : 0; parent.add(g);
    const m = new THREE.Mesh(segG, toon(i === 3 ? arm : color)); m.raycast = () => {};
    const ol = new THREE.Mesh(segG, outlineMat()); ol.raycast = () => {}; m.add(ol); g.add(m);
    segs.push(g); parent = g;
  }
  const head = segs[5];
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 8), toon(color)); face.position.y = 0.66; face.raycast = () => {}; head.add(face);
  const fo = new THREE.Mesh(face.geometry, outlineMat()); fo.raycast = () => {}; face.add(fo);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), flat('#ffffff')); e.position.set(s * 0.12, 0.08, 0.26); e.raycast = () => {}; face.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), flat('#1b1226')); p.position.set(s * 0.12, 0.08, 0.34); p.raycast = () => {}; face.add(p); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 10, Math.PI), flat('#1b1226')); mouth.position.set(0, -0.06, 0.28); mouth.rotation.z = Math.PI; mouth.raycast = () => {}; face.add(mouth);
  const arms = [-1, 1].map(s => {
    const a = new THREE.Group(); a.position.set(s * 0.28, 0.45, 0); segs[3].add(a);
    const u = new THREE.Mesh(armG, toon(arm)); u.raycast = () => {}; const uo = new THREE.Mesh(armG, outlineMat()); uo.raycast = () => {}; u.add(uo); a.add(u);
    const f = new THREE.Group(); f.position.y = 0.66; a.add(f);
    const l = new THREE.Mesh(armG, toon(arm)); l.raycast = () => {}; l.scale.set(0.85, 0.9, 0.85); const lo = new THREE.Mesh(armG, outlineMat()); lo.raycast = () => {}; l.add(lo); f.add(l);
    return [a, f, s];
  });
  const ph = x * 0.37 + z * 0.11;
  anims.push(t => {
    const T = t + ph, flop = Math.max(0, Math.sin(T * 0.45)) ** 12; // 偶爾洩氣彎腰
    segs.forEach((g, i) => { const k = 0.12 + i * 0.05; g.rotation.z = Math.sin(T * 3.1 - i * 0.7) * k + flop * (i > 1 ? 0.45 : 0); g.rotation.x = Math.cos(T * 2.3 - i * 0.6) * k * 0.7; });
    arms.forEach(([a, f, s], i) => { a.rotation.z = s * (1.6 + Math.sin(T * 5.3 + i * 2) * 0.9); a.rotation.x = Math.sin(T * 4.1 + i) * 0.6; f.rotation.z = s * Math.sin(T * 6.7 + i * 1.3) * 1.1; });
  });
}
// 棋盤頂面貼花（≤0.02 m 平貼）：裂縫、污漬、主題小碎屑；避開 # 與熔岩格
function boardDecals(ctx, o) {
  const { b, R, rows } = ctx;
  const y = (x, z) => +rows[z][x] * TH + 0.013;
  const ok = (x, z) => /[0-3]/.test(rows[z][x]);
  const crack = (cx, cy, cz, c, op) => {
    let x = cx, z = cz, a = R() * 6.28;
    const n = 3 + ((R() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const len = 0.25 + R() * 0.35, nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len;
      b.flatQuad(len + 0.04, 0.045, c, (x + nx) / 2, cy, (z + nz) / 2, { flat: true, op, ry: -a });
      if (R() < 0.35) { const a2 = a + (R() < 0.5 ? 0.9 : -0.9), l2 = 0.18 + R() * 0.2; b.flatQuad(l2, 0.035, c, nx + Math.cos(a2) * l2 / 2, cy, nz + Math.sin(a2) * l2 / 2, { flat: true, op, ry: -a2 }); }
      x = nx; z = nz; a += (R() - 0.5) * 1.4;
    }
  };
  for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) {
    if (!ok(x, z)) continue;
    const cx = W(x) + (R() - 0.5) * 1.2, cz = W(z) + (R() - 0.5) * 1.2, cy = y(x, z);
    const r = R();
    if (r < (o.crack ?? 0.12)) crack(cx, cy, cz, o.crackC || '#2a1a12', o.crackOp ?? 0.35);
    else if (r < (o.crack ?? 0.12) + (o.stain ?? 0.1)) b.disc(0.3 + R() * 0.45, o.stainC || '#3a2416', cx, cy - 0.001, cz, { flat: true, op: o.stainOp ?? 0.14, sz: 0.6 + R() * 0.4, seg: 12 });
    else if (o.bits && r < (o.crack ?? 0.12) + (o.stain ?? 0.1) + (o.bitP ?? 0.15)) o.bits(cx, cy, cz, x, z);
  }
}

// ── 入口 ──────────────────────────────────────────────
export function buildScenery(level, rows) {
  const root = new THREE.Group();
  root.name = 'scenery';
  const b = new Batch();
  const anims = [];
  const st = themeStyle(level.theme);
  const R = rng(level.n * 7919 + 13);
  const ctx = { root, b, anims, st, R, rows, level };
  const fn = THEMES[level.theme] || THEMES.desert;
  fn(ctx);
  const ex = EXTRA[level.theme];
  if (ex) ex(ctx);
  b.build(root);
  // 單一入口：view 每幀呼叫 root.userData.anim(t, dt)；子物件不另掛 anim，避免被走訪時重複執行
  root.userData.anim = (t) => { if (t > 1e5) t /= 1000; for (const f of anims) f(t); };
  root.userData.anim(0); // 建構當下就擺好初始姿勢（預覽頁不會跑動畫）
  return root;
}

// ── 各主題 ────────────────────────────────────────────
const THEMES = {
  // 1. 66 號公路：公路、汽車旅館與霓虹招牌、仙人掌、台地、東北角墜毀的漢堡外送母艦
  desert({ root, b, anims, R, rows }) {
    groundRing(b, '#d9a066');
    // 公路（西側南北向）
    b.flatQuad(7, 300, '#45403c', -7.5, GY + 0.01, 12, { recv: true });
    b.flatQuad(0.18, 300, '#f2efe6', -10.7, GY + 0.02, 12); b.flatQuad(0.18, 300, '#f2efe6', -4.3, GY + 0.02, 12);
    for (let z = -110; z < 140; z += 5) b.flatQuad(0.22, 2.4, '#ffcf3a', -7.5, GY + 0.02, z);
    for (const z of [3, 21]) { b.box(3.0, 0.02, 3.0, '#f4f1e8', -7.5, GY + 0.025, z, { flat: true, r: 0 }); floorText(root, 'ROUTE\n66', 2.6, -7.5, GY + 0.05, z, -Math.PI / 2, { color: '#1b1226', size: 64 }); }
    for (let z = -60; z < 90; z += 15) { b.cyl(0.13, 0.16, 7.5, '#6b4a33', -12.0, 3.75, z, { seg: 7 }); b.box(0.16, 0.16, 2.2, '#6b4a33', -12.0, 7.0, z); }
    // 汽車旅館（公路西側，門朝東）
    const mx = -17;
    b.box(6, 3.2, 34, '#f3d6a4', mx, 1.6, 10);
    b.box(7.8, 0.35, 35, '#2fa39a', mx + 0.7, 3.35, 10);
    b.box(6.2, 0.5, 34.2, '#e8473b', mx, 2.95, 10, { ol: false });
    for (let i = 0; i < 10; i++) {
      const z = -5 + i * 3.4;
      b.box(0.06, 2.0, 1.0, i % 2 ? '#e05a47' : '#2fa39a', mx + 3.03, 1.0, z, { ol: false });
      b.box(0.06, 0.9, 1.1, '#9fd6e6', mx + 3.03, 1.6, z + 1.4, { ol: false });
      b.cyl(0.09, 0.09, 3.2, '#f5f0e6', mx + 4.2, 1.6, z + 2.1, { seg: 6 });
      sign(root, String(101 + i), 0.5, mx + 3.07, 2.2, z, Math.PI / 2, { color: '#fff', size: 48 });
    }
    // 汽車旅館招牌（高霓虹）
    const sx = -12.6, sz = -2.5, sry = Math.PI / 2 - 0.55;
    b.cyl(0.28, 0.32, 9, '#2fa39a', sx, 4.5, sz, { seg: 10 });
    const S = b.at(sx, 0, sz, sry);
    S.box(6.6, 2.6, 0.5, '#e8473b', 0, 9.2, 0);
    S.box(4.6, 1.3, 0.45, '#1b1226', 0.6, 7.1, 0);
    S.cone(0.9, 1.6, '#ffcf3a', -2.4, 7.1, 0, { rz: Math.PI / 2, seg: 3 });
    // 跑馬燈泡：三組輪流亮
    const bulbs = [0, 1, 2].map(() => ownFlat('#fff6c8'));
    for (let k = 0; k < 9; k++) { S.sph(0.14, null, -3.0 + k * 0.75, 10.65, 0.26, { mat: bulbs[k % 3], seg: 6 }); S.sph(0.12, null, -3.0 + k * 0.75, 7.85, 0.26, { mat: bulbs[(k + 1) % 3], seg: 6 }); }
    anims.push(t => { const on = Math.floor(t * 6) % 3; bulbs.forEach((m, i) => m.color.set(i === on ? '#fffbe0' : '#8a6a3a')); });
    const fr = sry, nx = Math.sin(fr) * 0.27, nz = Math.cos(fr) * 0.27;
    sign(root, 'MOTEL', 5.6, sx + nx, 9.2, sz + nz, fr, { color: '#29f0de', stroke: '#0d4a48', size: 80 });
    const vac = sign(root, 'VACANCY', 3.8, sx + nx + Math.cos(fr) * 0.6, 7.1, sz + nz - Math.sin(fr) * 0.6, fr, { color: '#ff3a8c', stroke: '#5a0a2a', size: 64 });
    anims.push(t => { vac.material.opacity = (Math.sin(t * 9) + Math.sin(t * 23) > 1.3) ? 0.15 : 1; });
    // 看板（北側）
    b.cyl(0.18, 0.18, 6.5, '#6b4a33', 5, 3.25, -9, { seg: 6 }); b.cyl(0.18, 0.18, 6.5, '#6b4a33', 13, 3.25, -9, { seg: 6 });
    b.box(10.5, 4.2, 0.4, '#e8473b', 9, 7.6, -9);
    sign(root, '7-DAY FREE TRIAL!\n*auto-renews forever', 9.6, 9, 7.6, -8.78, 0, { color: '#fff7e0', stroke: '#6a1010', size: 64 });
    // 台地（東南、西南、東北遠側）
    const mesas = [[44, 42, 9, 13], [52, 20, 6, 9], [20, 48, 8, 11], [-14, 46, 10, 15], [-32, -18, 8, 11], [36, -36, 11, 17], [64, -6, 12, 18], [-6, -40, 12, 16]];
    for (const [x, z, r, h] of mesas) {
      b.cyl(r * 0.82, r, h * 0.55, '#c0603c', x, h * 0.275, z, { seg: 7 });
      b.cyl(r * 0.84, r * 0.85, h * 0.07, '#e8925a', x, h * 0.58, z, { seg: 7, ol: false });
      b.cyl(r * 0.6, r * 0.8, h * 0.45, '#b4523a', x, h * 0.83, z, { seg: 7 });
      b.cyl(r * 0.62, r * 0.62, 0.6, '#d9784a', x, h * 1.05, z, { seg: 7, ol: false });
    }
    // 仙人掌、岩石、風滾草
    const free = (x, z) => (x < -21 || x > -3) && !(x > 26 && x < 46 && z > -20 && z < 2);
    scatter(R, 34, 1.8, 14, (x, z) => {
      const s = 0.8 + R() * 0.7, g = '#3f8f3a';
      b.cap(0.32 * s, 2.4 * s, g, x, 1.5 * s, z);
      if (R() < 0.85) { b.cap(0.22 * s, 0.7 * s, g, x + 0.55 * s, 1.3 * s, z, { rz: Math.PI / 2 }); b.cap(0.2 * s, 0.9 * s, g, x + 0.95 * s, 1.85 * s, z); }
      if (R() < 0.6) { b.cap(0.2 * s, 0.6 * s, g, x - 0.5 * s, 1.0 * s, z, { rz: Math.PI / 2 }); b.cap(0.18 * s, 0.7 * s, g, x - 0.85 * s, 1.4 * s, z); }
      b.sph(0.13 * s, '#ff6fa8', x, 2.95 * s, z, { ol: false, seg: 6 });
    }, free);
    scatter(R, 18, 1.5, 22, (x, z) => { const s = 0.5 + R() * 1.3; b.sph(s, '#b9764e', x, s * 0.3, z, { seg: 5, sy: 0.6, ry: R() * 3 }); }, free);
    scatter(R, 8, 1.5, 14, (x, z) => b.sph(0.45, '#a8794a', x, 0.42, z, { seg: 5, ol: false }), free);
    // 路標「外星人出沒」、牛頭骨
    for (const [x, z] of [[-2.6, -2.2], [26.8, 27]]) { b.cyl(0.06, 0.06, 2.6, '#9a9da2', x, 1.3, z, { seg: 5 }); b.box(1.0, 1.0, 0.06, '#ffcf3a', x, 2.6, z, { ry: 0.785, rz: 0.785 }); sign(root, 'ALIEN\nXING', 0.75, x + 0.03, 2.6, z + 0.04, 0.785, { color: '#1b1226', size: 48 }); }
    for (const [x, z] of [[-2, 8], [27, 14], [9, 26.5], [14, -2.5]]) { b.sph(0.32, '#f4efe2', x, 0.2, z, { sx: 0.8, sz: 1.2, seg: 8 }); b.cone(0.07, 0.5, '#f4efe2', x - 0.35, 0.35, z - 0.2, { rz: 1.1, seg: 5, ol: false }); b.cone(0.07, 0.5, '#f4efe2', x + 0.35, 0.35, z - 0.2, { rz: -1.1, seg: 5, ol: false }); }
    // 棋盤上的淡焦痕
    for (const [x, z, r] of [[11, 11, 3.0], [15, 14, 1.4]]) b.disc(r, '#3a2416', x, 0.012, z, { flat: true, op: 0.16 });
    // 墜毀母艦（東北，半埋）：漢堡麵包圓頂＋肉排環＋生菜環＋閃燈
    const ux = 37, uz = -9;
    b.disc(13, '#8a5a36', ux, GY + 0.012, uz, { flat: true, seg: 18 });
    for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28; b.sph(1.6 + R(), '#c08452', ux + Math.cos(a) * 11, 0.1, uz + Math.sin(a) * 11, { sy: 0.5, seg: 6 }); }
    b.flatQuad(3.2, 7, '#9a6a42', 27.5, GY + 0.015, 0.5, { ry: 0.8 });
    const ship = new THREE.Group(); ship.position.set(ux, 1.6, uz); ship.rotation.set(-0.18, 0.4, 0.32); root.add(ship);
    const sb = new Batch();
    sb.sph(10, '#c9c5bd', 0, 0, 0, { sy: 0.24, seg: 24 });
    sb.tor(8.6, 1.05, '#7a3e22', 0, 1.3, 0, { rx: Math.PI / 2, seg: 28 });
    sb.tor(9.5, 0.42, '#7cc242', 0, 2.0, 0, { rx: Math.PI / 2, seg: 28, ol: false });
    sb.sph(5.6, '#e3a052', 0, 2.2, 0, { sy: 0.66, seg: 20 });
    for (let i = 0; i < 16; i++) { const a = i * 2.4, rr = 1.6 + (i % 5) * 0.75; sb.sph(0.3, '#fff6d8', Math.cos(a) * rr, 5.7 - rr * 0.36, Math.sin(a) * rr, { sy: 0.5, ol: false, seg: 6 }); }
    const lA = ownFlat('#3dfcd0'), lB = ownFlat('#ff3a8c');
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; sb.sph(0.45, null, Math.cos(a) * 9.9, -0.3, Math.sin(a) * 9.9, { mat: i % 2 ? lA : lB, seg: 6 }); }
    sb.build(ship);
    sign(ship, 'FREE DELIVERY*', 5, 0, 1.3, 9.75, 0, { color: '#ffe14d', stroke: '#5a1a00', size: 64 });
    smoke(root, anims, ux - 3, 3, uz + 2, { n: 6, rise: 9, size: 1.3, speed: 0.18, color: '#5a4a44', op: 0.6 });
    // 散落的巨型薯條與外送箱
    for (let k = 0; k < 14; k++) b.box(0.3, 0.3, 2.2, '#ffcf3a', 26 + R() * 5, 0.15, 1 + R() * 6, { ry: R() * 3, rx: (R() - 0.5) * 0.3 });
    for (const [x, z, r] of [[27.5, 4.5, 0.6], [30.5, 6.5, 0.2], [26.6, 8.5, 1.1]]) b.box(1.5, 1.1, 1.5, '#e8473b', x, 0.5, z, { ry: r, rz: 0.2 });
    anims.push(t => { const k = Math.sin(t * 4) > 0; lA.color.set(k ? '#3dfcd0' : '#1a5a4c'); lB.color.set(k ? '#5a1430' : '#ff3a8c'); });
  },

  // 2. 黑色星期五：量販店門面、鐵捲門、布條、停車格、路燈
  parking(ctx) {
    const { root, b, anims, R, rows } = ctx;
    groundRing(b, '#4c515a');
    // 停車格（棋盤上 h0 與棋盤外）
    const line = (x, z, len) => b.flatQuad(len, 0.14, '#eeeeea', x, 0.012, z);
    for (let z = 1.4; z < 23; z += 2.75) { line(3.5, z, 4.6); line(9.6, z, 4.0); }
    for (let i = 0; i < 7; i++) b.flatQuad(0.28, 1.6, '#ffd23f', 13.1, 0.013, 4.6 + i * 2.2, { ry: 0.7 });
    for (let z = -26; z < 52; z += 2.75) for (const x of [-6, -12.2, -22, -28.2]) if (z < -1.5 || z > 25.5 || x < -3) b.flatQuad(5.2, 0.14, '#e8e8e2', x, GY + 0.012, z);
    // 量販店立面（東側）
    const fx = 29;
    b.box(30, 13, 84, '#ddd6c6', fx + 15, 6.5, 12);
    b.box(0.6, 2.2, 84, '#e8752c', fx - 0.1, 11.2, 12);
    b.box(0.5, 0.5, 84, '#1d4d3a', fx - 0.15, 9.8, 12);
    sign(root, 'MEGA★MART', 16, fx - 0.45, 11.25, 12, -Math.PI / 2, { color: '#14382a', size: 96 });
    // 正門
    b.box(0.3, 4.4, 7, '#1c2c33', fx - 0.12, 2.2, 12, { ol: false });
    for (let i = -1; i <= 1; i++) b.box(0.32, 4.2, 0.12, '#c9ccd1', fx - 0.14, 2.1, 12 + i * 2.3, { ol: false });
    b.box(3, 0.35, 9, '#e8752c', fx - 1.5, 5.0, 12);
    // 鐵捲門
    for (const z of [-14, -6, 2, 22, 30, 38]) {
      b.box(0.25, 4.6, 5, '#9ea4ab', fx - 0.1, 2.3, z);
      for (let y = 0.3; y < 4.5; y += 0.32) b.box(0.08, 0.06, 4.8, '#6c737b', fx - 0.24, y, z, { ol: false });
      b.box(0.1, 0.5, 5.2, '#ffd23f', fx - 0.2, 4.85, z, { ol: false });
    }
    // 布條
    const ban = (txt, z, y, w, bg, fg) => sign(root, txt, w, fx - 0.32, y, z, -Math.PI / 2, { bg, color: fg, size: 72 });
    ban('BLACK FRIDAY', 3.5, 6.2, 8, '#d81f2a', '#ffe14d');
    ban('BLACK FRIDAY', 20.5, 6.2, 8, '#d81f2a', '#ffe14d');
    ban('DOORBUSTERS −90%', 12, 7.0, 8, '#111111', '#ffe14d');
    ban('*while supplies last', 12, 5.95, 5, '#ffe14d', '#111111');
    // 排隊帳篷（門前，低矮）
    for (const [x, z, c] of [[26.4, 6.5, '#e8473b'], [26.6, 9.2, '#2fa39a'], [26.3, 15.8, '#ffcf3a'], [26.5, 18.4, '#7a5cd6']]) b.sph(1.15, c, x, 0, z, { sy: 0.9 });
    for (let i = 0; i < 7; i++) b.cyl(0.18, 0.18, 1.0, '#ffd23f', 25.6, 0.5, -2 + i * 4.3, { seg: 8 });
    // 卸貨月台側面：混凝土＋防撞墊＋警示條
    for (const f of faces(rows)) {
      fpanel(b, f, f.h === 2 ? '#b3b7bd' : '#9da1a8');
      const top = f.y1 - 0.12;
      for (let k = 0; k < 4; k++) fbox(b, f, k % 2 ? '#1b1b1b' : '#ffd23f', -0.75 + k * 0.5, top, 0.5, 0.16);
      if (f.dx === -1 || f.dz) { fbox(b, f, '#1f1f22', -0.5, f.y1 - 0.55, 0.32, 0.5, 0.05, 0.02); fbox(b, f, '#1f1f22', 0.5, f.y1 - 0.55, 0.32, 0.5, 0.05, 0.02); }
    }
    // 停在場外的車
    const colors = ['#e8473b', '#2f7fd8', '#f2f2f2', '#2b2b30', '#ffcf3a', '#3fa35a', '#9aa1a8', '#ff8a3a'];
    for (const x of [-6, -12.2, -22, -28.2]) for (let z = -23; z < 50; z += 2.75) {
      if (R() < 0.4 || (x > -10 && ((z > -3.5 && z < 0) || (z > 10 && z < 14) || (z > 24 && z < 28)))) continue;
      car(b, x, z, (x === -6 || x === -22 ? 0 : Math.PI) + (R() - 0.5) * 0.08, colors[(R() * colors.length) | 0]);
    }
    // 路燈＋地上光暈＋燈桿上的促銷旗
    for (const [x, z, ry] of [[-6.5, -2, 0], [-6.5, 12, 0], [-6.5, 26, 0], [-19, -2, 0], [-19, 12, 0], [-19, 26, 0], [4, -6.5, Math.PI / 2], [16, -6.5, Math.PI / 2], [4, 30.5, -Math.PI / 2], [16, 30.5, -Math.PI / 2]]) {
      lampPost(b, x, z, 9, ry);
      const L = b.at(x, 0, z, ry + Math.PI / 2);
      L.box(0.9, 2.2, 0.04, '#d81f2a', 0.5, 6.2, 0, { ol: false });
      L.box(0.9, 0.3, 0.05, '#ffe14d', 0.5, 6.9, 0, { ol: false });
    }
    // 羽毛旗（棋盤外 2.6 m，≤4 m 高）
    const flags = [];
    for (let k = 0; k < 4; k++) flags.push([2 + k * 6.5, -2.6], [2 + k * 6.5, 26.6]);
    flags.push([-2.6, 4], [-2.6, 20]);
    // 旗面用頂點波動飄動（紅黃兩款共用貼圖）
    const ftex = [['#ffe14d', '#d81f2a'], ['#d81f2a', '#ffe14d']].map(([bg, fg]) => flagTex((x, w, h) => {
      x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.fillRect(0, 0, 10, h);
      x.save(); x.translate(w / 2 + 6, h / 2); x.rotate(-Math.PI / 2); x.font = '900 52px "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SALE!', 0, 0); x.restore();
    }, 64, 240));
    flags.forEach(([x, z], i) => {
      b.cyl(0.04, 0.04, 4.0, '#c9ccd1', x, 2.0, z, { seg: 5, ol: false });
      b.sph(0.07, '#c9ccd1', x, 4.02, z, { seg: 6, ol: false });
      b.cyl(0.18, 0.22, 0.12, '#3a3d44', x, 0.06, z, { seg: 10 });
      waveFlag(ctx, x, 2.35, z, 0.3 + i, 0.8, 3.0, ftex[i % 2], { speed: 4 + (i % 3), amp: 0.8, droop: 0.4 });
    });
    // 購物車回收架
    for (const [x, z] of [[-3.5, -6], [-3.5, 30]]) { b.box(5, 0.08, 0.08, '#c9ccd1', x, 1.0, z - 0.6, { rx: 0 }); b.box(5, 0.08, 0.08, '#c9ccd1', x, 1.0, z + 0.6); b.box(0.08, 1, 1.3, '#e8752c', x + 2.5, 0.5, z); }
    // 遠景：其他大賣場與高速公路標誌
    for (const [x, z, w, h, d, c] of [[-70, -60, 40, 12, 24, '#a9a3b8'], [-80, 40, 30, 10, 30, '#9c97ad'], [60, -80, 50, 14, 20, '#b4a9b8'], [70, 100, 40, 10, 30, '#9c97ad']]) b.box(w, h, d, c, x, h / 2, z, { ol: false });
    b.cyl(0.6, 0.6, 22, '#555a66', -40, 11, -30, { seg: 8 }); b.box(0.8, 5, 12, '#e8473b', -40, 22, -30);
    sign(root, 'OPEN 4AM', 10, -39.55, 22, -30, Math.PI / 2, { color: '#fff4c8', size: 72 });
  },

  // 3. 陽光草坪社區：警衛亭（我方所在 h2）、HOA 大門拱、柵欄、同款粉彩房子
  suburb({ root, b, anims, R, rows }) {
    groundRing(b, '#62c24c');
    // 東側馬路＋人行道＋北側橫街
    b.flatQuad(7, 300, '#4e5058', 31.5, GY + 0.01, 12, { recv: true });
    b.flatQuad(1.6, 300, '#d8d4c8', 27.2, GY + 0.015, 12); b.flatQuad(1.6, 300, '#d8d4c8', 35.8, GY + 0.015, 12);
    for (let z = -100; z < 130; z += 5) b.flatQuad(0.2, 2.4, '#ffd23f', 31.5, GY + 0.02, z);
    b.flatQuad(130, 6, '#4e5058', -38, GY + 0.012, -12);
    // 社區步道（棋盤外西側通到警衛亭）
    b.flatQuad(8, 2.2, '#dcc6a0', -4.5, GY + 0.012, 12);
    // 警衛亭側板
    for (const f of faces(rows)) {
      if (f.h === 1) { // 樓梯
        fpanel(b, f, '#f1e6cb');
        for (let k = 0; k < 4; k++) fbox(b, f, '#c98f5a', 0, f.y0 + 0.1 + k * 0.2, 1.8 - k * 0.4, 0.06);
        continue;
      }
      fpanel(b, f, '#f6eed6');
      for (let y = f.y0 + 0.25; y < f.y1 - 0.1; y += 0.28) fbox(b, f, '#e2d6b8', 0, y, 2, 0.03, 0.04, 0.01);
      fbox(b, f, '#ffffff', 0, f.y1 - 0.08, 2, 0.12);
      if (f.y1 - f.y0 > 1.2) {
        const door = f.dx === 1 && f.z === 5;
        if (door) { fbox(b, f, '#ffffff', 0.9, 0.62, 0.95, 1.3); fbox(b, f, '#7a4a2c', 0.9, 0.6, 0.8, 1.2, 0.05); }
        else { fbox(b, f, '#ffffff', 0, 0.95, 1.1, 0.8); fbox(b, f, '#9ad6ef', 0, 0.95, 0.94, 0.66, 0.05); fbox(b, f, '#ffffff', 0, 0.95, 0.06, 0.66, 0.056, 0.01); }
      }
    }
    for (const f of faces(rows, (x, z, h) => h === 2)) if (f.dx === 1 && f.z === 6) ftext(root, f, 'HOA SECURITY', 0, 1.42, 1.9, { color: '#1b3a6b', size: 56 });
    // 西側露台欄杆（棋盤外，低）
    for (let z = 4.2; z <= 19.9; z += 0.9) b.box(0.08, 0.6, 0.08, '#ffffff', -0.22, 2.0, z, { ol: false });
    b.box(0.12, 0.1, 15.9, '#ffffff', -0.22, 2.32, 12);
    b.box(0.3, 2.4, 15.9, '#f6eed6', -0.2, 0.55, 12, { ol: false });
    // 白色尖樁籬笆
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 0.34), ry = -Math.atan2(z1 - z0, x1 - x0);
      for (let i = 0; i <= n; i++) { const k = i / n; b.box(0.12, 0.85, 0.05, '#ffffff', lerp(x0, x1, k), 0.4, lerp(z0, z1, k), { ry, r: 0.02 }); }
      b.box(len, 0.08, 0.04, '#f2f2f2', (x0 + x1) / 2, 0.6, (z0 + z1) / 2, { ry, ol: false });
    };
    fence(-9, -1.2, 26, -1.2); fence(-9, 25.2, 26, 25.2);
    // HOA 大門拱
    for (const x of [27.2, 35.8]) { b.box(1.3, 5, 1.3, '#b5654a', x, 2.5, 12); b.box(1.6, 0.3, 1.6, '#f2e6d0', x, 5.1, 12); b.sph(0.35, '#fff1b0', x, 5.55, 12, { seg: 8 }); }
    b.box(10, 0.9, 0.5, '#f2e6d0', 31.5, 4.4, 12);
    sign(root, 'SUNNY ACRES HOA', 7.6, 31.5, 4.45, 11.72, Math.PI, { color: '#2d5a3a', size: 64 });
    sign(root, 'SUNNY ACRES HOA', 7.6, 31.5, 4.45, 12.28, 0, { color: '#2d5a3a', size: 64 });
    sign(root, 'NO LOUD MUSIC • NO SKATEBOARDS • NO FUN', 8, 31.5, 3.55, 12.28, 0, { color: '#fff', stroke: '#8a2a2a', size: 40 });
    for (let i = 0; i < 6; i++) b.box(1.0, 0.2, 0.2, i % 2 ? '#ffffff' : '#e8473b', 34.6 - i, 1.1, 12, { ol: false });
    // 同款房子
    const pastel = ['#bfe8d4', '#ffc9d6', '#fff1a8', '#d6c9ff', '#ffd2b0', '#bfe0ff'];
    const roofGeo = b.geo('roof', () => { const s = new THREE.Shape(); s.moveTo(-4.8, 0); s.lineTo(4.8, 0); s.lineTo(0, 2.8); s.lineTo(-4.8, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 8, bevelEnabled: false }); g.translate(0, 0, -4); return g; });
    const house = (x, z, ry, c) => {
      const L = b.at(x, 0, z, ry);
      L.box(9, 4.2, 7.4, c, 0, 2.1, 0);
      b.add(roofGeo, '#8a5a4a', x, 4.2, z, { ry });
      L.box(0.9, 1.8, 0.9, '#a86a52', 2.6, 5.4, -1.5);
      L.box(3.4, 2.4, 0.08, '#ffffff', -2.4, 1.2, 3.72, { ol: false });
      for (let k = 0; k < 4; k++) L.box(3.2, 0.04, 0.09, '#d9d9d9', -2.4, 0.4 + k * 0.55, 3.73, { ol: false });
      L.box(1.1, 2.1, 0.08, '#e8473b', 1.0, 1.05, 3.72, { ol: false });
      L.box(1.3, 1.1, 0.08, '#ffffff', 3.2, 2.4, 3.72, { ol: false }); L.box(1.1, 0.9, 0.09, '#8ccbe6', 3.2, 2.4, 3.73, { ol: false });
      L.flatQuad(3.4, 6, '#c9c4b8', -2.4, GY + 0.01, 6.7);
      L.sph(0.7, '#3f9a3a', -4.6, 0.5, 4.4, { seg: 8 }); L.sph(0.7, '#3f9a3a', 4.4, 0.5, 4.4, { seg: 8 });
      L.box(0.1, 1.1, 0.1, '#5a4a3a', 4.3, 0.55, 8.2, { ol: false }); L.box(0.5, 0.36, 0.3, '#2b2b30', 4.3, 1.2, 8.2);
    };
    let i = 0;
    for (const z of [-20, -6, 8, 22, 36]) house(43, z, -Math.PI / 2, pastel[i++ % 6]);
    for (const x of [-6, 6, 18]) house(x, -9.5, 0, pastel[i++ % 6]);
    for (const x of [-6, 6, 18]) house(x, 33.5, Math.PI, pastel[i++ % 6]);
    for (const z of [3, 21]) house(-15, z, Math.PI / 2, pastel[i++ % 6]);
    // 棒棒糖樹
    for (const [x, z] of [[-6, -2.6], [6, -2.6], [18, -2.6], [-6, 26.6], [6, 26.6], [18, 26.6], [-2.6, 1], [-2.6, 23], [-9, 12.5], [26.6, -6], [26.6, 30]]) { const s = 0.75 + R() * 0.3; b.cyl(0.15, 0.2, 2.2 * s, '#7a5a3a', x, 1.1 * s, z, { seg: 6 }); b.sph(1.3 * s, '#4cae3c', x, 2.8 * s, z, { seg: 10 }); }
    // 草坪小物：庭院小矮人、垃圾桶、腳踏車道標線
    for (const [x, z] of [[2.5, -3.2], [14, -3.4], [10, 27.4], [21, 27.2]]) { b.cone(0.2, 0.45, '#e8473b', x, 0.65, z, { seg: 8 }); b.sph(0.18, '#ffd9b8', x, 0.36, z, { seg: 8 }); b.cyl(0.18, 0.2, 0.3, '#2f7fd8', x, 0.15, z, { seg: 8 }); }
    for (const [x, z] of [[11.5, -4.6], [0, 28.6], [12, 28.6]]) { b.cyl(0.35, 0.3, 1.0, '#3a7a4a', x, 0.5, z, { seg: 10 }); b.cyl(0.38, 0.38, 0.08, '#2a5a38', x, 1.04, z, { seg: 10 }); }
  },

  // 4. 沼澤拖車公園：拖車屋、落羽杉＋鬆蘿、紅鶴、北 RV／南大腳車（h2 地塊就是車頂）
  swamp({ root, b, anims, R, rows }) {
    groundRing(b, '#7c8a4a');
    // 水塘＋睡蓮
    for (const [x, z, r] of [[-12, -10, 9], [36, 30, 11], [-16, 34, 8], [40, -12, 7], [8, 40, 9], [8, -18, 7]]) {
      b.disc(r, '#4f6a3a', x, GY + 0.012, z, { flat: true, seg: 14 });
      b.disc(r * 0.82, '#5f7f4a', x, GY + 0.016, z, { flat: true, seg: 14 });
      for (let k = 0; k < 5; k++) b.disc(0.5, '#86b552', x + (R() - 0.5) * r, GY + 0.02, z + (R() - 0.5) * r, { flat: true, seg: 8 });
    }
    // 泥巴車轍（棋盤外西側進場）
    b.flatQuad(16, 0.6, '#5c4a2c', -8, GY + 0.011, 11); b.flatQuad(16, 0.6, '#5c4a2c', -8, GY + 0.011, 13);
    // 車：北（rows 1–2）露營車、南（rows 9–10）大腳車
    const north = (x, z) => z <= 5;
    for (const f of faces(rows)) {
      const rv = north(f.x, f.z), hood = f.h === 1;
      const body = rv ? '#f1e8d2' : '#d8342c', stripe = rv ? '#c8662e' : '#ffb21f';
      fpanel(b, f, hood ? (rv ? '#c8662e' : '#d8342c') : body);
      const sideways = f.dz !== 0; // 車身長邊
      if (sideways) {
        const along0 = f.fx; // 世界 x
        if (!hood) {
          fbox(b, f, stripe, 0, f.y1 - 0.5, 2, 0.16);
          if (rv) { fbox(b, f, '#2c4a5a', 0, f.y1 - 0.28, 1.2, 0.3); fbox(b, f, '#a8a194', 0, 0.2, 2, 0.12); }
          else { for (let k = 0; k < 3; k++) fbox(b, f, '#ffb21f', -0.6 + k * 0.6, f.y1 - 0.22, 0.42, 0.18, 0.045, 0.015, { rz: 0.5 }); fbox(b, f, '#2a2a2e', 0, 0.12, 2, 0.24); }
        }
        // 輪子
        const wheels = rv ? [9.1, 15.4, 17.0] : [11.0, 12.6, 17.4];
        for (const wx of wheels) if (Math.abs(wx - along0) < 1.0) {
          const r = rv ? 0.62 : 0.86, yc = rv ? 0.32 : 0.56;
          fdisc(b, f, '#17171a', wx - along0, Math.min(yc, f.y1 - r - 0.02), r, 0.04, 0.012);
          fdisc(b, f, rv ? '#c9ccd1' : '#e8e8e8', wx - along0, Math.min(yc, f.y1 - r - 0.02), r * 0.42, 0.052, 0.006);
        }
      } else {
        // 端面：擋風玻璃／水箱罩／車尾
        const front = rv ? f.dx === -1 : f.dx === 1;
        if (front && !hood && f.y0 > 0.5) { fbox(b, f, '#3a6a86', 0, (f.y0 + f.y1) / 2, 1.7, f.y1 - f.y0 - 0.2); fbox(b, f, '#bfe4f4', -0.4, (f.y0 + f.y1) / 2 + 0.1, 0.3, 0.3, 0.052, 0.006); }
        else if (front && hood) { fbox(b, f, '#c9ccd1', 0, 0.42, 1.2, 0.5); for (let k = 0; k < 4; k++) fbox(b, f, '#5a5a60', 0, 0.26 + k * 0.11, 1.1, 0.04, 0.05, 0.01); fdisc(b, f, '#fff2a0', -0.75, 0.48, 0.16, 0.05, 0.01, { flat: true }); fdisc(b, f, '#fff2a0', 0.75, 0.48, 0.16, 0.05, 0.01, { flat: true }); }
        else if (!front && !hood) { fbox(b, f, '#e0302a', -0.75, f.y1 - 0.4, 0.2, 0.3, 0.05, 0.01, { flat: true }); fbox(b, f, '#e0302a', 0.75, f.y1 - 0.4, 0.2, 0.3, 0.05, 0.01, { flat: true }); if (rv) for (let k = 0; k < 6; k++) fbox(b, f, '#8a8f96', 0.3, 0.15 + k * 0.25, 0.4, 0.04); }
        else fbox(b, f, stripe, 0, f.y1 - 0.2, 2, 0.12);
      }
    }
    // 拖車屋
    const trailer = (x, z, ry, c) => {
      const L = b.at(x, 0, z, ry);
      L.box(11, 2.7, 3.2, c, 0, 1.75, 0);
      L.box(11.05, 0.35, 3.25, '#2fa39a', 0, 1.9, 0, { ol: false });
      L.box(10.6, 0.4, 3.0, '#6a5a44', 0, 0.2, 0, { ol: false });
      for (const lx of [-3.6, -0.8, 3.4]) L.box(1.2, 0.8, 0.06, '#4a6a7a', lx, 2.3, 1.62, { ol: false });
      L.box(0.9, 1.9, 0.06, '#8a5a3a', 1.4, 1.35, 1.62, { ol: false });
      L.box(1.6, 0.4, 1.0, '#9a7a5a', 1.4, 0.2, 2.2);
      L.cone(0.5, 0.3, '#e8e8e8', -3.5, 3.4, 0, { rx: 0.7, seg: 10 });
      L.cap(0.35, 0.8, '#e8e8e8', 5.9, 0.6, 0.6, { rz: Math.PI / 2 });
    };
    trailer(-9, 4, 0.1, '#f4ecd6'); trailer(-10, 21, -0.15, '#e9f2f0'); trailer(34, 8, Math.PI / 2 + 0.2, '#f6e3c8'); trailer(33, 22, Math.PI / 2 - 0.1, '#eef0e0'); trailer(12, -10, Math.PI, '#f4ecd6'); trailer(14, 34, 0.05, '#f3e0e6');
    // 餌料啤酒小屋＋霓虹
    b.box(5, 3, 4, '#8a6a4a', -14, 1.5, -6); b.box(5.8, 0.3, 4.8, '#5a4030', -14, 3.15, -6, { rz: 0.1 });
    const neon = sign(root, 'BAIT & BEER', 4.2, -14, 2.3, -3.94, 0, { color: '#7dff6a', stroke: '#0c3a10', size: 64 });
    anims.push(t => { neon.material.opacity = Math.sin(t * 13) + Math.sin(t * 5.3) > 1.4 ? 0.2 : 1; });
    // 落羽杉
    const notWater = () => true;
    scatter(R, 20, 4.5, 18, (x, z) => {
      const s = 0.8 + R() * 0.45;
      b.cone(1.1 * s, 2.0 * s, '#6a5a44', x, 1.0 * s, z, { seg: 7 });
      b.cyl(0.28 * s, 0.45 * s, 7.5 * s, '#7a6650', x, 4.2 * s, z, { seg: 7 });
      b.sph(2.6 * s, '#4a6a32', x, 7.8 * s, z, { sy: 0.45, seg: 9 });
      b.sph(2.0 * s, '#567a3a', x + 1.2 * s, 6.7 * s, z - 0.6 * s, { sy: 0.4, seg: 8 });
      b.sph(1.8 * s, '#4a6a32', x - 1.3 * s, 6.3 * s, z + 0.7 * s, { sy: 0.4, seg: 8 });
      for (let k = 0; k < 5; k++) { const a = k * 1.3 + R(); b.cone(0.28 * s, 1.6 * s, '#a9b49a', x + Math.cos(a) * 1.7 * s, 5.7 * s, z + Math.sin(a) * 1.7 * s, { rx: Math.PI, seg: 5, ol: false }); }
      for (let k = 0; k < 3; k++) b.cone(0.2, 0.7, '#6a5a44', x + (R() - 0.5) * 3, 0.3, z + (R() - 0.5) * 3, { seg: 5, ol: false });
    }, notWater);
    // 紅鶴草坪擺飾
    scatter(R, 10, 1.5, 14, (x, z) => {
      const ry = R() * 6.28, L = b.at(x, 0, z, ry), p = '#ff6fa8';
      L.sph(0.32, p, 0, 1.0, 0, { sx: 1.5, sy: 0.9, sz: 0.85, seg: 8 });
      L.tor(0.28, 0.06, p, 0.38, 1.28, 0, { arc: Math.PI * 1.1, rz: -0.3, seg: 8, ol: false });
      L.sph(0.12, p, 0.62, 1.55, 0, { seg: 8 });
      L.cone(0.05, 0.22, '#1b1226', 0.74, 1.5, 0, { rz: Math.PI * 0.62, seg: 6, ol: false });
      L.cyl(0.02, 0.02, 0.8, '#3a3a3a', -0.05, 0.4, 0.08, { seg: 4, ol: false }); L.cyl(0.02, 0.02, 0.8, '#3a3a3a', -0.05, 0.4, -0.08, { seg: 4, ol: false });
    }, (x, z) => !(x > -16 && x < -3 && (Math.abs(z - 4) < 3 || Math.abs(z - 21) < 3)));
    // 舊輪胎、晾衣繩柱
    for (const [x, z] of [[-3, 26.5], [-2.5, -2.2], [26.8, 25.8], [27.2, -2.5]]) b.tor(0.55, 0.22, '#1c1c20', x, 0.2, z, { rx: Math.PI / 2, seg: 12 });
    b.cyl(0.07, 0.07, 2.2, '#8a8f96', -5, 1.1, 30, { seg: 5 }); b.cyl(0.07, 0.07, 2.2, '#8a8f96', 1, 1.1, 30, { seg: 5 });
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-5, 2.15, 30), new THREE.Vector3(-2, 1.95, 30), new THREE.Vector3(1, 2.15, 30)]), 8, 0.02, 4), '#e8e8e8', 0, 0, 0, { ol: false });
    // 晾著的衣物隨風擺（各自繞晾衣繩轉）
    const laundry = ['#ffffff', '#ff6fa8', '#2fa39a', '#ffcf3a'].map((c, k) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.04).translate(0, -0.45, 0), toon(c));
      m.position.set(-4 + k * 1.4, 2.05 - Math.abs(k - 1.5) * 0.05, 30); m.raycast = () => {}; root.add(m); return m;
    });
    anims.push(t => laundry.forEach((m, k) => { m.rotation.x = Math.sin(t * 1.8 + k * 0.9) * 0.28 + 0.15; m.rotation.z = Math.sin(t * 1.1 + k) * 0.05; }));
    // 遠方樹林帶
    for (let a = 0; a < 40; a++) { const ang = a / 40 * Math.PI * 2, r = 85 + R() * 20; b.sph(8 + R() * 6, a % 2 ? '#56743a' : '#4a6632', 12 + Math.cos(ang) * r, 3, 12 + Math.sin(ang) * r, { sy: 0.8, seg: 7, ol: false }); }
  },

  // 5. 高熱量聖殿：東側汽水機祭壇背景、薯條柱與吊旗、紅毯、燭火（室內，單面牆朝內）
  temple({ root, b, anims, R, rows }) {
    groundRing(b, '#4e2216');
    // 地面金線格
    for (let x = -8; x <= 32; x += 4) if (x < 0 || x > 24) b.flatQuad(0.12, 40, '#8a4a22', x, GY + 0.01, 12);
    for (let z = -8; z <= 32; z += 4) { b.flatQuad(8, 0.12, '#8a4a22', -4, GY + 0.01, z); if (z < 0 || z > 24) b.flatQuad(24, 0.12, '#8a4a22', 12, GY + 0.01, z); }
    // 紅毯（西側入口一路鋪到祭壇階梯；棋盤上為 ≤0.02 平貼）
    b.flatQuad(8, 3.0, '#a8161c', -4, GY + 0.015, 12);
    b.flatQuad(12, 3.0, '#a8161c', 6, 0.012, 12, { op: 0.75, flat: true });
    for (const dz of [-1.6, 1.6]) { b.flatQuad(8, 0.2, '#ffcf3a', -4, GY + 0.02, 12 + dz); b.flatQuad(12, 0.18, '#ffcf3a', 6, 0.014, 12 + dz, { flat: true }); }
    // 祭壇階梯側板（金＋番茄紅＋圓章）
    for (const f of faces(rows)) {
      fpanel(b, f, f.h === 3 ? '#e2a92c' : f.h === 2 ? '#c88a26' : '#b4702a');
      fbox(b, f, '#d6261c', 0, f.y1 - 0.18, 2, 0.14);
      if (f.y1 - f.y0 > 1.0) fdisc(b, f, '#ffe58a', 0, (f.y0 + f.y1) / 2 - 0.1, 0.3, 0.045, 0.012);
    }
    // 東緣 # 欄：金色祭壇牆（不可走，高於 h3）
    b.box(1.96, 4.1, 24, '#d9a02c', 23, 1.35, 12);
    b.box(2.0, 0.4, 24.05, '#d6261c', 23, 2.9, 12, { ol: false });
    for (let z = 2; z < 24; z += 4) b.cyl(0.38, 0.38, 0.12, '#ffe58a', 21.98, 2.0, z, { rz: Math.PI / 2, seg: 12, ol: false });
    // 祭壇後的三層金階（棋盤外 4 m 內，≤6 m）
    [[25.5, 3.6], [26.9, 4.5], [28.2, 5.4]].forEach(([x, h], k) => b.box(1.4, h, 34 - k * 3, ['#b4702a', '#c88a26', '#e2a92c'][k], x, h / 2, 12));
    // 巨型汽水機祭壇（x ≥ 28.9）
    const ax = 29.4;
    b.box(8, 20, 30, '#e7b43a', ax + 4, 10, 12);
    b.box(0.5, 2.6, 26, '#2a0a06', ax - 0.1, 16.6, 12, { ol: false });
    sign(root, 'FREE REFILLS ∞', 13, ax - 0.4, 16.6, 12, -Math.PI / 2, { color: '#ffe14d', stroke: '#6a0a06', size: 80 });
    const glow = ownFlat('#fff2b0');
    b.box(0.3, 0.5, 28, null, ax - 0.1, 19.3, 12, { mat: glow, r: 0 });
    const cols = ['#6a2a12', '#ff8a1a', '#7cc242', '#d6261c', '#3fa3e0', '#8a2a6a'];
    for (let k = 0; k < 6; k++) {
      const z = 1.0 + k * 4.4;
      b.box(0.8, 5.5, 3.0, cols[k], ax - 0.2, 10.4, z);
      b.box(0.5, 1.2, 1.0, '#c9ccd1', ax - 0.75, 7.0, z);
      b.cyl(0.22, 0.12, 0.8, '#9a9da2', ax - 0.95, 6.1, z, { seg: 8 });
      b.box(0.3, 0.6, 0.18, '#d6261c', ax - 0.75, 8.0, z + 0.7, { rz: 0.4 });
    }
    for (const [z, t] of [[3.2, 'HOLY\nCOLA'], [12.0, 'SACRED\nFIZZ'], [20.8, 'DIVINE\nDIET']]) sign(root, t, 2.6, ax - 0.65, 12.0, z, -Math.PI / 2, { color: '#fff', stroke: '#6a0a06', size: 56 });
    // 巨杯（祭壇兩翼）
    for (const z of [-4.5, 28.5]) {
      b.box(5, 3.4, 5, '#b4702a', ax + 1.5, 1.7, z);
      b.cyl(2.5, 1.9, 7, '#f2ece0', ax + 1.5, 3.4 + 3.5, z, { seg: 14 });
      b.cyl(2.3, 2.3, 1.4, '#d6261c', ax + 1.5, 8.0, z, { seg: 14, ol: false });
      b.cyl(2.6, 2.6, 0.45, '#f6f2ea', ax + 1.5, 10.6, z, { seg: 14 });
      b.cyl(0.22, 0.22, 5, '#d6261c', ax + 2.0, 12.6, z - 0.5, { rz: 0.25, seg: 6 });
    }
    // 牆（朝內單面）：北 z=-7、南 z=31、西 x=-7
    const wallMat = new THREE.MeshToonMaterial({ color: '#5a1a10', gradientMap: null });
    const wall = (w, h, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.position.set(x, h / 2 + GY, z); m.rotation.y = ry; m.raycast = () => {}; root.add(m); };
    wall(44, 14, 12, -7, 0); wall(44, 14, 12, 31, Math.PI); wall(38, 14, -7, 12, Math.PI / 2);
    // 薯條柱（沿牆）＋吊旗
    const fry = (x, z) => { b.box(1.3, 12, 1.3, '#f2c240', x, 6, z); b.box(1.6, 1.4, 1.6, '#d6261c', x, 0.7, z); b.box(1.5, 0.4, 1.5, '#d6261c', x, 12.1, z); };
    const banner = (x, z, ry, txt) => {
      const L = b.at(x, 0, z, ry);
      L.box(3.0, 6.0, 0.1, '#c41e1a', 0, 8.0, 0.15, { ol: false });
      L.cone(1.5, 1.0, '#c41e1a', 0, 4.5, 0.15, { rx: Math.PI, seg: 3, sz: 0.06, ol: false });
      L.box(3.2, 0.25, 0.25, '#ffcf3a', 0, 11.1, 0.15);
      L.disc(0.9, '#ffcf3a', 0, 9.6, 0.22, { rx: Math.PI / 2, flat: true });
      if (txt) sign(root, txt, 2.3, x + Math.sin(ry) * 0.24, 7.0, z + Math.cos(ry) * 0.24, ry, { color: '#ffe14d', size: 56 });
    };
    const words = ['BLESSED\nBE THE\nFRYER', 'SUPER\nSIZE\nYOUR\nSOUL', 'THOU\nSHALT\nUPSIZE', 'NO\nSUBSTI-\nTUTIONS'];
    let wi = 0;
    for (const x of [-4, 6, 16, 26]) { fry(x, -6.3); fry(x, 30.3); }
    for (const x of [1, 11, 21]) { banner(x, -6.85, 0, words[wi++ % 4]); banner(x, 30.85, Math.PI, words[wi++ % 4]); }
    for (const z of [2, 22]) fry(-6.3, z);
    banner(-6.85, 12, Math.PI / 2, 'TRANS\nFAT\nIS\nLOVE');
    // 燭台群
    const flame = ownFlat('#ffb43a');
    const cand = (x, z, n) => {
      for (let k = 0; k < n; k++) {
        const cx = x + (R() - 0.5) * 1.8, cz = z + (R() - 0.5) * 1.8, h = 0.4 + R() * 1.0;
        b.cyl(0.13, 0.15, h, '#f6eedb', cx, h / 2, cz, { seg: 8 });
        b.cone(0.1, 0.32, null, cx, h + 0.17, cz, { mat: flame, seg: 6 });
      }
    };
    for (const [x, z] of [[-3, -3], [-3, 27], [-4.5, 6], [-4.5, 18], [6, -3.2], [18, -3.2], [6, 27.2], [18, 27.2], [26.2, -2.5], [26.2, 26.5]]) cand(x, z, 7);
    for (let z = 0.5; z < 24; z += 1.5) { b.cyl(0.13, 0.14, 0.5, '#f6eedb', 25.3, 3.85, z, { seg: 8 }); b.cone(0.09, 0.28, null, 25.3, 4.25, z, { mat: flame, seg: 6 }); }
    anims.push(t => {
      const k = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 27) * 0.07; flame.color.setRGB(1 * k, 0.7 * k, 0.23 * k);
      glow.color.setHSL(0.13, 1, 0.75 + Math.sin(t * 2) * 0.1);
    });
  },

  // 6. 地鐵下水道：隧道拱牆、軌道、塗鴉、發光蘑菇；h2 島＝廢棄車廂頂，h1 島＝巨型蘑菇傘
  sewer({ root, b, anims, R, rows }) {
    groundRing(b, '#26332d');
    // 軌道（橫越棋盤 h0：平貼 ≤0.04，棋盤外延伸進東西隧道口）
    for (const rz of [11.25, 12.75]) { b.box(24, 0.035, 0.12, '#9aa3a8', 12, 0.02, rz, { ol: false, r: 0 }); b.box(30, 0.12, 0.14, '#9aa3a8', -15, GY + 0.06, rz, { ol: false, r: 0 }); b.box(30, 0.12, 0.14, '#9aa3a8', 39, GY + 0.06, rz, { ol: false, r: 0 }); }
    for (let x = -29.5; x < 54; x += 0.9) b.flatQuad(0.36, 2.4, '#3a2a1e', x, x >= 0 && x <= 24 ? 0.008 : GY + 0.012, 12);
    // 車廂側板（h2）／蘑菇傘（h1 孤島）／碎木箱（車廂旁 h1 台階）
    const isMush = (x, z) => (x >= 8 && x <= 9 && z >= 3 && z <= 4) || (x >= 1 && x <= 2 && z >= 7 && z <= 8);
    const mushGlow = ownFlat('#ff5ab4');
    for (const f of faces(rows)) {
      if (f.h === 2) {
        fpanel(b, f, '#b7bec4');
        fbox(b, f, '#2d6a8a', 0, f.y1 - 0.42, 2, 0.12);
        fbox(b, f, '#5c6670', 0, f.y0 + 0.18, 2, 0.3);
        if (f.dz) { // 長邊：窗與門
          const door = (f.x % 2) === 0;
          if (door) { fbox(b, f, '#7d868e', 0, (f.y0 + f.y1) / 2 + 0.05, 0.9, f.y1 - f.y0 - 0.6); fbox(b, f, '#1d3a3a', 0, f.y1 - 0.8, 0.6, 0.45, 0.052, 0.008); }
          else { fbox(b, f, '#1d3a3a', 0, f.y1 - 0.85, 1.5, 0.55); fbox(b, f, '#7fe0c0', -0.45, f.y1 - 0.75, 0.25, 0.2, 0.053, 0.006, { flat: true, op: 0.6 }); }
          fdisc(b, f, '#222', -0.6, f.y0 + 0.15, 0.32, 0.04); fdisc(b, f, '#222', 0.6, f.y0 + 0.15, 0.32, 0.04);
        } else { fbox(b, f, '#1d3a3a', 0, f.y1 - 0.85, 1.2, 0.6); fbox(b, f, '#ffcf3a', -0.75, f.y1 - 0.3, 0.2, 0.14, 0.05, 0.01, { flat: true }); fbox(b, f, '#ffcf3a', 0.75, f.y1 - 0.3, 0.2, 0.14, 0.05, 0.01, { flat: true }); }
      } else if (isMush(f.x, f.z)) {
        fpanel(b, f, '#e0559a');
        fbox(b, f, '#7a2a5a', 0, f.y0 + 0.12, 2, 0.24);
        fbox(b, f, null, 0, f.y1 - 0.1, 2, 0.08, 0.045, 0.015, { mat: mushGlow });
        fdisc(b, f, '#fff2f8', -0.45, (f.y0 + f.y1) / 2 + 0.1, 0.18, 0.045, 0.012); fdisc(b, f, '#fff2f8', 0.5, (f.y0 + f.y1) / 2 - 0.05, 0.12, 0.045, 0.012);
      } else {
        fpanel(b, f, '#7a5a3c');
        for (let k = 0; k < 3; k++) fbox(b, f, '#5a3e28', 0, f.y0 + 0.2 + k * 0.3, 2, 0.05);
        fbox(b, f, '#5a3e28', 0, (f.y0 + f.y1) / 2, 2.2, 0.06, 0.05, 0.01, { rz: 0.3 });
      }
    }
    // 車廂上的塗鴉
    for (const f of faces(rows, (x, z, h) => h === 2)) {
      if (f.dz && f.x % 2 === 1) ftext(root, f, ['RENT DUE', 'NO REFUNDS', 'RAT CITY', 'PIZZA 4 LIFE'][(f.x + f.z) % 4], 0, f.y0 + 0.75, 1.7, { color: ['#ff5ab4', '#5dff9a', '#ffcf3a', '#5ad8ff'][(f.x + f.z) % 4], stroke: '#111', size: 56 });
    }
    // 隧道牆（朝內單面）：北 z=-7、南 z=31、西 x=-9、東 x=33
    const brick = new THREE.MeshToonMaterial({ color: '#34443c', gradientMap: null });
    const wall = (w, h, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), brick); m.position.set(x, h / 2 + GY, z); m.rotation.y = ry; m.raycast = () => {}; root.add(m); };
    wall(42, 13, 12, -7, 0); wall(42, 13, 12, 31, Math.PI); wall(38, 13, -9, 12, Math.PI / 2); wall(38, 13, 33, 12, -Math.PI / 2);
    // 磚縫橫線
    for (let y = 1.2; y < 12; y += 1.4) { b.box(42, 0.08, 0.04, '#2a3832', 12, y, -6.96, { ol: false }); b.box(42, 0.08, 0.04, '#2a3832', 12, y, 30.96, { ol: false }); }
    // 拱門（壁面凹拱）＋柱
    const arch = (x, z, ry, s) => {
      const L = b.at(x, 0, z, ry);
      L.tor(3.6, 0.5, '#5a5048', 0, 3.2, 0.1, { arc: Math.PI, seg: 14 });
      L.box(1.0, 3.2, 1.0, '#5a5048', -3.6, 1.6, 0.1); L.box(1.0, 3.2, 1.0, '#5a5048', 3.6, 1.6, 0.1);
      L.box(6.2, 3.2, 0.06, '#0c1410', 0, 1.6, 0.04, { flat: true });
      L.disc(3.1, '#0c1410', 0, 3.2, 0.04, { rx: Math.PI / 2, flat: true, seg: 16 });
    };
    for (const x of [-3, 12, 27]) { arch(x, -7, 0); arch(x, 31, Math.PI); }
    // 管線
    for (const [z, s] of [[-6.6, 1], [30.6, -1]]) { b.cyl(0.35, 0.35, 42, '#6a6058', 12, 8.2, z, { rz: Math.PI / 2, seg: 8 }); b.cyl(0.22, 0.22, 42, '#8a5a3a', 12, 9.2, z, { rz: Math.PI / 2, seg: 8 }); }
    for (const [x, s] of [[-8.6, 1], [32.6, -1]]) b.cyl(0.3, 0.3, 38, '#6a6058', x, 8.6, 12, { rx: Math.PI / 2, seg: 8 });
    // 牆上塗鴉（拱與拱之間）
    const tags = [['CANCEL\nANYTIME?', '#ff5ab4'], ['NO TRIAL\nIS FREE', '#5dff9a'], ['RATS\nRULE', '#ffcf3a'], ['MIND THE\nGAP', '#5ad8ff'], ['SKIP\nAD', '#ff8a3a'], ['UNSUB\nSCRIBE', '#5dff9a']];
    let ti = 0;
    for (const [z, ry] of [[-6.94, 0], [30.94, Math.PI]]) for (const x of [4.5, 19.5]) { const [t, c] = tags[ti++ % tags.length]; sign(root, t, 4.4, x, 3.4, z + (ry ? -0.03 : 0.03), ry, { color: c, stroke: '#111', size: 64 }); }
    // 隧道口（東西牆上，軌道進出）
    const sigs = [];
    for (const [x, ry] of [[-9, Math.PI / 2], [33, -Math.PI / 2]]) {
      const L = b.at(x, 0, 12, ry);
      L.tor(3.6, 0.7, '#5a5048', 0, 2.6, 0.1, { arc: Math.PI, seg: 16 });
      L.box(1.2, 2.6, 1.0, '#5a5048', -3.6, 1.3, 0.1); L.box(1.2, 2.6, 1.0, '#5a5048', 3.6, 1.3, 0.1);
      L.box(6.0, 2.6, 0.06, '#050806', 0, 1.3, 0.04, { flat: true });
      L.disc(3.0, '#050806', 0, 2.6, 0.04, { rx: Math.PI / 2, flat: true, seg: 16 });
      for (const t of [-6, 6]) { const [t2, c] = tags[ti++ % tags.length]; sign(root, t2, 3.6, x + Math.sin(ry) * 0.04 + Math.cos(ry) * t, 3.2, 12 - Math.sin(ry) * t + Math.cos(ry) * 0.04, ry, { color: c, stroke: '#111', size: 64 }); }
      const sig = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), ownFlat('#5dff6a'));
      sig.position.set(x + Math.sin(ry) * 0.5, 4.2, 12 + 4.6 * Math.sin(ry)); root.add(sig); sigs.push(sig);
    }
    // 發光蘑菇群＋綠黏液水窪
    const capA = ownFlat('#5dff9a'), capB = ownFlat('#ff5ab4'), capC = ownFlat('#5ad8ff');
    scatter(R, 34, 1.0, 6.2, (x, z, i) => {
      const s = 0.5 + R() * 1.3, cap = [capA, capB, capC][i % 3];
      b.cyl(0.12 * s, 0.18 * s, 1.2 * s, '#e8f0e0', x, 0.6 * s, z, { seg: 6 });
      b.sph(0.6 * s, null, x, 1.2 * s, z, { mat: cap, sy: 0.55, seg: 10 });
      if (R() < 0.5) { b.cyl(0.08 * s, 0.1 * s, 0.6 * s, '#e8f0e0', x + 0.5 * s, 0.3 * s, z + 0.3 * s, { seg: 5 }); b.sph(0.32 * s, null, x + 0.5 * s, 0.62 * s, z + 0.3 * s, { mat: cap, sy: 0.55, seg: 8 }); }
    }, (x, z) => Math.abs(z - 12) > 2.5);
    for (const [x, z, r] of [[-4, 4, 2.0], [28, 20, 2.2], [-5, 22, 1.5], [28.5, 2, 1.6], [12, -4, 1.8], [16, 28, 1.6]]) b.disc(r, '#4dff6a', x, GY + 0.015, z, { flat: true, op: 0.5, seg: 14 });
    // 披薩盒堆、垃圾袋
    for (const [x, z] of [[-3, -4.5], [27, 28.5], [-2.5, 28.5], [28, -4.5]]) for (let k = 0; k < 4; k++) b.box(1.1, 0.12, 1.1, '#e8d2a8', x + (R() - 0.5) * 0.2, 0.06 + k * 0.13, z, { ry: R() * 0.4 });
    for (const [x, z] of [[-2.4, 8], [26.8, 15], [27, 18], [-2.6, 18]]) b.sph(0.6, '#1c1c22', x, 0.45, z, { sy: 0.8, seg: 8 });
    anims.push(t => {
      const k = 0.75 + 0.25 * Math.sin(t * 1.7);
      capA.color.setRGB(0.36 * k, 1 * k, 0.6 * k); capB.color.setRGB(1 * k, 0.35 * (2 - k), 0.7 * k); capC.color.setRGB(0.35 * k, 0.85 * k, 1 * k);
      mushGlow.color.setRGB(1, 0.35 + 0.3 * Math.sin(t * 2.3), 0.7);
      sigs.forEach((s, i) => s.material.color.set(Math.sin(t * 2 + i * 3) > 0 ? '#5dff6a' : '#ff3a3a'));
    });
  },

  // 7. 德州煙燻烤肉競技場：四角鑄鐵烤架塔、角落煙囪、圓形看台與觀眾、北側巨型煙燻爐、火星
  bbq({ root, b, anims, R, rows }) {
    groundRing(b, '#4a3020');
    // 競技場地面：放射狀木屑紋
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; b.flatQuad(0.18, 8, '#5a3a24', 12 + Math.cos(a) * 21, GY + 0.01, 12 + Math.sin(a) * 21, { ry: -a + Math.PI / 2 }); }
    // 烤架塔側板：鑄鐵＋格柵＋鉚釘＋火口
    const fire = ownFlat('#ff7a1a');
    for (const f of faces(rows)) {
      fpanel(b, f, f.h === 2 ? '#2a2628' : '#3e383a');
      for (let k = 0; k < 3; k++) fbox(b, f, '#6a6062', 0, f.y1 - 0.2 - k * 0.16, 1.6, 0.05);
      fdisc(b, f, '#b0a090', -0.85, f.y1 - 0.12, 0.05, 0.05, 0.01); fdisc(b, f, '#b0a090', 0.85, f.y1 - 0.12, 0.05, 0.05, 0.01);
      if (f.y1 - f.y0 > 1.1) fbox(b, f, null, 0, f.y0 + 0.35, 1.1, 0.22, 0.045, 0.015, { mat: fire });
    }
    // 角落煙囪（棋盤外，≤6 m）＋煙
    for (const [x, z] of [[-2.4, -2.4], [26.4, -2.4], [-2.4, 26.4], [26.4, 26.4]]) {
      b.box(1.5, 1.2, 1.5, '#3e383a', x, 0.6, z);
      b.cyl(0.55, 0.65, 4.6, '#2a2628', x, 3.4, z, { seg: 12 }); b.cyl(0.85, 0.6, 0.4, '#2a2628', x, 5.75, z, { seg: 12 });
      b.box(0.9, 0.4, 0.06, null, x, 0.55, z + (z < 0 ? 0.77 : -0.77), { mat: fire, r: 0 });
      smoke(root, anims, x, 6.0, z, { n: 5, rise: 7, size: 0.9, speed: 0.22, color: '#d8ccc0', op: 0.5 });
    }
    // 競技場矮牆（圓）
    const ringR = 18.6;
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; b.box(2.6, 1.2, 0.5, i % 2 ? '#7a4a2a' : '#8a5a34', 12 + Math.cos(a) * ringR, 0.6, 12 + Math.sin(a) * ringR, { ry: -a + Math.PI / 2 }); }
    // 看台（北側留缺口放煙燻爐）＋觀眾燈點
    const crowdPts = [], crowdCol = [];
    const pal = ['#ffcf3a', '#ff6a3a', '#ffffff', '#ff3a8c', '#7cc242', '#5ad8ff', '#f4e0c0'].map(rgb);
    const gap = (a) => { const d = Math.abs(((a - Math.PI * 1.5) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return d < 0.5; };
    for (let tier = 0; tier < 7; tier++) {
      const r = 22.6 + tier * 2.2, y = 0.9 + tier * 1.25, n = 60 + tier * 6;
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) / n * Math.PI * 2; if (gap(a)) continue;
        b.box(2 * Math.PI * r / n * 1.04, y, 2.3, tier % 2 ? '#6a4630' : '#7a5236', 12 + Math.cos(a) * r, y / 2, 12 + Math.sin(a) * r, { ry: -a + Math.PI / 2, ol: false, r: 0 });
        for (let k = 0; k < 3; k++) { const aa = a + (k - 1) * (0.8 / r); crowdPts.push(12 + Math.cos(aa) * (r - 0.5), y + 0.5, 12 + Math.sin(aa) * (r - 0.5)); crowdCol.push(...pal[(R() * pal.length) | 0]); }
      }
    }
    // 觀眾：牛仔帽剪影（第一排）
    for (let i = 0; i < 70; i++) {
      const a = (i + 0.5) / 70 * Math.PI * 2; if (gap(a)) continue;
      const x = 12 + Math.cos(a) * 22.4, z = 12 + Math.sin(a) * 22.4, c = ['#e8473b', '#2f7fd8', '#ffcf3a', '#f2f2f2', '#3fa35a'][i % 5];
      b.cap(0.28, 0.3, c, x, 1.55, z, { seg: 6 });
      b.sph(0.2, '#f0c8a0', x, 2.1, z, { seg: 6, ol: false });
      b.cyl(0.36, 0.36, 0.05, '#8a5a34', x, 2.27, z, { seg: 8, ol: false }); b.cyl(0.16, 0.2, 0.2, '#8a5a34', x, 2.38, z, { seg: 8, ol: false });
    }
    const crowd = dots(crowdPts, crowdCol, 0.7); root.add(crowd);
    // 布條（看台前緣）
    for (const [a, t] of [[0, 'NO KETCHUP ZONE'], [Math.PI * 0.5, 'BRISKET OR BUST'], [Math.PI, 'LOW & SLOW'], [Math.PI * 0.25, 'MEAT SWEATS ONLY'], [Math.PI * 0.75, 'SAUCE ON THE SIDE']]) {
      const r = 21.38, x = 12 + Math.cos(a) * r, z = 12 + Math.sin(a) * r;
      sign(root, t, 5.0, x, 0.48, z, -a - Math.PI / 2, { bg: '#7a1a10', color: '#ffe14d', size: 56 });
    }
    // 巨型煙燻爐（北側缺口，離棋盤 ≥ 9 m）
    const sx = 12, sz = -13.5;
    b.cyl(3.6, 3.6, 15, '#2a2628', sx, 4.4, sz, { rz: Math.PI / 2, seg: 20 });
    b.cyl(3.7, 3.7, 0.4, '#5a5254', sx - 7.5, 4.4, sz, { rz: Math.PI / 2, seg: 20 }); b.cyl(3.7, 3.7, 0.4, '#5a5254', sx + 7.5, 4.4, sz, { rz: Math.PI / 2, seg: 20 });
    b.box(5, 6, 6, '#3e383a', sx + 10, 3.0, sz);
    b.box(2.4, 1.4, 0.1, null, sx + 10, 1.6, sz + 3.02, { mat: fire, r: 0 });
    b.cyl(0.9, 1.1, 13, '#2a2628', sx - 6.5, 9.0, sz, { seg: 12 }); b.cyl(1.4, 1.0, 0.6, '#2a2628', sx - 6.5, 15.6, sz, { seg: 12 });
    for (const lx of [-6, 6]) for (const lz of [-2.4, 2.4]) b.cyl(0.3, 0.3, 1.6, '#2a2628', sx + lx, 0.8, sz + lz, { seg: 8 });
    for (const lx of [-6, 6]) b.tor(1.2, 0.18, '#3a3436', sx + lx, 0.9, sz + 2.8, { seg: 12 });
    b.box(13, 0.25, 0.25, '#b0a090', sx, 5.2, sz + 3.6, { ol: false });
    sign(root, 'BRISKET 9000', 8, sx, 3.6, sz + 3.65, 0, { color: '#ffb21f', stroke: '#2a0a00', size: 72 });
    smoke(root, anims, sx - 6.5, 16, sz, { n: 7, rise: 16, size: 2.2, speed: 0.1, color: '#bfb2a6', op: 0.55, dx: 1.2, dz: 0.4 });
    // 火星
    const emb = [], embC = [];
    for (let i = 0; i < 140; i++) { emb.push(lerp(-6, 30, R()), R() * 10, lerp(-6, 30, R())); embC.push(...rgb(R() < 0.5 ? '#ffb21f' : '#ff5a1a')); }
    const embers = dots(emb, embC, 0.22, { add: true }); root.add(embers);
    const ep = embers.geometry.attributes.position, base = ep.array.slice();
    anims.push(t => {
      const a = ep.array;
      for (let i = 0; i < a.length; i += 3) { a[i + 1] = (base[i + 1] + t * (0.8 + (i % 7) * 0.1)) % 10; a[i] = base[i] + Math.sin(t + i) * 0.3; }
      ep.needsUpdate = true;
      fire.color.setRGB(1, 0.42 + Math.sin(t * 7) * 0.1 + Math.sin(t * 17) * 0.06, 0.1);
      crowd.material.opacity = 0.7 + Math.sin(t * 5) * 0.3;
    });
  },

  // 8. 凌晨三點鬆餅屋：西側吧檯與煎台、點唱機、東側窗外夜間停車場、OPEN 24/7 霓虹
  diner({ root, b, anims, R, rows }) {
    groundRing(b, '#24262c');
    // 室內格紋地板（棋盤外一圈）
    const ck = (x0, x1, z0, z1) => { for (let x = x0; x < x1; x += 1) for (let z = z0; z < z1; z += 1) if (outside(x + 0.5, z + 0.5, 0)) b.flatQuad(1, 1, ((Math.floor(x) + Math.floor(z)) & 1) ? '#1b1b1f' : '#f0ebe0', x + 0.5, GY + 0.01, z + 0.5, { recv: true }); };
    ck(-4, 28, -4, 28);
    // 牆（朝內單面，低）：西、北、南
    const wallMat = new THREE.MeshToonMaterial({ color: '#f2ead8', gradientMap: null });
    const wainMat = new THREE.MeshToonMaterial({ color: '#1f6a68', gradientMap: null });
    const trimMat = new THREE.MeshBasicMaterial({ color: '#e0302a' });
    const wall = (w, x, z, ry) => {
      const up = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.4), wallMat); up.position.set(x, 1.2 + 1.2 + GY, z); up.rotation.y = ry; up.raycast = () => {}; root.add(up);
      const lo = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.2), wainMat); lo.position.set(x, 0.6 + GY, z); lo.rotation.y = ry; lo.raycast = () => {}; root.add(lo);
      for (const y of [1.25, 3.45]) { const tr = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.14), trimMat); tr.position.set(x + Math.sin(ry) * 0.02, y, z + Math.cos(ry) * 0.02); tr.rotation.y = ry; tr.raycast = () => {}; root.add(tr); }
    };
    wall(32, -4, 12, Math.PI / 2); wall(32, 12, -4, 0); wall(32, 12, 28, Math.PI);
    // 吧檯（h1/h2 側板）：不鏽鋼＋紅條
    for (const f of faces(rows)) {
      fpanel(b, f, f.h === 1 ? '#c5cbd2' : '#b8bec6');
      fbox(b, f, '#e0302a', 0, f.y1 - 0.12, 2, 0.1);
      if (f.h === 1 || f.y1 - f.y0 > 1.2) for (let k = 0; k < 2; k++) fbox(b, f, '#9aa1a8', 0, f.y0 + 0.25 + k * 0.3, 2, 0.03, 0.045, 0.01);
    }
    // 西牆廚房：煎台、鬆餅機、咖啡壺、菜單、排煙罩
    b.box(2.6, 0.95, 18, '#b8bec6', -2.6, 0.45, 12);
    b.box(2.4, 0.08, 7, '#1b1b1f', -2.6, 0.96, 8, { ol: false });
    for (let k = 0; k < 4; k++) { b.box(0.8, 0.28, 0.8, '#2a2a2e', -2.6, 1.1, 13 + k * 1.2); b.cyl(0.32, 0.32, 0.05, '#e8b45a', -2.6, 1.27, 13 + k * 1.2, { seg: 10, ol: false }); }
    for (let k = 0; k < 3; k++) { b.cyl(0.18, 0.22, 0.45, '#2a2a2e', -2.4, 1.15, 17.5 + k * 0.6, { seg: 8 }); b.sph(0.14, '#c08040', -2.4, 1.1, 17.5 + k * 0.6, { seg: 6, ol: false }); }
    b.box(2.2, 0.6, 9, '#9aa1a8', -3.0, 3.1, 8);
    b.box(0.08, 1.4, 6.5, '#1b1b1f', -3.9, 2.4, 15.5, { ol: false });
    sign(root, 'WAFFLES ........ $3\nHASH BROWNS ... $2\nCOFFEE ∞ ...... $1\nCANCEL? ....... N/A', 6.0, -3.85, 2.4, 15.5, Math.PI / 2, { color: '#fff4c8', size: 40 });
    // 卡座（北、南牆）
    for (const [z, s] of [[-3.0, 1], [27.0, -1]]) for (const x of [2, 8, 14, 20]) {
      b.box(2.4, 1.1, 0.5, '#c4484a', x, 0.55, z - s * 0.25 + s * 0.0);
      b.box(1.4, 0.06, 1.0, '#e8e0d0', x, 0.78, z + s * 0.5, { ol: false });
    }
    // 點唱機
    const jx = 24.5, jz = -3.0;
    b.box(1.4, 1.3, 0.8, '#7a2a1a', jx, 0.65, jz);
    b.cyl(0.7, 0.7, 0.8, '#7a2a1a', jx, 1.3, jz, { rx: Math.PI / 2, seg: 16 });
    const juke = ownFlat('#ffcf3a');
    b.tor(0.55, 0.08, null, jx, 1.3, jz + 0.42, { mat: juke, arc: Math.PI, seg: 12 });
    b.box(0.9, 0.5, 0.05, '#2a1a10', jx, 0.95, jz + 0.42, { ol: false });
    // 東牆：窗框＋玻璃（朝內），窗外夜間停車場
    const ex = 28;
    b.box(0.3, 1.0, 32, '#1f6a68', ex, 0.5, 12);
    b.box(0.3, 0.5, 32, '#f2ead8', ex, 3.35, 12);
    for (let z = -4; z <= 28; z += 3.2) b.box(0.32, 2.4, 0.16, '#c9ccd1', ex, 2.1, z, { ol: false });
    const glass = ownFlat('#5a7a9a', { opacity: 0.18, depthWrite: false });
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(32, 2.2), glass); gm.position.set(ex, 2.1, 12); gm.rotation.y = -Math.PI / 2; root.add(gm);
    // 破窗（敵人破窗而入）
    for (let k = 0; k < 9; k++) b.cone(0.18, 0.4, '#bfe0f0', ex - 0.6 - R() * 2.6, GY + 0.04, 9 + R() * 6, { rx: Math.PI / 2, rz: R() * 6, seg: 3, ol: false });
    // 停車場
    for (let z = -16; z < 42; z += 3) b.flatQuad(5, 0.14, '#e8e8e2', 36, GY + 0.012, z);
    for (const [z, c, ry] of [[-1, '#e8473b', 0], [5, '#f2f2f2', 0.05], [17, '#2b2b30', -0.05], [26, '#3fa35a', 0]]) car(b, 36, z + 0.5, Math.PI + ry, c);
    car(b, 31.5, 12, 0.3, '#ffcf3a');
    for (const [x, z] of [[42, -8], [42, 12], [42, 32]]) lampPost(b, x, z, 8, Math.PI);
    // 霓虹招牌（東北角窗外，面向店內）
    const nx0 = 32.5, nz0 = -3.5, nry = -Math.PI / 2 - 0.6;
    b.cyl(0.3, 0.36, 7.5, '#2a2a2e', nx0, 3.75, nz0, { seg: 10 });
    const NB = b.at(nx0, 0, nz0, nry);
    NB.box(8.4, 3.4, 0.8, '#14161c', 0, 9.0, 0);
    NB.box(8.6, 0.2, 0.9, '#ff3a4a', 0, 10.8, 0, { flat: true });
    const nfx = Math.sin(nry) * 0.42, nfz = Math.cos(nry) * 0.42;
    const open = sign(root, 'OPEN 24/7', 7.6, nx0 + nfx, 9.6, nz0 + nfz, nry, { color: '#ff3a4a', stroke: '#3a0008', size: 96 });
    sign(root, 'WAFFLES • EGGS • REGRET', 7.4, nx0 + nfx, 8.0, nz0 + nfz, nry, { color: '#ffd23f', size: 56 });
    // 屋頂上方也看得到的屋外招牌（店面上方）
    const nWin = sign(root, 'OPEN', 2.6, ex - 0.25, 3.1, 4, -Math.PI / 2, { color: '#ff3a4a', stroke: '#3a0008', size: 72 });
    // 遠景：夜色中的高速公路與路燈點
    const hp = [], hc = [];
    for (let i = 0; i < 70; i++) { hp.push(lerp(-80, 110, i / 70), 6, 90); hc.push(...rgb('#ffcf7a')); hp.push(lerp(-80, 110, i / 70) + 1, 0.6, 86); hc.push(...rgb(i % 3 ? '#ff4a3a' : '#fff4d0')); }
    root.add(dots(hp, hc, 1.4, { fog: false }));
    b.box(220, 1.0, 6, '#2a2d36', 12, 5, 92, { ol: false });
    for (let x = -70; x < 110; x += 20) b.box(1.4, 5, 1.4, '#2a2d36', x, 2.5, 92, { ol: false });
    anims.push(t => {
      const on = !(Math.sin(t * 7.3) + Math.sin(t * 19) > 1.55);
      open.material.opacity = on ? 1 : 0.25; nWin.material.opacity = on ? 1 : 0.4;
      juke.color.setHSL((t * 0.15) % 1, 0.9, 0.6);
    });
  },

  // 9. 矽谷總部頂樓：城市夜景、直升機坪 H、東側伺服器王座光暈
  rooftop({ root, b, anims, R, rows }) {
    // 屋頂樓板（棋盤外一圈）與外牆
    const E = 8;
    b.box(24 + E * 2, 0.4, E, '#3e4450', 12, GY - 0.2, -E / 2, { ol: false, r: 0, recv: true });
    b.box(24 + E * 2, 0.4, E, '#3e4450', 12, GY - 0.2, 24 + E / 2, { ol: false, r: 0, recv: true });
    b.box(E, 0.4, 24, '#3e4450', -E / 2, GY - 0.2, 12, { ol: false, r: 0, recv: true });
    b.box(E, 0.4, 24, '#3e4450', 24 + E / 2, GY - 0.2, 12, { ol: false, r: 0, recv: true });
    // 女兒牆
    for (const [w, d, x, z] of [[40.6, 0.3, 12, -E], [40.6, 0.3, 12, 24 + E], [0.3, 40.6, -E, 12], [0.3, 40.6, 24 + E, 12]]) b.box(w, 0.9, d, '#596170', x, 0.4, z);
    // 大樓外牆往下
    b.box(40, 120, 40, '#1d2430', 12, -60.4, 12, { ol: false });
    const wp = [], wc = [];
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let y = -110; y < -2; y += 3.2) for (let k = -19; k <= 19; k += 2.4) if (R() < 0.7) { wp.push(12 + nx * 20.1 + (nz ? k : 0), y, 12 + nz * 20.1 + (nx ? k : 0)); wc.push(...rgb(R() < 0.8 ? '#ffe2a8' : '#8ad8ff')); }
    root.add(dots(wp, wc, 0.9, { fog: true }));
    // 直升機坪 H（h2 頂面平貼）＋停機坪側板
    for (const cz of [2, 22]) {
      const y = 2 * TH + 0.012;
      b.ring(1.55, 1.85, '#ffd23f', 11, y, cz, { flat: true });
      b.flatQuad(0.38, 1.9, '#f4f4f4', 10.4, y + 0.002, cz, { flat: true }); b.flatQuad(0.38, 1.9, '#f4f4f4', 11.6, y + 0.002, cz, { flat: true }); b.flatQuad(0.9, 0.34, '#f4f4f4', 11, y + 0.002, cz, { flat: true });
      for (const [x, z] of [[8.3, cz - 1.7], [13.7, cz - 1.7], [8.3, cz + 1.7], [13.7, cz + 1.7]]) b.disc(0.12, '#5dff9a', x, y, z, { flat: true, seg: 8 });
    }
    const seam = ownFlat('#3ff0d8');
    for (const f of faces(rows)) {
      if (f.h === 3 || (f.h >= 1 && f.x >= 7)) { // 伺服器王座台：黑玻璃＋青色接縫
        fpanel(b, f, '#161a22');
        fbox(b, f, null, 0, f.y1 - 0.06, 2, 0.05, 0.045, 0.015, { mat: seam });
        fbox(b, f, null, 0.97, (f.y0 + f.y1) / 2, 0.04, f.y1 - f.y0 - 0.1, 0.045, 0.015, { mat: seam });
      } else {
        fpanel(b, f, '#5a626e');
        for (let k = -0.75; k <= 0.75; k += 0.5) fbox(b, f, '#3a414c', k, (f.y0 + f.y1) / 2, 0.06, f.y1 - f.y0 - 0.1, 0.045, 0.015, { rz: 0.6 });
        fbox(b, f, '#ffd23f', 0, f.y1 - 0.08, 2, 0.08);
      }
    }
    // 伺服器機櫃（東側棋盤外，≤6 m）＋閃爍 LED
    const ledP = [], ledC = [];
    for (let z = 3; z <= 21; z += 2.2) {
      b.box(1.6, 5.4, 2.0, '#12151c', 26.2, 2.7, z);
      for (let y = 0.6; y < 5.2; y += 0.35) for (let k = -0.7; k <= 0.7; k += 0.35) { ledP.push(25.36, y, z + k); ledC.push(...rgb(R() < 0.7 ? '#3ff0d8' : R() < 0.5 ? '#a8ff4a' : '#ff4a6a')); }
    }
    const leds = dots(ledP, ledC, 0.16, { add: true }); root.add(leds);
    // 王座背板巨碑＋光暈
    b.box(2, 15, 14, '#0e1118', 31.5, 7.5, 12);
    const halo = ownFlat('#3ff0d8', { opacity: 0.22, add: true, depthWrite: false, ds: true });
    for (const [h, w] of [[16, 15.4], [17.5, 17]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), halo); m.position.set(30.4, h / 2, 12); m.rotation.y = -Math.PI / 2; root.add(m); }
    b.box(0.2, 13.6, 0.25, null, 30.45, 7.5, 5.3, { mat: seam }); b.box(0.2, 13.6, 0.25, null, 30.45, 7.5, 18.7, { mat: seam }); b.box(0.2, 0.25, 13.6, null, 30.45, 14.3, 12, { mat: seam });
    sign(root, 'DISRUPT\nEVERYTHING', 8, 30.35, 9.5, 12, -Math.PI / 2, { color: '#e8fffa', size: 72 });
    // 空調、天線、衛星碟
    for (const [x, z] of [[-4, -4], [-4, 28], [28, -4], [28, 28], [-5, 12]]) { b.box(2.4, 1.3, 2.4, '#8a929e', x, 0.65, z); b.cyl(0.8, 0.8, 0.1, '#3a414c', x, 1.33, z, { seg: 12, ol: false }); }
    b.cyl(0.15, 0.25, 16, '#8a929e', -6, 8, -6, { seg: 6 }); b.cyl(0.15, 0.25, 12, '#8a929e', 30, 6, 30, { seg: 6 });
    const red = ownFlat('#ff2a2a');
    b.sph(0.35, null, -6, 16.2, -6, { mat: red, seg: 8 }); b.sph(0.35, null, 30, 12.2, 30, { mat: red, seg: 8 });
    b.cone(1.2, 0.6, '#d8dce2', -5.5, 1.6, 30, { rx: -0.8, seg: 14 });
    // 城市：遠處建築＋窗燈
    const cp = [], cc = [];
    for (let i = 0; i < 90; i++) {
      const a = R() * Math.PI * 2, r = 34 + R() * 80, x = 12 + Math.cos(a) * r, z = 12 + Math.sin(a) * r;
      const w = 6 + R() * 10, d = 6 + R() * 10, top = -46 + R() * 30 + (r > 90 ? 8 : 0), base = -120;
      const h = top - base;
      b.box(w, h, d, R() < 0.5 ? '#1a2030' : '#232a3a', x, base + h / 2, z, { ol: false, r: 0 });
      for (let k = 0; k < 36; k++) {
        const side = R() < 0.5, u = R() - 0.5, sgn = R() < 0.5 ? -0.51 : 0.51, y = top - 1 - Math.floor(R() * 14) * 2.6;
        cp.push(side ? x + u * w : x + sgn * w, y, side ? z + sgn * d : z + u * d);
        cc.push(...rgb(R() < 0.75 ? '#ffd890' : R() < 0.5 ? '#9ae0ff' : '#ff7a5a'));
      }
      if (R() < 0.15) cp.push(x, top + 1, z), cc.push(...rgb('#ff2a2a'));
    }
    root.add(dots(cp, cc, 1.6, { fog: false }));
    // 對面大樓廣告看板
    b.box(1, 10, 22, '#0e1118', -46, 6, 12);
    sign(root, 'SUBSCRIBE+\nNOW WITH MORE TERMS', 18, -45.4, 6, 12, Math.PI / 2, { color: '#ffcf3a', stroke: '#3a1a00', size: 72 });
    // 探照燈
    const beamM = ownFlat('#fff4d0', { opacity: 0.07, add: true, depthWrite: false, ds: true });
    const beams = [];
    for (const [x, z] of [[-60, -40], [80, 70]]) { const g = new THREE.Group(); g.position.set(x, -20, z); const c = new THREE.Mesh(new THREE.ConeGeometry(5, 120, 16, 1, true), beamM); c.position.y = 60; c.rotation.x = Math.PI; g.add(c); root.add(g); beams.push(g); }
    anims.push(t => {
      beams.forEach((g, i) => { g.rotation.z = Math.sin(t * 0.3 + i * 2) * 0.35; g.rotation.x = Math.cos(t * 0.23 + i) * 0.25; });
      leds.material.opacity = 0.7 + 0.3 * Math.sin(t * 9);
      red.color.set(Math.sin(t * 3) > 0.6 ? '#ff2a2a' : '#4a0a0a');
      halo.opacity = 0.18 + Math.sin(t * 1.4) * 0.06;
    });
  },

  // 10. 超級盃中場秀：看台與觀眾燈點、LED 桁架塔、光纖電纜、光束、大螢幕
  stage({ root, b, anims, R, rows }) {
    groundRing(b, '#1e5a30');
    // 球場標線與達陣區（看台內 X -16..40、Z -12..36）
    for (let x = -12; x <= 36; x += 4.57) if (x < -0.5 || x > 24.5) b.flatQuad(0.25, 48, '#f4f4f4', x, GY + 0.012, 12);
    for (let x = -12; x <= 36; x += 0.914) for (const z of [-1.8, 25.8]) if (x < -0.5 || x > 24.5) b.flatQuad(0.12, 0.6, '#f4f4f4', x, GY + 0.012, z);
    b.flatQuad(4, 48, '#c41e5a', -14, GY + 0.011, 12); b.flatQuad(4, 48, '#1f8a9a', 38, GY + 0.011, 12);
    floorText(root, 'SKIP', 3.4, -14, GY + 0.03, 12, Math.PI / 2, { color: '#fff', size: 80 });
    floorText(root, 'AD', 2.4, 38, GY + 0.03, 12, -Math.PI / 2, { color: '#fff', size: 80 });
    // 舞台側板：黑底＋霓虹邊
    const rim = ownFlat('#ff2a8a'), rim2 = ownFlat('#3ff0d8');
    for (const f of faces(rows)) {
      fpanel(b, f, '#1a1626');
      fbox(b, f, null, 0, f.y1 - 0.05, 2, 0.05, 0.045, 0.015, { mat: f.h === 3 ? rim2 : rim });
      if (f.y1 - f.y0 > 0.9) for (let k = 0; k < 3; k++) fbox(b, f, '#2a2440', -0.6 + k * 0.6, (f.y0 + f.y1) / 2, 0.45, (f.y1 - f.y0) * 0.6);
    }
    // 舞台裙（棋盤外緣下方）
    // # 格：巨型喇叭塔（不可走，高度 3.1 明顯不同於 h3）
    for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) if (rows[z][x] === '#') {
      const cx = W(x), cz = W(z);
      b.box(1.96, 3.8, 1.96, '#121018', cx, 3.1 - 1.9, cz, { r: 0.08 });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = cell(rows, x + dx, z + dz); if (n === '#') continue;
        const px = cx + dx * 1.0, pz = cz + dz * 1.0, rr = dx ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 };
        b.cyl(0.55, 0.55, 0.04, '#3a3448', px, 2.15, pz, { ...rr, ol: false, seg: 16 }); b.cyl(0.22, 0.22, 0.06, '#0a0a0e', px, 2.15, pz, { ...rr, ol: false, seg: 12 });
        b.cyl(0.32, 0.32, 0.04, '#3a3448', px, 1.0, pz, { ...rr, ol: false, seg: 14 });
      }
      b.box(1.9, 0.05, 1.9, null, cx, 3.02, cz, { mat: rim, r: 0 });
    }
    // 桁架塔（棋盤四角外，≤6 m）＋地上的 LED 桁架
    const truss = (x, z, h) => {
      for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) b.cyl(0.06, 0.06, h, '#c9ccd1', x + dx, h / 2, z + dz, { seg: 5, ol: false });
      for (let y = 0.5; y < h; y += 0.8) { b.box(0.86, 0.05, 0.05, '#c9ccd1', x, y, z - 0.4, { ol: false, rz: 0.7 }); b.box(0.86, 0.05, 0.05, '#c9ccd1', x, y, z + 0.4, { ol: false, rz: -0.7 }); b.box(0.05, 0.05, 0.86, '#c9ccd1', x - 0.4, y, z, { ol: false, rx: 0.7 }); b.box(0.05, 0.05, 0.86, '#c9ccd1', x + 0.4, y, z, { ol: false, rx: -0.7 }); }
      b.box(1.2, 0.5, 1.2, '#2a2440', x, h + 0.25, z);
    };
    for (const [x, z] of [[-3, -3], [27, -3], [-3, 27], [27, 27]]) truss(x, z, 5.4);
    const strip = ownFlat('#ff2a8a');
    for (const [w, d, x, z] of [[24, 0.5, 12, -1.6], [24, 0.5, 12, 25.6], [0.5, 24, -1.6, 12], [0.5, 24, 25.6, 12]]) { b.box(w, 0.45, d, '#2a2440', x, 0.22, z); b.box(w > 1 ? w * 0.98 : 0.12, 0.05, d > 1 ? d * 0.98 : 0.12, null, x, 0.46, z, { mat: strip, r: 0 }); }
    // 光纖電纜（地面）
    const fibA = ownFlat('#3ff0d8'), fibB = ownFlat('#ff2a8a');
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + 0.2, sx = 12 + Math.cos(a) * 15, sz = 12 + Math.sin(a) * 15;
      const ex = 12 + Math.cos(a + 0.4) * 26, ez = 12 + Math.sin(a + 0.4) * 21;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sx, 0.15, sz), new THREE.Vector3(lerp(sx, ex, 0.4) + Math.sin(i) * 3, 0.25, lerp(sz, ez, 0.4) + Math.cos(i) * 3), new THREE.Vector3(ex, 0.15, ez)]);
      b.add(new THREE.TubeGeometry(curve, 24, 0.13, 5), null, 0, 0, 0, { mat: i % 2 ? fibA : fibB });
    }
    // 看台（長方形體育場，四邊 8 階，離棋盤 12–16 m 起）＋觀眾燈點
    const cpA = [], ccA = [], cpB = [], ccB = [];
    const pal = ['#ffffff', '#ffe14d', '#ff2a8a', '#3ff0d8', '#ff8a3a'].map(rgb);
    const X0 = -16, X1 = 40, Z0 = -12, Z1 = 36;
    for (let k = 0; k < 8; k++) {
      const off = k * 3.0, y = 1.6 + k * 2.1;
      const sides = [[(X0 + X1) / 2, Z0 - off, X1 - X0 + off * 2, 0], [(X0 + X1) / 2, Z1 + off, X1 - X0 + off * 2, 0], [X0 - off, (Z0 + Z1) / 2, Z1 - Z0 + off * 2, 1], [X1 + off, (Z0 + Z1) / 2, Z1 - Z0 + off * 2, 1]];
      for (const [x, z, len, vert] of sides) {
        b.box(vert ? 3.0 : len + 3, y, vert ? len + 3 : 3.0, k % 2 ? '#2a2236' : '#332a42', x, y / 2, z, { ol: false, r: 0 });
        const n = Math.floor(len / 0.7);
        for (let i = 0; i < n; i++) for (const dd of [-0.6, 0.6]) {
          const u = -len / 2 + (i + R()) * (len / n);
          const p = vert ? [x + dd, y + 0.45, z + u] : [x + u, y + 0.45, z + dd];
          const A = R() < 0.5;
          (A ? cpA : cpB).push(...p); (A ? ccA : ccB).push(...pal[(R() * pal.length) | 0]);
        }
      }
    }
    // 看台前緣廣告帶
    const adBand = ownFlat('#ff2a8a');
    for (const [w, d, x, z] of [[56, 0.1, 12, Z0 + 1.55], [56, 0.1, 12, Z1 - 1.55], [0.1, 48, X0 + 1.55, 12], [0.1, 48, X1 - 1.55, 12]]) b.box(w, 0.8, d, null, x, 1.2, z, { mat: adBand, r: 0 });
    for (const [x, z, ry, t] of [[4, Z0 + 1.62, 0, 'SKIP AD ▶'], [20, Z0 + 1.62, 0, 'BUY NOW'], [4, Z1 - 1.62, Math.PI, 'SUBSCRIBE'], [20, Z1 - 1.62, Math.PI, 'AUTO-RENEW ON'], [X0 + 1.62, 12, Math.PI / 2, 'TERMS APPLY'], [X1 - 1.62, 12, -Math.PI / 2, '30 SEC LEFT']]) sign(root, t, 5, x, 1.2, z, ry, { color: '#fff', size: 56 });
    const crowdA = dots(cpA, ccA, 0.75, { fog: false }), crowdB = dots(cpB, ccB, 0.75, { fog: false });
    root.add(crowdA, crowdB);
    // 燈塔（體育場四角外）
    const lampM = ownFlat('#fffbe8', { fog: false });
    for (const [x, z] of [[X0 - 22, Z0 - 20], [X1 + 22, Z0 - 20], [X0 - 22, Z1 + 20], [X1 + 22, Z1 + 20]]) {
      const ry = Math.atan2(12 - x, 12 - z);
      b.cyl(0.7, 1.1, 34, '#3a3448', x, 17, z, { seg: 8, ol: false });
      b.box(9, 5, 1, '#3a3448', x, 35, z, { ry, ol: false });
      b.box(8.4, 4.4, 0.3, null, x + Math.sin(ry) * 0.6, 35, z + Math.cos(ry) * 0.6, { ry, mat: lampM, r: 0 });
    }
    // 大螢幕（兩端看台頂）
    for (const [x, ry, txt] of [[X0 - 25, Math.PI / 2, 'AD 1 OF 47\nSKIP IN 30…'], [X1 + 25, -Math.PI / 2, 'YOUR TRIAL\nENDS TODAY']]) {
      b.box(1.6, 14, 28, '#14101c', x, 25, 12, { ol: false });
      sign(root, txt, 25, x + (ry > 0 ? 0.85 : -0.85), 25, 12, ry, { bg: '#ff2a8a', color: '#fff', size: 72 });
    }
    // 掃動光束
    const beamM = ownFlat('#ffe8fa', { opacity: 0.08, add: true, depthWrite: false, ds: true });
    const beamC = ownFlat('#7af8ff', { opacity: 0.08, add: true, depthWrite: false, ds: true });
    const beams = [];
    for (const [i, [x, z]] of [[-3, -3], [27, -3], [-3, 27], [27, 27], [-20, -16], [44, -16], [-20, 40], [44, 40]].entries()) {
      const g = new THREE.Group(); g.position.set(x, i < 4 ? 5.9 : 0.5, z);
      const c = new THREE.Mesh(new THREE.ConeGeometry(i < 4 ? 2.4 : 4, 70, 14, 1, true), i % 2 ? beamM : beamC);
      c.position.y = 35; c.rotation.x = Math.PI; g.add(c); root.add(g); beams.push(g);
    }
    // 星空
    const sp = [], sc = [];
    for (let i = 0; i < 260; i++) { const a = R() * Math.PI * 2, e = 0.25 + R() * 1.1, r = 200; sp.push(12 + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, 12 + Math.sin(a) * Math.cos(e) * r); sc.push(1, 1, 1); }
    root.add(dots(sp, sc, 1.2, { fog: false, op: 0.8 }));
    anims.push(t => {
      beams.forEach((g, i) => { const out = Math.atan2(g.position.x - 12, g.position.z - 12); g.rotation.order = 'YXZ'; g.rotation.y = out; g.rotation.x = 0.35 + Math.sin(t * 0.9 + i * 1.7) * 0.3; g.rotation.z = Math.sin(t * 0.6 + i) * 0.4; });
      crowdA.material.opacity = 0.55 + 0.45 * Math.max(0, Math.sin(t * 3.1));
      crowdB.material.opacity = 0.55 + 0.45 * Math.max(0, Math.sin(t * 3.1 + 2));
      const h = (t * 0.08) % 1;
      strip.color.setHSL(0.92 + Math.sin(t * 1.3) * 0.06, 1, 0.55); adBand.color.setHSL(0.92, 1, 0.45 + 0.1 * Math.sin(t * 3)); rim.color.setHSL(Math.sin(t * 0.8) > 0 ? 0.92 : 0.5, 1, 0.55 + 0.08 * Math.sin(t * 5)); rim2.color.setHSL(0.13, 1, 0.6 + 0.1 * Math.sin(t * 3));
      fibA.color.setHSL(0.48, 1, 0.45 + 0.2 * Math.sin(t * 4)); fibB.color.setHSL(0.92, 1, 0.45 + 0.2 * Math.sin(t * 4 + 2));
    });
  },
};

// ── 各主題追加的動態點綴與棋盤貼花 ───────────────────────
// 規則同上：棋盤外 4 m 內 ≤6 m；更遠處高度約 ≤ 2.4 ×（離棋盤距離）。
const EXTRA = {
  desert(ctx) {
    const { root, b, anims, R } = ctx;
    boardDecals(ctx, {
      crack: 0.14, crackC: '#6a3a22', stain: 0.08, stainC: '#7a4a2a',
      bits: (x, y, z) => { // 風吹出的沙紋
        const a = 0.35 + (R() - 0.5) * 0.3;
        for (let k = 0; k < 2; k++) for (let j = -2; j <= 2; j++) b.flatQuad(0.36, 0.07, '#f6d6a0', x + k * 0.1 + j * 0.33, y, z + k * 0.22 + Math.abs(j) * 0.05, { flat: true, op: 0.4, ry: a - j * 0.18 });
      }, bitP: 0.12,
    });
    // 電線桿之間下垂的電線（併入 Batch）
    for (let z = -60; z < 75; z += 15) for (const dx of [-0.9, 0.9]) {
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-12 + dx, 7.05, z), new THREE.Vector3(-12 + dx, 6.1, z + 7.5), new THREE.Vector3(-12 + dx, 7.05, z + 15)]);
      b.add(new THREE.TubeGeometry(c, 10, 0.035, 4), '#2a2026', 0, 0, 0, { ol: false });
    }
    // 遠方台地剪影
    ridge(ctx, 150, 28, 10, 26, '#b4523a', 'mesa', { cap: '#e09060', fade: 0.3 });
    ridge(ctx, 200, 22, 16, 34, '#a04838', 'mesa', { fade: 0.55 });
    clouds(ctx, 8, '#fff3e4', { y: 38 });
    // 禿鷹盤旋在墜毀母艦上空
    birds(ctx, 5, 37, -9, 8, 15, { color: '#2a1e22', speed: 0.2, scale: 1.4, flap: 3 });
    // 風滾草（細枝環合成一顆，沿風向滾過棋盤外）
    const twig = [];
    for (let k = 0; k < 5; k++) { const g = new THREE.TorusGeometry(0.62, 0.035, 4, 14); g.rotateX(k * 1.1); g.rotateY(k * 0.7); twig.push([g, new THREE.Matrix4()]); }
    const TW = inst(root, merge(twig), ownToon('#b8915e'), 5, { ol: true });
    const lanes = [[-4.6, 0.1], [28.8, 0.13], [-14, 0.08], [37, 0.11], [31, 0.09]];
    anims.push(t => {
      lanes.forEach(([z, sp], i) => {
        const k = fract(i * 0.37 + t * sp * 0.25), x = 70 - k * 130, s = 0.8 + (i % 3) * 0.2;
        const hop = Math.abs(Math.sin(t * 2.6 + i * 2)) * 0.7;
        TW.set(i, x, 0.62 * s + hop, z + Math.sin(t * 0.7 + i) * 0.8, 0, i, x / (0.62 * s), s);
      });
      TW.done();
    });
    // 塵捲風（點雲螺旋，繞著棋盤外慢慢移動）
    const dn = 60, dp = [], dc = [];
    for (let i = 0; i < dn; i++) { dp.push(0, 0, 0); dc.push(...rgb(i % 2 ? '#e8c08a' : '#c99a64')); }
    const dust = dots(dp, dc, 0.5, { op: 0.75 }); root.add(dust);
    const da = dust.geometry.attributes.position;
    anims.push(t => {
      const ca = t * 0.05, cx = 12 + Math.cos(ca) * 27, cz = 12 + Math.sin(ca) * 24;
      for (let i = 0; i < dn; i++) { const h = fract(i / dn + t * 0.15) * 6, a = i * 2.4 + t * 5, r = 0.3 + h * 0.35; da.array[i * 3] = cx + Math.cos(a) * r; da.array[i * 3 + 1] = h; da.array[i * 3 + 2] = cz + Math.sin(a) * r; }
      da.needsUpdate = true;
    });
    // 抽水風車（西北遠側）：鋼架塔＋轉動的扇葉＋尾翼
    const wx = -30, wz = 32, wh = 11;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.cyl(0.07, 0.07, wh, '#8a8f96', wx + dx * 0.9, wh / 2, wz + dz * 0.9, { seg: 5, rx: -dz * 0.07, rz: dx * 0.07, ol: false });
    for (let y = 2; y < wh; y += 2.5) { const w = 1.8 - y * 0.1; b.box(w * 2, 0.06, 0.06, '#8a8f96', wx, y, wz - w, { ol: false }); b.box(w * 2, 0.06, 0.06, '#8a8f96', wx, y, wz + w, { ol: false }); b.box(0.06, 0.06, w * 2, '#8a8f96', wx - w, y, wz, { ol: false }); b.box(0.06, 0.06, w * 2, '#8a8f96', wx + w, y, wz, { ol: false }); }
    b.box(0.9, 0.5, 0.6, '#5a5e66', wx, wh + 0.2, wz);
    b.box(0.08, 1.4, 2.6, '#d8342c', wx, wh + 0.4, wz + 2.0);
    b.cyl(0.05, 0.05, 2.0, '#5a5e66', wx, wh + 0.25, wz + 1.0, { rx: Math.PI / 2, seg: 5, ol: false });
    b.cyl(1.4, 1.4, 0.3, '#6a6e76', wx - 1.5, 0.15, wz + 1.5, { seg: 14 });
    spinGroup(ctx, wx, wh + 0.25, wz - 0.45, sb => {
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; sb.box(0.32, 1.7, 0.04, k % 2 ? '#e8e2d0' : '#c9c2ae', Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0, { rz: a - Math.PI / 2 + 0.3, r: 0.01 }); }
      sb.tor(2.05, 0.05, '#5a5e66', 0, 0, 0, { seg: 20, ol: false });
      sb.cyl(0.25, 0.25, 0.3, '#5a5e66', 0, 0, 0, { rx: Math.PI / 2, seg: 10 });
    }, (g, t) => { g.rotation.z = t * 1.6; });
  },
  parking(ctx) {
    const { root, b, anims, R } = ctx;
    boardDecals(ctx, {
      crack: 0.12, crackC: '#22252b', crackOp: 0.45, stain: 0.14, stainC: '#15171b', stainOp: 0.3,
      bits: (x, y, z) => { // 口香糖點與輪胎煞車痕
        if (R() < 0.5) for (let k = 0; k < 4; k++) b.disc(0.05 + R() * 0.04, '#d8d8d2', x + (R() - 0.5) * 1.2, y, z + (R() - 0.5) * 1.2, { flat: true, op: 0.55, seg: 6 });
        else { const a = R() * 3; for (const o of [-0.22, 0.22]) b.flatQuad(1.5, 0.16, '#121316', x + Math.sin(a) * o, y, z + Math.cos(a) * o, { flat: true, op: 0.3, ry: a }); }
      },
    });
    ridge(ctx, 140, 34, 8, 30, '#3a3550', 'city', { fade: 0.4 });
    ridge(ctx, 190, 26, 14, 30, '#5a4060', 'hill', { fade: 0.6 });
    clouds(ctx, 7, '#f6a6a8', { y: 40 });
    // 停車場海鷗
    birds(ctx, 6, 0, 12, 24, 13, { color: '#f4f4f0', speed: 0.3, scale: 0.9, flap: 6 });
    // 充氣跳舞人（量販店門口招客）
    tubeMan(ctx, -4.4, 12, '#ff3a3a', '#ffe14d');
    tubeMan(ctx, 12, -4.6, '#3ac8ff', '#ff6fd0');
    // 被風吹著慢慢滑動的購物車
    const cart = new THREE.Group(); root.add(cart);
    const cb = new Batch();
    cb.box(1.1, 0.6, 0.7, '#c9ccd1', 0, 0.75, 0, { op: 1 }); cb.box(1.0, 0.05, 0.6, '#8a929e', 0, 0.42, 0);
    cb.cyl(0.04, 0.04, 0.8, '#e8752c', -0.62, 1.05, 0, { rx: Math.PI / 2, seg: 6 });
    for (const [x, z] of [[-0.4, -0.25], [-0.4, 0.25], [0.4, -0.25], [0.4, 0.25]]) { cb.cyl(0.02, 0.02, 0.36, '#8a929e', x, 0.25, z, { seg: 4, ol: false }); cb.cyl(0.07, 0.07, 0.04, '#1c1c20', x, 0.07, z, { rx: Math.PI / 2, seg: 8 }); }
    cb.build(cart);
    anims.push(t => { const u = Math.sin(t * 0.13) * 0.5 + 0.5; cart.position.set(-9.2 + Math.sin(t * 0.2) * 0.6, 0, lerp(-6, 30, u)); cart.rotation.y = Math.PI / 2 + Math.sin(t * 0.3) * 0.35; cart.rotation.z = Math.sin(t * 9) * 0.01; });
    // 防盜警報響個不停的車（雙黃燈閃）
    const haz = ownFlat('#ffb21f');
    car(b, -12.2 + 0.0, 31.25, Math.PI, '#7a5cd6', { lightMat: haz });
    anims.push(t => haz.color.set(Math.floor(t * 2.5) % 2 ? '#ffd23f' : '#3a2a10'));
  },

  suburb(ctx) {
    const { root, b, anims, R, rows } = ctx;
    // 割草條紋＋小花＋零星裂縫
    for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) if (rows[z][x] === '0' && x % 2 === 0) b.flatQuad(2, 2, '#bff59a', W(x), 0.011, W(z), { flat: true, op: 0.13 });
    boardDecals(ctx, {
      crack: 0.06, crackC: '#5a4a36', stain: 0.06, stainC: '#3a7a2a', stainOp: 0.18,
      bits: (x, y, z, gx, gz) => {
        if (rows[gz][gx] !== '0') return;
        for (let k = 0; k < 5; k++) { const px = x + (R() - 0.5) * 1.4, pz = z + (R() - 0.5) * 1.4; b.disc(0.07, ['#ffffff', '#ffe14d', '#ff9ad0'][k % 3], px, y + 0.002, pz, { flat: true, seg: 6 }); b.disc(0.13, '#3f9a2e', px, y, pz, { flat: true, op: 0.4, seg: 6 }); }
      }, bitP: 0.25,
    });
    ridge(ctx, 130, 30, 6, 16, '#4caa48', 'hill', { fade: 0.35 });
    ridge(ctx, 175, 40, 10, 22, '#2f7a3a', 'pine', { fade: 0.5 });
    // 遠方水塔
    b.cyl(0.35, 0.35, 16, '#9aa1a8', -46, 8, -38, { seg: 6 }); b.cyl(4, 4, 3.5, '#bfe0ff', -46, 17, -38, { seg: 16 }); b.cone(4.2, 2, '#9aa1a8', -46, 19.7, -38, { seg: 16 });
    sign(root, 'SUNNY ACRES', 6, -46 + 2.9, 17, -38 + 2.9, Math.PI / 4, { color: '#2d5a3a', size: 56 });
    clouds(ctx, 9, '#ffffff', { y: 36 });
    birds(ctx, 6, 12, 12, 26, 14, { color: '#2f5aa8', speed: 0.35, scale: 0.6, flap: 12 });
    // 蝴蝶（棋盤外低空晃）
    motes(ctx, 26, [-12, 36, 0.5, 2.2, -12, 36], ['#ffd23f', '#ff9ad0', '#ffffff'], 0.35, { add: false, out: 1.5 });
    // 擺動式灑水器（四座，水滴點雲沿拋物線噴灑）
    const spr = [[0, -5.6, 0], [12, -5.6, 0], [6, 29.6, Math.PI], [18, 29.6, Math.PI]];
    const per = 26, sp = [], sc = [];
    for (const [x, z] of spr) { b.cyl(0.25, 0.3, 0.12, '#ffd23f', x, 0.06, z, { seg: 8 }); b.cyl(0.04, 0.04, 0.5, '#2f7fd8', x, 0.3, z, { seg: 5, ol: false }); for (let i = 0; i < per; i++) { sp.push(x, 0, z); sc.push(...rgb(i % 3 ? '#bfe8ff' : '#ffffff')); } }
    const water = dots(sp, sc, 0.18, { op: 0.9 }); root.add(water);
    const wa = water.geometry.attributes.position;
    anims.push(t => {
      spr.forEach(([x, z, f], s) => {
        const sweep = f + Math.PI / 2 + Math.sin(t * 0.7 + s) * 1.1;
        for (let i = 0; i < per; i++) {
          const k = fract(i / per + t * 0.9), a = sweep + Math.sin(i * 7.3) * 0.12, d = k * 3.2, j = (s * per + i) * 3;
          wa.array[j] = x + Math.cos(a) * d; wa.array[j + 1] = 0.5 + 4 * k * (1 - k) * 1.3; wa.array[j + 2] = z + Math.sin(a) * d;
        }
      });
      wa.needsUpdate = true;
    });
    // 旗桿上的社區旗（原創圖案：小房子）
    const fx = -8.5, fz = 3.2;
    b.cyl(0.07, 0.09, 7, '#e8e8e8', fx, 3.5, fz, { seg: 8 }); b.sph(0.16, '#ffd23f', fx, 7.05, fz, { seg: 8 });
    const htex = flagTex((x, w, h) => {
      x.fillStyle = '#2d7a4a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff1a8'; x.fillRect(0, h * 0.78, w, h * 0.22);
      x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(w * 0.3, h * 0.45); x.lineTo(w * 0.5, h * 0.18); x.lineTo(w * 0.7, h * 0.45); x.fill(); x.fillRect(w * 0.35, h * 0.45, w * 0.3, h * 0.28);
      x.fillStyle = '#e8473b'; x.fillRect(w * 0.46, h * 0.56, w * 0.08, h * 0.17);
    });
    waveFlag(ctx, fx, 6.2, fz, 0.6, 2.2, 1.35, htex, { speed: 4 });
    // 盪鞦韆
    const swx = -9.6, swz = 19;
    for (const dz of [-1.6, 1.6]) { b.cyl(0.07, 0.07, 2.9, '#d8342c', swx - 0.7, 1.4, swz + dz, { rx: 0, rz: 0.25, seg: 6 }); b.cyl(0.07, 0.07, 2.9, '#d8342c', swx + 0.7, 1.4, swz + dz, { rz: -0.25, seg: 6 }); }
    b.cyl(0.08, 0.08, 3.4, '#ffd23f', swx, 2.8, swz, { rx: Math.PI / 2, seg: 8 });
    const swings = [-0.7, 0.7].map((dz, i) => {
      const g = new THREE.Group(); g.position.set(swx, 2.8, swz + dz); root.add(g);
      const sb = new Batch(); sb.cyl(0.015, 0.015, 2.1, '#9aa1a8', -0.22, -1.05, 0, { seg: 4, ol: false }); sb.cyl(0.015, 0.015, 2.1, '#9aa1a8', 0.22, -1.05, 0, { seg: 4, ol: false }); sb.box(0.6, 0.06, 0.28, i ? '#2f7fd8' : '#3fa35a', 0, -2.1, 0); sb.build(g);
      return g;
    });
    anims.push(t => swings.forEach((g, i) => { g.rotation.z = Math.sin(t * 2.1 + i * 2.2) * (0.35 + 0.15 * Math.sin(t * 0.2 + i)); }));
    // 機器人割草機在北側草坪來回
    const mow = new THREE.Group(); root.add(mow);
    const mb = new Batch(); mb.box(0.9, 0.3, 0.6, '#ff8a3a', 0, 0.25, 0); mb.box(0.5, 0.12, 0.4, '#2a2a2e', 0.05, 0.45, 0); mb.sph(0.05, '#5dff9a', 0.3, 0.54, 0, { flat: true, seg: 6 });
    for (const [x, z] of [[-0.3, -0.33], [-0.3, 0.33], [0.3, -0.33], [0.3, 0.33]]) mb.cyl(0.11, 0.11, 0.06, '#1c1c20', x, 0.11, z, { rx: Math.PI / 2, seg: 8 });
    mb.build(mow);
    anims.push(t => { const ph = fract(t * 0.035), u = ph < 0.5 ? ph * 2 : 2 - ph * 2; mow.position.set(lerp(-8, 25, u), 0, -4.3 + Math.sin(t * 0.5) * 0.25); mow.rotation.y = ph < 0.5 ? 0 : Math.PI; });
  },

  swamp(ctx) {
    const { root, b, anims, R } = ctx;
    boardDecals(ctx, {
      crack: 0.06, crackC: '#33291a', stain: 0.16, stainC: '#4a3a1c', stainOp: 0.25,
      bits: (x, y, z) => { for (let k = 0; k < 4; k++) b.disc(0.12, ['#6a7a2a', '#8a6a2a', '#4a6a24'][k % 3], x + (R() - 0.5) * 1.4, y, z + (R() - 0.5) * 1.4, { flat: true, sz: 0.5, ry: R() * 3, seg: 6, op: 0.85 }); },
    });
    ridge(ctx, 140, 34, 10, 22, '#3f5a2a', 'hill', { fade: 0.4 });
    clouds(ctx, 6, '#fff6d8', { y: 34 });
    // 螢火蟲
    motes(ctx, 70, [-14, 38, 0.4, 3.2, -14, 38], ['#e8ff6a', '#b8ff4a'], 0.28, { blink: 3.3 });
    // 蜻蜓
    birds(ctx, 5, -12, -10, 5, 1.8, { color: '#2fb7a8', speed: 0.9, scale: 0.3, flap: 40 });
    birds(ctx, 4, 36, 30, 6, 2.0, { color: '#d85aa8', speed: 0.8, scale: 0.3, flap: 40 });
    // 水塘裡游的鱷魚（只露眼睛與背）
    for (const [px, pz, pr] of [[-12, -10, 9], [36, 30, 11]]) {
      const g = new THREE.Group(); root.add(g);
      const gb = new Batch(), gc = '#3e6a2c';
      gb.sph(0.9, gc, 0, 0, 0, { sx: 1.9, sy: 0.35, sz: 0.9, seg: 10 });
      gb.box(1.1, 0.24, 0.55, gc, 1.9, 0.0, 0, { r: 0.1 });
      for (const s of [-1, 1]) { gb.sph(0.2, gc, 1.15, 0.22, s * 0.3, { seg: 8 }); gb.sph(0.13, '#ffe14d', 1.2, 0.3, s * 0.3, { seg: 8, ol: false }); gb.box(0.05, 0.16, 0.05, '#111111', 1.32, 0.31, s * 0.3, { ol: false, r: 0 }); gb.sph(0.05, '#1a2a12', 2.42, 0.12, s * 0.12, { seg: 5, ol: false }); }
      for (let k = 0; k < 4; k++) gb.cone(0.12, 0.25, '#2e5220', -0.6 - k * 0.45, 0.28, 0, { seg: 4 });
      gb.build(g);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.0, 24).rotateX(-Math.PI / 2), ownFlat('#cfe8a0', { opacity: 0.35 }));
      ring.raycast = () => {}; root.add(ring);
      const ph = R() * 6;
      anims.push(t => {
        const a = ph + t * 0.12, r = pr * 0.4, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
        const dip = Math.max(0, Math.sin(t * 0.25 + ph)) ** 6;
        g.position.set(x, -0.05 - dip * 0.45 + Math.sin(t * 1.3) * 0.03, z); g.rotation.y = -a - Math.PI / 2;
        ring.position.set(x, GY + 0.03, z); const k = fract(t * 0.5); ring.scale.setScalar(0.8 + k * 0.9); ring.material.opacity = 0.35 * (1 - k);
      });
    }
    // 餌料小屋的捕蚊燈（藍光閃、偶爾劈啪）
    const zap = ownFlat('#5ad8ff');
    b.box(0.5, 0.7, 0.5, null, -11.4, 2.4, -3.6, { mat: zap, r: 0 }); b.box(0.6, 0.08, 0.6, '#2a2a2e', -11.4, 2.8, -3.6); b.cyl(0.01, 0.01, 0.6, '#2a2a2e', -11.4, 3.1, -3.6, { seg: 4, ol: false });
    anims.push(t => { const z = (Math.sin(t * 13) + Math.sin(t * 7.7)) > 1.6; zap.color.set(z ? '#ffffff' : '#5ad8ff'); });
    // 貼地薄霧
    const mist = ownFlat('#f4ffe8', { opacity: 0.12 });
    const MI = inst(root, new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), mist, 8);
    const mp = []; for (let i = 0; i < 8; i++) mp.push([R(), 6 + R() * 6, R() * 6]);
    anims.push(t => { mp.forEach(([u, s, ph], i) => { const a = u * 6.28 + t * 0.02; const r = 20 + Math.sin(t * 0.1 + ph) * 3; MI.set(i, 12 + Math.cos(a) * r, 0.2 + i * 0.01, 12 + Math.sin(a) * r, 0, 0, 0, s, 1, s * 0.6); }); MI.done(); });
  },

  temple(ctx) {
    const { root, b, anims, R } = ctx;
    boardDecals(ctx, {
      crack: 0.1, crackC: '#2a0a06', crackOp: 0.4, stain: 0.08, stainC: '#2a0a06', stainOp: 0.2,
      bits: (x, y, z) => { // 芝麻與番茄醬滴
        for (let k = 0; k < 6; k++) b.disc(0.05, '#fff4d8', x + (R() - 0.5) * 1.3, y, z + (R() - 0.5) * 1.3, { flat: true, sz: 0.5, ry: R() * 3, seg: 6 });
        b.disc(0.12 + R() * 0.1, '#c41e1a', x, y, z, { flat: true, seg: 8 });
      }, bitP: 0.12,
    });
    // 神聖氣泡（從地面緩緩升起）
    motes(ctx, 90, [-6, 30, 0, 14, -6, 30], ['#ffe58a', '#ff9a6a', '#ffffff'], 0.3, { mode: 'rise', speed: 0.05, out: 0.5 });
    // 巨杯冒出的汽水泡
    for (const z of [-4.5, 28.5]) motes(ctx, 24, [29.9, 32.9, 10.8, 16, z - 1.5, z + 1.5], ['#ffffff', '#ffd6c8'], 0.35, { mode: 'rise', speed: 0.18, add: false });
    // 祭壇上方旋轉的金色光環
    spinGroup(ctx, 31.2, 22.5, 12, sb => { sb.tor(4.2, 0.22, '#ffcf3a', 0, 0, 0, { seg: 28 }); sb.tor(3.4, 0.1, '#fff2b0', 0, 0, 0, { seg: 28, ol: false }); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; sb.cone(0.25, 0.8, '#ffcf3a', Math.cos(a) * 4.8, Math.sin(a) * 4.8, 0, { rz: a - Math.PI / 2, seg: 4 }); } }, (g, t) => { g.rotation.set(0, Math.PI / 2, t * 0.4); });
    // 從北牆高窗斜射的光束（棋盤外）
    const shaft = ownFlat('#ffcf8a', { opacity: 0.045, add: true, depthWrite: false, ds: true });
    const shafts = [];
    for (const x of [2, 12, 22]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 14), shaft); m.position.set(x, 6.2, -3.8); m.rotation.set(-0.55, 0, 0); m.raycast = () => {}; root.add(m); shafts.push(m); }
    anims.push(t => { shaft.opacity = 0.04 + Math.sin(t * 0.6) * 0.015; });
    // 入口兩側的香爐煙
    for (const [x, z] of [[-4.5, 6], [-4.5, 18]]) { b.cyl(0.5, 0.35, 0.6, '#c88a26', x, 1.25, z, { seg: 10 }); b.cyl(0.08, 0.12, 0.95, '#8a5a1a', x, 0.47, z, { seg: 6 }); smoke(root, anims, x, 1.6, z, { n: 4, rise: 3.5, size: 0.35, speed: 0.2, color: '#e8d8c8', op: 0.4, dx: 0.3 }); }
  },

  sewer(ctx) {
    const { root, b, anims, R } = ctx;
    boardDecals(ctx, {
      crack: 0.16, crackC: '#0a120e', crackOp: 0.55, stain: 0.12, stainC: '#3dff6a', stainOp: 0.07,
      bits: (x, y, z) => { b.disc(0.4 + R() * 0.3, '#7aa2b0', x, y, z, { flat: true, op: 0.22, sz: 0.6, seg: 12 }); b.disc(0.08, '#cfe8f0', x + 0.15, y + 0.001, z - 0.05, { flat: true, op: 0.5, sz: 0.5, seg: 6 }); },
    });
    // 從管線滴落的水滴＋地上漣漪
    const drips = [];
    for (let i = 0; i < 10; i++) drips.push([lerp(-6, 30, R()), i % 2 ? -6.6 : 30.6, R(), 0.45 + R() * 0.3]);
    const DR = inst(root, new THREE.SphereGeometry(0.07, 6, 5), ownFlat('#9ad8e8'), drips.length);
    const RP = inst(root, new THREE.RingGeometry(0.8, 1, 20).rotateX(-Math.PI / 2), ownFlat('#9ad8e8', { opacity: 0.4 }), drips.length);
    anims.push(t => {
      drips.forEach(([x, z, ph, sp], i) => {
        const k = fract(ph + t * sp), zz = z + (z < 0 ? 0.25 : -0.25);
        if (k < 0.6) { const f = k / 0.6; DR.set(i, x, 7.8 - f * f * 7.8, zz, 0, 0, 0, 1, 1.6, 1); RP.set(i, x, GY + 0.03, zz, 0, 0, 0, 0.001); }
        else { DR.set(i, x, -5, zz, 0, 0, 0, 0.001); const r = (k - 0.6) / 0.4; RP.set(i, x, GY + 0.03, zz, 0, 0, 0, 0.1 + r * 0.7); }
      });
      DR.done(); RP.done();
    });
    // 沿牆腳亂竄的老鼠
    const ratParts = [];
    { const bd = new THREE.CapsuleGeometry(0.16, 0.3, 3, 8).rotateX(Math.PI / 2); ratParts.push([bd, new THREE.Matrix4()]); const hd = new THREE.ConeGeometry(0.13, 0.3, 8).rotateX(Math.PI / 2); ratParts.push([hd, new THREE.Matrix4().makeTranslation(0, 0.02, 0.38)]); for (const s of [-1, 1]) ratParts.push([new THREE.SphereGeometry(0.07, 6, 4), new THREE.Matrix4().makeTranslation(s * 0.09, 0.14, 0.26)]); const tl = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, -0.3), new THREE.Vector3(0.1, 0.04, -0.6), new THREE.Vector3(-0.05, 0.02, -0.9)]), 6, 0.025, 3); ratParts.push([tl, new THREE.Matrix4()]); }
    const RT = inst(root, merge(ratParts), ownToon('#6a6a72'), 5, { ol: true });
    const rats = []; for (let i = 0; i < 5; i++) rats.push([i < 3 ? -6.3 : 30.3, R(), 0.04 + R() * 0.04]);
    anims.push(t => {
      rats.forEach(([z, ph, sp], i) => {
        const p = fract(ph + t * sp), u = p < 0.5 ? p * 2 : 2 - p * 2, dir = p < 0.5 ? 1 : -1;
        const run = Math.sin(t * 1.3 + i * 2) > -0.3; // 偶爾停下來嗅
        const x = lerp(-7, 31, u);
        RT.set(i, x, 0.18 + (run ? Math.abs(Math.sin(t * 22 + i)) * 0.06 : 0), z, 0, dir * Math.PI / 2 + (run ? 0 : Math.sin(t * 6 + i) * 0.4), 0, 1);
      });
      RT.done();
    });
    // 人孔蓋冒蒸氣
    for (const [x, z] of [[-4, 4], [28, 20]]) { b.cyl(0.7, 0.7, 0.06, '#3a3f3c', x, GY + 0.03, z, { seg: 16 }); for (let k = -2; k <= 2; k++) b.box(1.0, 0.02, 0.08, '#262b28', x, GY + 0.07, z + k * 0.22, { ol: false, r: 0 }); smoke(root, anims, x, 0.2, z, { n: 5, rise: 4, size: 0.6, speed: 0.25, color: '#c8e8d8', op: 0.35, dx: 0.2 }); }
    // 牆上的日光燈管（其中一支壞掉在閃）
    const tubes = [ownFlat('#e8fff4'), ownFlat('#e8fff4')];
    for (const [x, z, k] of [[4.5, -6.85, 0], [19.5, -6.85, 1], [4.5, 30.85, 0], [19.5, 30.85, 0]]) { b.box(3.0, 0.12, 0.12, null, x, 6.3, z, { mat: tubes[k], r: 0 }); b.box(3.2, 0.08, 0.2, '#5a5048', x, 6.42, z, { ol: false, r: 0 }); }
    anims.push(t => tubes[1].color.set(Math.sin(t * 17) + Math.sin(t * 5.1) > 1.2 ? '#2a3a32' : '#e8fff4'));
    // 隧道裡偶爾逼近的列車頭燈
    const head = ownFlat('#fff6c0', { opacity: 0, add: true, depthWrite: false });
    for (const [x, s] of [[-9.05, 1], [33.05, -1]]) for (const dz of [-1.0, 1.0]) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), head); m.position.set(x + s * 0.06, 1.3, 12 + dz); m.rotation.y = s * Math.PI / 2; m.raycast = () => {}; root.add(m); }
    anims.push(t => { const k = fract(t * 0.07); head.opacity = k > 0.8 ? Math.sin((k - 0.8) / 0.2 * Math.PI) * 0.9 : 0; });
  },

  bbq(ctx) {
    const { root, b, anims, R, rows } = ctx;
    boardDecals(ctx, {
      crack: 0.08, crackC: '#140a06', stain: 0.12, stainC: '#140a06', stainOp: 0.25,
      bits: (x, y, z) => { const a = R() * 3; for (let k = -2; k <= 2; k++) b.flatQuad(1.1, 0.07, '#1a0c06', x + Math.sin(a) * k * 0.2, y, z + Math.cos(a) * k * 0.2, { flat: true, op: 0.45, ry: a }); },
    });
    ridge(ctx, 120, 30, 8, 20, '#5a2a18', 'mesa', { fade: 0.4 });
    // 看台觀眾波浪舞：取現有點雲做逐點起伏
    const crowd = root.children.find(o => o.isPoints && o.geometry.attributes.position.count > 600);
    if (crowd) {
      const a = crowd.geometry.attributes.position, base = a.array.slice(), ang = [];
      for (let i = 0; i < a.count; i++) ang.push(Math.atan2(base[i * 3 + 2] - 12, base[i * 3] - 12));
      anims.push(t => { for (let i = 0; i < a.count; i++) a.array[i * 3 + 1] = base[i * 3 + 1] + Math.max(0, Math.sin(ang[i] - t * 1.6)) ** 10 * 0.9 + Math.abs(Math.sin(t * 7 + i)) * 0.06; a.needsUpdate = true; });
    }
    // 西側烤肉轉架：香腸串慢慢轉、火焰跳、油滴冒煙
    const sx = -3.9, sz = 12;
    for (const dz of [-1.3, 1.3]) { b.cyl(0.07, 0.07, 1.6, '#2a2628', sx, 0.8, sz + dz, { seg: 6 }); b.box(0.4, 0.15, 0.4, '#2a2628', sx, 0.07, sz + dz); }
    b.box(1.1, 0.35, 2.2, '#3e383a', sx, 0.18, sz); b.box(0.9, 0.06, 2.0, '#140a06', sx, 0.37, sz, { ol: false, r: 0 });
    spinGroup(ctx, sx, 1.45, sz, sb => {
      sb.cyl(0.03, 0.03, 3.0, '#b0a090', 0, 0, 0, { rx: Math.PI / 2, seg: 6 });
      for (let k = 0; k < 5; k++) sb.cap(0.13, 0.28, k % 2 ? '#8a3a1a' : '#a8461e', 0, 0.15 * Math.cos(k * 1.3), -0.9 + k * 0.45, { rx: Math.PI / 2 + Math.sin(k) * 0.3 });
      sb.box(0.1, 0.1, 0.5, '#2a2628', 0, 0, 1.6);
    }, (g, t) => { g.rotation.z = t * 0.9; });
    const fl = ownFlat('#ff7a1a'), fl2 = ownFlat('#ffd23f');
    const flames = [];
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6).translate(0, 0.3, 0), k % 2 ? fl2 : fl); m.position.set(sx + (k % 2 ? 0.15 : -0.15), 0.38, sz - 0.8 + k * 0.4); m.raycast = () => {}; root.add(m); flames.push(m); }
    anims.push(t => flames.forEach((m, k) => { m.scale.set(1, 0.7 + Math.abs(Math.sin(t * 9 + k * 1.7)) * 0.6 + Math.sin(t * 23 + k) * 0.08, 1); }));
    smoke(root, anims, sx, 1.7, sz, { n: 4, rise: 3, size: 0.4, speed: 0.3, color: '#e8dccc', op: 0.4, dx: 0.4 });
    // 競技場矮牆上的飄旗（四個正向）
    const tex = [['#7a1a10', '#ffcf3a', 'LOW&\nSLOW'], ['#ffcf3a', '#7a1a10', 'BBQ\n4EVER']].map(([bg, fg, tx]) => flagTex((x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = '900 30px "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; tx.split('\n').forEach((l, i) => x.fillText(l, w / 2 + 4, h / 2 + (i - 0.5) * 32)); }));
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((a, i) => {
      if (Math.abs(a - Math.PI * 1.5) < 0.1) return; // 北側缺口是煙燻爐
      const x = 12 + Math.cos(a) * 18.6, z = 12 + Math.sin(a) * 18.6;
      b.cyl(0.06, 0.06, 4.6, '#b0a090', x, 2.3, z, { seg: 6 }); b.sph(0.1, '#ffcf3a', x, 4.65, z, { seg: 6 });
      waveFlag(ctx, x, 4.0, z, -a + Math.PI / 2 + 0.4, 1.8, 1.1, tex[i % 2], { speed: 5 });
    });
    void rows;
  },

  diner(ctx) {
    const { root, b, anims, R } = ctx;
    boardDecals(ctx, {
      crack: 0.04, crackC: '#5a5048', stain: 0.1, stainC: '#8a4a1a', stainOp: 0.16,
      bits: (x, y, z) => {
        if (R() < 0.5) { b.ring(0.18, 0.23, '#5a3014', x, y, z, { flat: true, op: 0.4 }); b.ring(0.18, 0.21, '#5a3014', x + 0.3, y, z + 0.12, { flat: true, op: 0.25 }); }
        else { b.disc(0.2, '#c87a1a', x, y, z, { flat: true, op: 0.55, seg: 10 }); for (let k = 0; k < 3; k++) b.disc(0.06, '#c87a1a', x + 0.25 + k * 0.12, y, z + (R() - 0.5) * 0.2, { flat: true, op: 0.55, seg: 6 }); }
        for (let k = 0; k < 4; k++) b.disc(0.035, '#e8c890', x + (R() - 0.5) * 1.2, y, z + (R() - 0.5) * 1.2, { flat: true, seg: 5 });
      },
    });
    // 吊扇
    for (const [x, z] of [[2, -2], [22, -2], [2, 26], [22, 26]]) {
      b.cyl(0.03, 0.03, 0.9, '#2a2a2e', x, 3.95, z, { seg: 5, ol: false });
      b.cyl(0.18, 0.22, 0.2, '#c9a66a', x, 3.45, z, { seg: 10 });
      b.sph(0.14, '#fff2c0', x, 3.28, z, { flat: true, seg: 8 });
      spinGroup(ctx, x, 3.42, z, sb => { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; sb.box(1.2, 0.03, 0.26, '#8a5a34', Math.cos(a) * 0.75, 0, -Math.sin(a) * 0.75, { ry: a, rx: 0.12, r: 0.012 }); } }, (g, t) => { g.rotation.y = t * 3 + x; });
    }
    // 點唱機飄出音符
    const notes = ['♪', '♫', '♪', '♬'].map((n, i) => { const m = sign(root, n, 0.55, 24.5, 2, -2.5, 0, { color: ['#ff4f9e', '#ffd23f', '#3ff0d8', '#ff8a3a'][i], stroke: '#1b1226', size: 72 }); m.material.depthWrite = false; return m; });
    anims.push(t => notes.forEach((m, i) => { const k = fract(t * 0.3 + i / notes.length); m.position.set(24.5 + Math.sin(k * 7 + i) * 0.5 - k * 1.2, 1.9 + k * 2.4, -2.5 + k * 0.8); m.material.opacity = Math.min(1, k * 5) * (1 - k); m.rotation.z = Math.sin(t * 3 + i) * 0.3; }));
    // 咖啡壺冒煙、煎台噴油花
    smoke(root, anims, -2.4, 1.45, 18.1, { n: 4, rise: 1.8, size: 0.16, speed: 0.35, color: '#ffffff', op: 0.45, dx: 0.1 });
    motes(ctx, 30, [-3.6, -1.6, 1.0, 1.9, 5, 11], ['#ffe08a', '#ffffff'], 0.12, { mode: 'rise', speed: 0.6 });
    // 窗外下著雨
    motes(ctx, 160, [28.6, 46, 0, 11, -12, 36], ['#9ab8d8', '#c8dcf0'], 0.16, { mode: 'fall', speed: 0.9, add: false, fog: true });
    // 遠方公路的車燈流
    const hp = [], hc = [];
    for (let i = 0; i < 14; i++) { hp.push(0, 0.6, 0); hc.push(...rgb(i % 2 ? '#fff4d0' : '#ff4a3a')); }
    const cars = dots(hp, hc, 1.6, { fog: false }); root.add(cars);
    const ca = cars.geometry.attributes.position;
    anims.push(t => { for (let i = 0; i < 14; i++) { const dir = i % 2 ? 1 : -1, k = fract(i * 0.137 + t * 0.03 * (1 + (i % 3) * 0.2)); ca.array[i * 3] = dir > 0 ? lerp(-80, 110, k) : lerp(110, -80, k); ca.array[i * 3 + 2] = dir > 0 ? 87 : 85; } ca.needsUpdate = true; });
    void R;
  },

  rooftop(ctx) {
    const { root, b, anims, R } = ctx;
    boardDecals(ctx, {
      crack: 0.05, crackC: '#15181e', crackOp: 0.4, stain: 0.1, stainC: '#0e1116', stainOp: 0.25,
      bits: (x, y, z) => { // 瀝青補丁（方塊）
        const a = (R() < 0.5 ? 0 : Math.PI / 2) + (R() - 0.5) * 0.1; b.flatQuad(0.9 + R() * 0.5, 0.5 + R() * 0.3, '#1a1d22', x, y, z, { flat: true, op: 0.35, ry: a });
      }, bitP: 0.1,
    });
    clouds(ctx, 6, '#4a3a5e', { y: 50 });
    // 空調室外機的風扇
    for (const [x, z] of [[-4, -4], [-4, 28], [28, -4], [28, 28], [-5, 12]]) spinGroup(ctx, x, 1.4, z, sb => { for (let k = 0; k < 3; k++) { const a = k * 2.094; sb.box(0.7, 0.03, 0.22, '#c9ccd1', Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38, { ry: a, rx: 0.3, r: 0.01 }); } sb.cyl(0.1, 0.1, 0.08, '#3a414c', 0, 0, 0, { seg: 8 }); }, (g, t) => { g.rotation.y = t * 6 + x * z; });
    // 巡邏無人機（繞棋盤外圈，紅綠燈閃）
    const dr = new THREE.Group(); root.add(dr);
    const db = new Batch(); db.box(0.7, 0.18, 0.7, '#2a2d36', 0, 0, 0); db.sph(0.12, '#3ff0d8', 0, -0.12, 0.25, { flat: true, seg: 6 });
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) { db.box(0.6, 0.05, 0.08, '#2a2d36', x * 0.5, 0, z * 0.5, { ry: Math.atan2(x, z) + Math.PI / 2, ol: false }); db.cyl(0.05, 0.05, 0.1, '#2a2d36', x, 0.08, z, { seg: 6, ol: false }); }
    db.build(dr);
    const props = [];
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12).rotateX(-Math.PI / 2), ownFlat('#c9ccd1', { opacity: 0.35, ds: true })); p.position.set(x, 0.14, z); p.raycast = () => {}; dr.add(p); props.push(p); }
    const dl = ownFlat('#ff2a2a'); const blink = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), dl); blink.position.set(0, 0.14, -0.3); blink.raycast = () => {}; dr.add(blink);
    anims.push(t => { const a = t * 0.18; dr.position.set(12 + Math.cos(a) * 23, 8 + Math.sin(t * 0.9) * 0.5, 12 + Math.sin(a) * 23); dr.rotation.set(0.12, -a, Math.sin(t * 0.7) * 0.06); dl.color.set(Math.sin(t * 8) > 0.5 ? '#ff2a2a' : '#3a0a0a'); props.forEach(p => (p.rotation.y = t * 30)); });
    // 遠方廣告飛艇
    const bl = new THREE.Group(); root.add(bl);
    const bb = new Batch(); bb.sph(6, '#c9ccd1', 0, 0, 0, { sx: 2.4, seg: 18 }); bb.box(4, 1.4, 1.8, '#2a2d36', 0, -6.2, 0); for (const s of [-1, 1]) bb.box(2.6, 0.2, 3.2, '#e8473b', -12.5, 0, s * 2.4, { rx: s * 0.6 }); bb.box(2.6, 3.4, 0.2, '#e8473b', -12.5, 2.4, 0);
    bb.build(bl);
    sign(bl, 'NOW WITH MORE TERMS', 18, 0, 0.6, 6.05, 0, { color: '#ffcf3a', stroke: '#3a1a00', size: 72 });
    sign(bl, 'NOW WITH MORE TERMS', 18, 0, 0.6, -6.05, Math.PI, { color: '#ffcf3a', stroke: '#3a1a00', size: 72 });
    anims.push(t => { const a = t * 0.02 + 1; bl.position.set(12 + Math.cos(a) * 95, 32 + Math.sin(t * 0.3) * 1.5, 12 + Math.sin(a) * 95); bl.rotation.y = -a; });
    // 女兒牆角的風向袋
    const wsx = -7.6, wsz = -7.6;
    b.cyl(0.05, 0.05, 3.2, '#c9ccd1', wsx, 1.6, wsz, { seg: 6 });
    const sock = new THREE.Group(); sock.position.set(wsx, 3.1, wsz); root.add(sock);
    const sk = new Batch(); for (let k = 0; k < 4; k++) sk.cyl(0.3 - k * 0.05, 0.25 - k * 0.05, 0.42, k % 2 ? '#ffffff' : '#ff6a1a', 0, 0, 0.25 + k * 0.42, { rx: Math.PI / 2, seg: 10 }); sk.build(sock);
    anims.push(t => { sock.rotation.set(0.35 + Math.sin(t * 2.3) * 0.12, 0.8 + Math.sin(t * 0.4) * 0.5, 0); });
    void R;
  },

  stage(ctx) {
    const { root, b, anims, R } = ctx;
    boardDecals(ctx, {
      crack: 0.03, stain: 0.08, stainC: '#0e0a16', stainOp: 0.3,
      bits: (x, y, z) => {
        const c = ['#ff2a8a', '#3ff0d8', '#ffe14d'][(R() * 3) | 0];
        if (R() < 0.4) { b.flatQuad(0.8, 0.1, c, x, y, z, { flat: true, op: 0.85, ry: 0.785 }); b.flatQuad(0.8, 0.1, c, x, y, z, { flat: true, op: 0.85, ry: -0.785 }); }
        else for (let k = 0; k < 6; k++) b.flatQuad(0.1, 0.06, ['#ff2a8a', '#3ff0d8', '#ffe14d', '#ffffff'][k % 4], x + (R() - 0.5) * 1.5, y, z + (R() - 0.5) * 1.5, { flat: true, ry: R() * 3 });
      }, bitP: 0.25,
    });
    // 飄落的彩帶紙片
    const nC = 120, CF = inst(root, new THREE.PlaneGeometry(0.2, 0.12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), nC, { colors: ['#ff2a8a', '#3ff0d8', '#ffe14d', '#ffffff', '#ff8a3a'] });
    const cf = []; for (let i = 0; i < nC; i++) cf.push([lerp(-6, 30, R()), lerp(-6, 30, R()), R(), 0.05 + R() * 0.04, R() * 6]);
    anims.push(t => { cf.forEach(([x, z, ph, sp, r], i) => { const k = fract(ph + t * sp); CF.set(i, x + Math.sin(t * 1.3 + r) * 0.8, 16 - k * 16, z + Math.cos(t * 1.1 + r) * 0.8, t * 3 + r, t * 2 + r, r, 1); }); CF.done(); });
    // 觀眾跟著節拍跳（兩組交錯）
    const crowds = root.children.filter(o => o.isPoints && o.geometry.attributes.position.count > 1000);
    anims.push(t => crowds.forEach((c, i) => { c.position.y = Math.max(0, Math.sin(t * 6.3 + i * Math.PI)) * 0.35; }));
    // 舞台四邊的火焰噴柱（定時噴發）
    const pf = ownFlat('#ff7a1a'), pf2 = ownFlat('#ffe14d');
    const jets = [];
    for (const [x, z] of [[-1.7, 6], [-1.7, 18], [25.7, 6], [25.7, 18]]) {
      b.box(0.7, 0.5, 0.7, '#2a2440', x, 0.25, z); b.cyl(0.18, 0.18, 0.1, '#5a5254', x, 0.52, z, { seg: 8 });
      const g = new THREE.Group(); g.position.set(x, 0.55, z); root.add(g);
      g.add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.2, 8).translate(0, 1.6, 0), pf), new THREE.Mesh(new THREE.ConeGeometry(0.2, 2.4, 8).translate(0, 1.2, 0), pf2));
      g.children.forEach(m => (m.raycast = () => {}));
      jets.push(g);
    }
    anims.push(t => jets.forEach((g, i) => { const k = fract(t * 0.25 + (i % 2) * 0.5); const on = k < 0.12 ? Math.sin(k / 0.12 * Math.PI) : 0; g.visible = on > 0.02; g.scale.set(0.6 + on * 0.5, Math.max(0.01, on), 0.6 + on * 0.5); }));
    // 夜空煙火
    const fw = [];
    const fwPal = [['#ff2a8a', '#ffd6f0'], ['#3ff0d8', '#e8fffa'], ['#ffe14d', '#fff8d8']];
    for (let f = 0; f < 3; f++) {
      const n = 70, pts = [], cc = [], dirs = [];
      for (let i = 0; i < n; i++) { pts.push(0, 0, 0); cc.push(...rgb(fwPal[f][i % 2])); const u = R() * 2 - 1, a = R() * 6.28, s = Math.sqrt(1 - u * u); dirs.push([s * Math.cos(a), u, s * Math.sin(a)]); }
      const p = dots(pts, cc, 1.5, { fog: false }); root.add(p);
      fw.push({ p, dirs, ph: f / 3, c: [12 + Math.cos(f * 2.1) * 60, 38 + f * 6, 12 + Math.sin(f * 2.1) * 60] });
    }
    anims.push(t => fw.forEach(F => {
      const k = fract(t * 0.22 + F.ph), a = F.p.geometry.attributes.position, r = Math.sqrt(k) * 9;
      F.dirs.forEach((d, i) => { a.array[i * 3] = F.c[0] + d[0] * r; a.array[i * 3 + 1] = F.c[1] + d[1] * r - k * k * 6; a.array[i * 3 + 2] = F.c[2] + d[2] * r; });
      a.needsUpdate = true; F.p.material.opacity = k < 0.75 ? 1 : (1 - k) / 0.25;
    }));
  },
};
