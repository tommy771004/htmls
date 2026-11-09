// 第 6–10 關敵人模型。每個建構函式回傳 THREE.Group：腳底（或影子點）在 y=0、面向 +Z。
// userData.height = 頭頂高度；userData.parts 依共用契約：body/head/armL/armR/forearmL/forearmR/legL/legR/weapon/eyes[]/mouth/wingL/wingR/tail/extra[]；
// userData.rest = 各部位初始旋轉與位置；userData.anim(t, dt) 為自訂待機動畫（螢幕、LED、煙、旋轉環）。
// 幾何體依參數快取共用（geometry.userData.shared = true，換關時不會被 dispose）。
// THREE 是全域變數，本檔頂層不可呼叫 THREE。
/* global THREE */
import { toon, flat, part, roundedBoxGeo, textTexture, gradientMap, outlineMat } from '../kit.js';

const PI = Math.PI;

// ── 幾何快取與基本形體 ─────────────────────────────
const GEO = new Map();
function cg(key, mk) { let g = GEO.get(key); if (!g) { g = mk(); g.userData.shared = true; GEO.set(key, g); } return g; }
const q = v => Math.round(v * 1000) / 1000;
// 只把影響外觀的參數交給 toon，避免同色不同旗標產生多份材質
const PLAIN = new Map(); // 純色 toon 材質 → 色碼（可合併成頂點色）
function M(geo, color, o = {}) {
  let mat = o.mat;
  if (!mat) {
    const m = {}; let plain = true;
    for (const k of ['emissive', 'emissiveIntensity', 'transparent', 'opacity', 'side']) if (o[k] !== undefined) { m[k] = o[k]; plain = false; }
    mat = toon(color, m);
    if (plain) PLAIN.set(mat, color);
  }
  return part(geo, color, { mat, outline: o.outline, shadow: o.shadow });
}

// ── 靜態合併 ─────────────────────────────────────
// 每個骨架群組內「不會單獨動」的網格：純色 toon 合成一個頂點色網格，其他同材質者各自合併；描邊另合成一個子網格。
// keep 內的物件（契約部位、動畫會動到的網格）與有貼圖的網格不合併。網址加 ?nomerge=1 可關閉以除錯。
let _vc = null;
function vcMat() { return _vc || (_vc = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradientMap() })); }
function mergeGeos(list, withColor) {
  let nv = 0, ni = 0;
  for (const m of list) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = withColor ? new Float32Array(nv * 3) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(), c = new THREE.Color();
  let vo = 0, io = 0;
  for (const m of list) {
    m.updateMatrix(); nm.getNormalMatrix(m.matrix);
    const g = m.geometry, Pa = g.attributes.position, Na = g.attributes.normal;
    if (withColor) c.setHex(PLAIN.get(m.material));
    for (let i = 0; i < Pa.count; i++) {
      const k = (vo + i) * 3;
      v.fromBufferAttribute(Pa, i).applyMatrix4(m.matrix); pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
      v.fromBufferAttribute(Na, i).applyMatrix3(nm).normalize(); nor[k] = v.x; nor[k + 1] = v.y; nor[k + 2] = v.z;
      if (col) { col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
    else for (let i = 0; i < Pa.count; i++) idx[io++] = vo + i;
    vo += Pa.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
function bake(root, keep) {
  if (typeof location !== 'undefined' && /[?&]nomerge=1/.test(location.search)) return;
  const nodes = []; root.traverse(o => { if (!o.isMesh) nodes.push(o); });
  for (const node of nodes) {
    const B = new Map();
    for (const c of node.children) {
      if (!c.isMesh || keep.has(c) || c.name === 'outline' || Array.isArray(c.material) || c.material.map) continue;
      if (c.children.some(k => k.name !== 'outline')) continue;
      const key = PLAIN.has(c.material) ? 'vc' : c.material.uuid;
      if (!B.has(key)) B.set(key, []);
      B.get(key).push(c);
    }
    for (const [key, list] of B) {
      if (list.length < 2) continue;
      const geo = mergeGeos(list, key === 'vc');
      const m = new THREE.Mesh(geo, key === 'vc' ? vcMat() : list[0].material);
      m.castShadow = list.some(x => x.castShadow);
      const ol = list.filter(x => x.children.some(k => k.name === 'outline'));
      if (ol.length) {
        const o = new THREE.Mesh(ol.length === list.length ? geo : mergeGeos(ol, false), outlineMat());
        o.name = 'outline'; o.raycast = () => {}; m.add(o);
      }
      for (const x of list) node.remove(x);
      node.add(m);
    }
  }
}
function P(m, x, y, z) { m.position.set(x, y, z); return m; }
function box(w, h, d, c, x = 0, y = 0, z = 0, o = {}) { w = q(w); h = q(h); d = q(d); const r = q(o.r ?? Math.min(w, h, d) * 0.12); return P(M(cg(`b${w},${h},${d},${r}`, () => roundedBoxGeo(w, h, d, r)), c, o), x, y, z); }
function sphere(r, c, x = 0, y = 0, z = 0, o = {}) { r = q(r); const s = o.seg || (r < 0.05 ? 10 : 16), hs = Math.max(6, Math.round(s * 0.75)); return P(M(cg(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, hs)), c, o), x, y, z); }
function cyl(rt, rb, h, c, x = 0, y = 0, z = 0, o = {}) { rt = q(rt); rb = q(rb); h = q(h); const s = o.seg || 14; return P(M(cg(`c${rt},${rb},${h},${s},${!!o.open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, !!o.open)), c, o), x, y, z); }
function cone(r, h, c, x = 0, y = 0, z = 0, o = {}) { r = q(r); h = q(h); const s = o.seg || 12; return P(M(cg(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)), c, o), x, y, z); }
function capsule(r, len, c, x = 0, y = 0, z = 0, o = {}) { r = q(r); len = q(len); const s = o.seg || 12; return P(M(cg(`p${r},${len},${s}`, () => new THREE.CapsuleGeometry(r, len, 4, s)), c, o), x, y, z); }
function torus(r, t, c, x = 0, y = 0, z = 0, o = {}) { r = q(r); t = q(t); const s = o.seg || 20, a = q(o.arc ?? PI * 2); return P(M(cg(`t${r},${t},${s},${a}`, () => new THREE.TorusGeometry(r, t, 8, s, a)), c, o), x, y, z); }
// 半球（帽子、頭罩、駕駛艙、眼皮）
function dome(r, c, o = {}) { r = q(r); const cut = q(o.cut ?? 0.5); return M(cg(`d${r},${cut}`, () => new THREE.SphereGeometry(r, 16, 8, 0, PI * 2, 0, cut * PI)), c, o); }
function V(p) { return new THREE.Vector3(p[0], p[1], p[2]); }
// 沿曲線的管子（觸手、尾巴、電纜、起司絲）；taper 由頭到尾變細
function tube(pts, r, c, o = {}) {
  const seg = o.seg || 20, rs = o.rs || 8;
  const geo = cg('u' + JSON.stringify([pts.map(p => p.map(q)), q(r), seg, rs, o.taper || 0]), () => {
    const curve = new THREE.CatmullRomCurve3(pts.map(V));
    const g = new THREE.TubeGeometry(curve, seg, r, rs, false);
    if (o.taper) {
      const pos = g.attributes.position, rings = seg + 1, per = pos.count / rings, cc = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i < rings; i++) {
        const t = i / (rings - 1); curve.getPointAt(t, cc);
        const k = 1 - t * o.taper;
        for (let j = 0; j < per; j++) { const idx = i * per + j; v.fromBufferAttribute(pos, idx).sub(cc).multiplyScalar(k).add(cc); pos.setXYZ(idx, v.x, v.y, v.z); }
      }
      g.computeVertexNormals();
    }
    return g;
  });
  return M(geo, c, o);
}
// 平面外形擠出（翅膀、披薩片、星星）
function slab(pts, depth, c, o = {}) {
  const geo = cg('x' + JSON.stringify([pts.map(p => p.map(q)), q(depth)]), () => {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]); }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -depth / 2); return g;
  });
  return M(geo, c, o);
}
// 文字貼片：幾何與材質共用；alphaTest 讓影子只投出字形
const LBL = new Map();
function label(text, w, o = {}) {
  const { tex, aspect } = textTexture(text, o);
  const key = JSON.stringify([text, o]);
  let mat = LBL.get(key);
  if (!mat) { mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !o.bg, alphaTest: o.bg ? 0 : 0.35, side: o.double ? THREE.DoubleSide : THREE.FrontSide, depthWrite: true }); LBL.set(key, mat); }
  const m = new THREE.Mesh(cg(`l${q(w)},${q(aspect)}`, () => new THREE.PlaneGeometry(w, w / aspect)), mat);
  m.castShadow = false;
  return m;
}
function disc(r, c, o = {}) { return new THREE.Mesh(cg(`o${q(r)}`, () => new THREE.CircleGeometry(r, 28)), o.mat || flat(c)); }
function strip(w, h, c, o = {}) { return new THREE.Mesh(cg(`q${q(w)},${q(h)}`, () => new THREE.PlaneGeometry(w, h)), o.mat || flat(c)); }

function at(o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; }
function sc(o, x, y = x, z = x) { o.scale.set(x, y, z); return o; }
function grp(x = 0, y = 0, z = 0, parent = null) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }
// 換父節點但保持世界位置（拿武器的姿勢擺好後再掛到手上，攻擊揮臂時武器跟著走）
function hold(root, parent, obj) { root.updateMatrixWorld(true); parent.attach(obj); return obj; }
// 兩節手臂 IK：把手掌（前臂 FH 處）放到 body 座標的 tgt。手肘自然朝下；pole 可微調手肘前後
function reach(arm, fore, tgt, len = [0.26, 0.24]) {
  const [a, b] = len;
  const d = new THREE.Vector3(tgt[0] - arm.position.x, tgt[1] - arm.position.y, tgt[2] - arm.position.z);
  const L = Math.min(Math.max(d.length(), Math.abs(a - b) + 0.01), a + b - 0.002); d.normalize();
  const bend = PI - Math.acos((a * a + b * b - L * L) / (2 * a * b));
  const alpha = Math.acos(Math.min(1, (a * a + L * L - b * b) / (2 * a * L)));
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
  arm.rotateX(alpha);
  fore.rotation.set(-bend, 0, 0);
}
// 每個實例自己的材質（動畫會改顏色，不能動到共用材質）
function own(color) { return new THREE.MeshBasicMaterial({ color }); }
const blink = (t, rate, duty = 0.5) => ((t * rate) % 1) < duty;

// ── 臉 ───────────────────────────────────────────
// 單眼：群組中心在眼球中心（scale.y→0 就是眨眼）；白眼、瞳孔、反光點、可選眼皮或閉眼弧線
function eye(r, o = {}) {
  const e = grp();
  if (o.closed) {
    e.add(at(torus(r * 0.8, r * 0.16, o.ink ?? 0x1b1226, 0, 0, 0, { arc: PI, seg: 10, outline: false }), 0, -r * 0.3, r * 0.6, 0, 0, 0));
    return e;
  }
  e.add(sphere(r, o.white ?? 0xffffff));
  if (o.slit) e.add(P(box(r * 0.3, r * 1.45, r * 0.3, 0x111111, 0, 0, 0, { outline: false }), (o.look ?? 0) * r * 0.25, 0, r * 0.84));
  else e.add(sphere(r * (o.pr ?? 0.52), o.pupil ?? 0x111111, (o.look ?? 0) * r * 0.25, (o.lookY ?? 0) * r * 0.2, r * 0.7, { outline: false }));
  e.add(sphere(r * 0.17, 0xffffff, r * 0.22 + (o.look ?? 0) * r * 0.25, r * 0.28, r * 0.93, { mat: flat(0xffffff), outline: false }));
  if (o.lid !== undefined) {
    // 半閉眼皮（睏、得意、陰險）
    const lid = at(dome(r * 1.12, o.lid), 0, 0, 0, (o.lidX ?? 0.55), 0, o.lidZ ?? 0);
    e.add(lid);
  }
  return e;
}
// face(head, 頭半徑, 選項) → { eyes, mouth }
function face(head, HR, o = {}) {
  const ey = HR * (o.ey ?? 1.05), ex = HR * (o.ex ?? 0.36), ez = HR * (o.ez ?? 0.84), er = HR * (o.er ?? 0.22);
  const eyes = [];
  if (o.eyes !== false) for (const s of [-1, 1]) {
    const e = eye(er, Object.assign({}, o, { lidZ: s * (o.lidTilt ?? 0) }));
    e.position.set(s * ex, ey, ez); head.add(e); eyes.push(e);
    if (o.brow) head.add(at(box(er * 2.3, er * 0.48, er * 0.55, o.brow), s * ex, ey + er * (o.browY ?? 1.25), ez + er * 0.32, 0, 0, s * (o.browTilt ?? 0.35)));
  }
  if (o.nose !== false) head.add(sphere(HR * (o.noseR ?? 0.14), o.noseColor ?? o.skin ?? 0xf2c39b, 0, HR * 0.84, HR * 1.0));
  let mouth = null;
  if (o.mouth !== false) {
    mouth = box(HR * (o.mouthW ?? 0.5), HR * (o.mouthH ?? 0.12), HR * 0.12, o.mouth ?? 0x5a1e1e, (o.mouthX ?? 0) * HR, HR * (o.my ?? 0.55), HR * 0.9, { outline: false });
    mouth.rotation.z = o.mouthTilt ?? 0;
    if (o.teeth) mouth.add(box(HR * (o.mouthW ?? 0.5) * 0.86, HR * (o.mouthH ?? 0.12) * 0.38, 0.02, 0xffffff, 0, HR * (o.mouthH ?? 0.12) * 0.24, HR * 0.05, { outline: false }));
    if (o.tongue) mouth.add(sc(sphere(HR * 0.12, 0xe0566a, 0, -HR * (o.mouthH ?? 0.12) * 0.2, HR * 0.03, { outline: false }), 1.3, 0.6, 0.6));
    head.add(mouth);
  }
  return { eyes, mouth };
}
// 卡通手：圓掌＋拇指
function mitt(color, r) {
  const h = grp();
  h.add(sc(sphere(r, color), 1, 1.08, 0.86));
  h.add(at(capsule(r * 0.34, r * 0.5, color, 0, 0, 0, { outline: false }), 0, r * 0.2, r * 0.72, 0.9, 0, 0));
  return h;
}
// 爪手：掌＋三根爪
function claw(color, r, nail = 0xf3eadb) {
  const h = grp();
  h.add(sc(sphere(r, color), 1, 0.9, 1));
  for (const x of [-0.6, 0, 0.6]) h.add(at(cone(r * 0.22, r * 0.75, nail, 0, 0, 0, { outline: false, seg: 6 }), x * r, -r * 0.55, r * 0.55, PI * 0.8, 0, 0));
  return h;
}

// 通用人形骨架（高約 1.83 m，比例誇張：大頭、短腿）
const FH = -0.24; // 手掌在前臂群組內的 y
function humanoid(o = {}) {
  const C = Object.assign({ skin: 0xf2c39b, shirt: 0xeeeeee, pants: 0x34495e, shoe: 0x222222 }, o);
  const W = o.W ?? 0.56, D = o.D ?? 0.34, TH = o.TH ?? 0.52, HR = o.HR ?? 0.26, HIP = 0.7, AR = o.armR ?? 0.085, LR = o.legR ?? 0.1;
  const g = new THREE.Group(), rig = grp(0, 0, 0, g);
  const body = grp(0, HIP, 0, rig);
  body.add(box(W * 0.9, 0.24, D * 0.94, C.pelvis ?? C.pants, 0, 0.04, 0));
  if (!o.noTorso) body.add(box(W, TH, D, C.shirt, 0, 0.08 + TH / 2, 0, { r: 0.08 }));
  const neckY = 0.08 + TH;
  if (!o.noHead && o.neck !== false) body.add(cyl(HR * 0.38, HR * 0.44, 0.12, C.skin, 0, neckY, 0, { outline: false, seg: 10 }));
  const head = grp(0, neckY, 0, body);
  let F = { eyes: [], mouth: null };
  if (!o.noHead) {
    head.add(sphere(HR, C.skin, 0, HR * 0.95, 0));
    if (o.ears !== false) for (const s of [-1, 1]) head.add(sc(sphere(HR * 0.22, C.skin, s * HR * 0.98, HR * 0.92, -HR * 0.05), 0.5, 1, 0.8));
    F = face(head, HR, Object.assign({ skin: C.skin }, o.face || {}));
  }
  const sx = W / 2 + AR * 0.9;
  const fores = [];
  const mkArm = (s) => {
    const a = grp(s * sx, neckY - 0.08, 0, body); a.rotation.z = s * 0.1;
    a.add(capsule(AR, 0.14, C.sleeve ?? C.shirt, 0, -0.13, 0));
    const f = grp(0, -0.26, 0, a);
    f.add(capsule(AR * 0.9, 0.12, C.fore ?? C.sleeve ?? C.shirt, 0, -0.1, 0));
    if (o.cuff) f.add(cyl(AR * 1.12, AR * 1.12, 0.06, o.cuff, 0, -0.17, 0, { outline: false }));
    f.add(P(mitt(C.glove ?? C.skin, o.handR ?? 0.095), 0, FH, 0));
    fores.push(f); return a;
  };
  const armL = mkArm(1), armR = mkArm(-1);
  const mkLeg = (s) => {
    const l = grp(s * (o.legX ?? 0.14), HIP, 0, rig);
    l.add(capsule(LR, 0.4, C.leg ?? C.pants, 0, -0.33, 0));
    if (C.shoe !== null) {
      l.add(box(0.2, 0.12, 0.32, C.shoe, 0, -0.63, 0.05, { r: 0.05 }));
      l.add(box(0.21, 0.04, 0.33, C.sole ?? 0xf3eadb, 0, -0.68, 0.05, { outline: false, r: 0.015 }));
    }
    return l;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  return { g, rig, body, head, armL, armR, foreL: fores[0], foreR: fores[1], legL, legR, HR, neckY, W, D, TH, C, eyes: F.eyes, mouth: F.mouth };
}

function finish(g, parts, height, anim, keepList = []) {
  g.userData.height = height;
  if (!parts.eyes) parts.eyes = [];
  if (!parts.extra) parts.extra = [];
  const keep = new Set(keepList);
  for (const k in parts) { const p = parts[k]; if (Array.isArray(p)) p.forEach(x => keep.add(x)); else if (p) keep.add(p); }
  bake(g, keep);
  g.userData.parts = parts;
  const rest = {};
  for (const k in parts) { const p = parts[k]; if (p && p.isObject3D) rest[k] = { rot: p.rotation.toArray().slice(0, 3), pos: p.position.toArray() }; }
  g.userData.rest = rest;
  if (anim) { g.userData.anim = anim; anim(0, 0); }
  return g;
}
function hparts(h, extra = {}) {
  return Object.assign({ body: h.body, head: h.head, armL: h.armL, armR: h.armR, forearmL: h.foreL, forearmR: h.foreR, legL: h.legL, legR: h.legR, eyes: h.eyes, mouth: h.mouth }, extra);
}

// 程序生成的格紋材質（披薩店桌巾）
let _check = null;
function checkerMat() {
  if (_check) return _check;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#f4efe6'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#d32f2f'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) x.fillRect(i * 16, j * 16, 16, 16);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  _check = new THREE.MeshToonMaterial({ map: t, gradientMap: gradientMap(), side: THREE.DoubleSide });
  return _check;
}

// 蝙蝠翼（水平膜，沿 ±X 伸出；群組在肩部，rotation.z 拍動）。翼骨＋翼尖爪
function batWing(s, span, chord, color, bone) {
  const w = grp();
  const pts = [[0, 0.12 * chord], [0.45 * span, 0.55 * chord], [span, 0.42 * chord],
    [0.92 * span, 0.05 * chord, 0.78 * span, -0.12 * chord],
    [0.68 * span, 0.12 * chord, 0.52 * span, -0.22 * chord],
    [0.38 * span, 0.0, 0.24 * span, -0.25 * chord],
    [0.1 * span, -0.05 * chord, 0, -0.2 * chord]].map(p => p.map((v, i) => (i % 2 === 0 ? v * s : v)));
  const m = slab(pts, 0.03, color, { side: THREE.DoubleSide });
  m.rotation.x = PI / 2;
  w.add(m);
  if (bone) {
    const k = Math.max(1, span);
    w.add(tube([[0, 0, 0.12 * chord], [0.45 * span * s, 0, 0.55 * chord], [span * s, 0, 0.42 * chord]], 0.035 * k, bone, { seg: 10, rs: 6 }));
    w.add(tube([[0.45 * span * s, 0, 0.55 * chord], [0.7 * span * s, 0, -0.1 * chord]], 0.022 * k, bone, { seg: 4, rs: 5, outline: false }));
    w.add(tube([[0.45 * span * s, 0, 0.55 * chord], [0.4 * span * s, 0, -0.2 * chord]], 0.022 * k, bone, { seg: 4, rs: 5, outline: false }));
    w.add(at(cone(0.03 * k, 0.1 * k, 0xf3eadb, 0, 0, 0, { outline: false, seg: 6 }), 0.45 * span * s, 0.02, 0.6 * chord, PI / 2, 0, 0));
  }
  return w;
}
// 以根部為樞紐的管子群組（尾巴、觸手、電纜：讓畫面層擺動時以根部旋轉）
function rooted(parent, root, pts, r, c, o = {}) {
  const gq = grp(root[0], root[1], root[2], parent);
  gq.add(tube(pts.map(p => [p[0] - root[0], p[1] - root[1], p[2] - root[2]]), r, c, o));
  return gq;
}

// ── 第 6 關 ─────────────────────────────────────────
// 下水道變異巨鱷：四足、張嘴、倒戴棒球帽＋金鍊金牙，背上螢光綠黏液、腳爪
function gator() {
  const g = new THREE.Group();
  const GR = 0x4f9a2c, DK = 0x2f6b1c, BL = 0xd8e08a, MO = 0xd2445a, SL = 0x9dff3c, GOLD = 0xf2c230;
  const body = grp(0, 0.42, -0.05, g);
  body.add(sc(at(capsule(0.34, 0.5, GR), 0, 0, 0, PI / 2, 0, 0), 1.15, 1, 0.78));
  body.add(sc(at(capsule(0.28, 0.42, BL), 0, -0.1, 0.02, PI / 2, 0, 0), 1.1, 1, 0.55));
  // 背甲：中央脊刺＋兩側鱗瘤
  for (let i = 0; i < 5; i++) body.add(cone(0.065, 0.15, DK, 0, 0.27, 0.42 - i * 0.2, { seg: 6 }));
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) body.add(sc(sphere(0.06, DK, s * 0.2, 0.2, 0.3 - i * 0.28, { outline: false, seg: 8 }), 1, 0.5, 1.2));
  // 螢光黏液（滴）
  const slime = flat(SL);
  body.add(sc(sphere(0.08, SL, 0.17, 0.2, 0.08, { mat: slime, outline: false }), 1.2, 0.5, 1));
  body.add(sc(sphere(0.06, SL, -0.12, 0.23, -0.22, { mat: slime, outline: false }), 1.2, 0.5, 1));
  const drip = grp(0.3, 0.06, 0.08, body);
  drip.add(capsule(0.03, 0.08, SL, 0, -0.06, 0, { mat: slime, outline: false }));
  // 頭（脖子處為樞紐）
  const head = grp(0, 0.06, 0.52, body); head.rotation.x = -0.12;
  head.add(box(0.44, 0.2, 0.34, GR, 0, 0.06, 0.08));
  head.add(box(0.36, 0.13, 0.5, GR, 0, 0.04, 0.45));
  const eyes = [];
  for (const s of [-1, 1]) {
    head.add(sphere(0.1, GR, s * 0.13, 0.16, 0.1));
    const e = eye(0.078, { white: 0xf5d33a, slit: true, lid: DK, lidX: 0.75, lidZ: s * -0.35 }); e.position.set(s * 0.13, 0.2, 0.15); head.add(e); eyes.push(e);
    head.add(at(box(0.15, 0.035, 0.05, DK), s * 0.13, 0.29, 0.16, 0, 0, s * -0.35));
    head.add(sphere(0.03, DK, s * 0.07, 0.12, 0.68, { outline: false }));
    for (const z of [0.3, 0.45, 0.6]) head.add(at(cone(0.024, 0.07, z === 0.45 && s > 0 ? GOLD : 0xffffff, 0, 0, 0, { outline: false, seg: 6 }), s * 0.155, -0.06, z, PI, 0, 0));
  }
  const mouth = box(0.3, 0.04, 0.42, MO, 0, -0.05, 0.42, { outline: false }); head.add(mouth);
  const jaw = grp(0, -0.04, 0.12, head); jaw.rotation.x = 0.3;
  jaw.add(box(0.36, 0.09, 0.56, GR, 0, -0.05, 0.28));
  jaw.add(box(0.26, 0.03, 0.44, MO, 0, 0.0, 0.28, { outline: false }));
  jaw.add(sc(sphere(0.08, 0xf07a8a, 0, 0.02, 0.2, { outline: false }), 1, 0.4, 1.6));
  for (const s of [-1, 1]) for (const z of [0.38, 0.5]) jaw.add(cone(0.02, 0.06, 0xffffff, s * 0.14, 0.03, z, { outline: false, seg: 6 }));
  // 倒戴棒球帽
  const cap = grp(0, 0.15, -0.1, head); cap.rotation.x = -0.15;
  cap.add(sc(dome(0.19, 0x2a62c9), 1, 0.65, 1));
  cap.add(box(0.26, 0.025, 0.2, 0x2a62c9, 0, 0.01, -0.24));
  cap.add(sphere(0.03, 0xffffff, 0, 0.13, 0, { outline: false }));
  const ct = label('SEWR', 0.18, { color: '#ffffff', size: 48 }); at(ct, 0, 0.07, -0.17, 0, PI, 0); cap.add(ct);
  // 金鍊＋垂墜錢幣（會晃）
  body.add(at(torus(0.3, 0.03, GOLD), 0, -0.02, 0.4, PI / 2 - 0.3, 0, 0));
  const med = grp(0, -0.12, 0.6, body);
  med.add(at(cyl(0.075, 0.075, 0.025, GOLD), 0, -0.08, 0.02, PI / 2 - 0.3, 0, 0));
  const ml = label('$', 0.09, { color: '#7a5a10', size: 64 }); at(ml, 0, -0.075, 0.04, -0.3, 0, 0); med.add(ml);
  // 四肢＋腳爪
  const leg = (x, z) => {
    const l = grp(x, -0.12, z, body); l.rotation.z = Math.sign(x) * 0.25;
    l.add(capsule(0.09, 0.14, GR, 0, -0.1, 0));
    l.add(box(0.18, 0.08, 0.22, DK, 0, -0.24, 0.05));
    for (const cx of [-0.06, 0, 0.06]) l.add(at(cone(0.022, 0.07, 0xf3eadb, 0, 0, 0, { outline: false, seg: 6 }), cx, -0.25, 0.18, PI / 2, 0, 0));
    return l;
  };
  const legL = leg(0.3, 0.32), legR = leg(-0.3, 0.32), legBL = leg(0.3, -0.38), legBR = leg(-0.3, -0.38);
  // 尾巴（彎向一側）＋尾背脊
  const tail = grp(0, -0.02, -0.6, body);
  tail.add(tube([[0, 0, 0], [0.05, -0.12, -0.35], [0.3, -0.3, -0.6], [0.6, -0.36, -0.6]], 0.2, GR, { taper: 0.85, seg: 16 }));
  for (const [x, y, z] of [[0.02, 0.17, -0.1], [0.12, 0.0, -0.4], [0.33, -0.2, -0.6]]) tail.add(cone(0.05, 0.12, DK, x, y, z, { outline: false, seg: 6 }));
  const anim = (t) => {
    drip.scale.y = 1 + 0.6 * Math.max(0, Math.sin(t * 1.6));
    jaw.rotation.x = 0.3 + 0.07 * Math.sin(t * 1.3);
  };
  return finish(g, { body, head, jaw, legL, legR, legBL, legBR, tail, eyes, mouth, extra: [med] }, 1.0, anim);
}

// 地鐵逃票重裝怪客：芥末黃羽絨衣、帽 T、滑到鼻頭的墨鏡、背包塞滿車票、閘門三叉桿盾（讀卡燈閃）
function dodger() {
  const SK = 0xc68a5e, PUF = 0xf2b134, PUF2 = 0xe8a020;
  const h = humanoid({ skin: SK, shirt: PUF, pants: 0x1f3a6b, shoe: 0xf5f5f5, sole: 0xff6a1a, glove: 0x2a2a2a, W: 0.72, D: 0.46, TH: 0.56, armR: 0.12, legR: 0.12,
    face: { brow: 0x2a1a10, browTilt: -0.2, look: 0.8, er: 0.2, ey: 1.12, lid: SK, lidX: 0.35, mouth: 0x3a1a10, mouthW: 0.36, mouthTilt: 0.18, mouthX: 0.08 } });
  const { g, body, head, armL, armR, foreL, foreR, legL, legR, HR } = h;
  // 羽絨衣的鼓起分段、立領、拉鍊
  for (let i = 0; i < 2; i++) body.add(sc(at(torus(0.33, 0.08, PUF2), 0, 0.26 + i * 0.22, 0, PI / 2, 0, 0), 1.1, 0.78, 1));
  body.add(sc(at(torus(0.17, 0.07, PUF2), 0, 0.62, 0, PI / 2, 0, 0), 1.2, 1, 1));
  body.add(box(0.025, 0.46, 0.02, 0x3a3f45, 0, 0.36, 0.235, { outline: false }));
  for (const a of [armL, armR]) a.add(at(torus(0.12, 0.05, PUF2, 0, 0, 0, { seg: 14 }), 0, -0.12, 0, PI / 2, 0, 0));
  // 帽 T 帽兜＋抽繩（會晃）
  head.add(at(sc(dome(HR * 1.2, 0x3b3f45, { cut: 0.62 }), 1, 1.05, 1), 0, HR * 0.95, -0.05, -0.5, 0, 0));
  const cords = [];
  for (const s of [-1, 1]) {
    const c = grp(s * 0.07, 0.62, 0.2, body);
    c.add(cyl(0.012, 0.012, 0.2, 0xf5f5f5, 0, -0.1, 0, { outline: false, seg: 5 }));
    c.add(cyl(0.018, 0.018, 0.04, 0xff6a1a, 0, -0.21, 0, { outline: false, seg: 6 }));
    cords.push(c);
  }
  // 滑到鼻頭的墨鏡（眼睛從上面偷瞄）
  head.add(box(HR * 1.5, HR * 0.24, 0.05, 0x101010, 0, HR * 0.78, HR * 0.97));
  for (const s of [-1, 1]) head.add(box(HR * 0.22, HR * 0.06, 0.02, 0x6a8aa8, s * HR * 0.35, HR * 0.84, HR * 1.0, { outline: false }));
  // 背包：塞滿黃色車票
  body.add(box(0.46, 0.44, 0.18, 0x2a6b5a, 0, 0.38, -0.3));
  body.add(box(0.34, 0.16, 0.06, 0x23574a, 0, 0.26, -0.4));
  for (let i = 0; i < 3; i++) body.add(at(box(0.14, 0.09, 0.012, 0xffd400, 0, 0, 0, { outline: false }), -0.12 + i * 0.1, 0.63, -0.3, 0.2, 0, -0.3 + i * 0.3));
  // 護膝、運動褲白條紋
  for (const l of [legL, legR]) {
    l.add(box(0.24, 0.2, 0.12, 0xff6a1a, 0, -0.34, 0.1));
    l.add(box(0.03, 0.5, 0.03, 0xffffff, l.position.x > 0 ? 0.11 : -0.11, -0.3, 0, { outline: false }));
  }
  // 左手：閘門三叉桿盾＋讀卡機
  const shield = grp(0, FH, 0.12, foreL); shield.rotation.y = 0.2;
  shield.add(at(cyl(0.13, 0.13, 0.16, 0xb8c0c8), 0, 0, 0, PI / 2, 0, 0));
  for (let i = 0; i < 3; i++) {
    const a = i * 2 * PI / 3 + PI / 2;
    shield.add(at(cyl(0.035, 0.035, 0.5, 0xdfe5ea), Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.06, 0, 0, a + PI / 2));
    shield.add(sphere(0.045, 0x8a939b, Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.06, { outline: false }));
  }
  shield.add(box(0.12, 0.1, 0.05, 0x2a2a2a, 0, 0, 0.1));
  const ledG = flat(0x3dff6a), ledR = flat(0xff2a3a);
  const led = box(0.05, 0.03, 0.02, 0, 0, 0.02, 0.13, { mat: ledG, outline: false }); shield.add(led);
  armL.rotation.set(-0.7, 0, 0.1); foreL.rotation.x = -0.3;
  // 右手：揮舞黃色車票
  const card = grp(0, FH - 0.08, 0.04, foreR);
  card.add(box(0.2, 0.13, 0.02, 0xffd400, 0, 0, 0));
  card.add(box(0.16, 0.025, 0.005, 0x1a1a1a, 0, 0.03, 0.012, { outline: false }));
  armR.rotation.set(-0.3, 0, -0.35); foreR.rotation.x = -0.5;
  const anim = (t) => { led.material = blink(t, 0.8, 0.65) ? ledG : ledR; };
  return finish(g, hparts(h, { weapon: shield, extra: cords }), 1.85, anim, [led]);
}

// 薩克斯風音波射手：貝雷帽、閉眼陶醉鼓腮、酒紅風衣、圍巾、金色薩克斯風、飄浮走音音符
function sax() {
  const SK = 0x8d5a3b, COAT = 0x7a2335, COAT2 = 0x5e1a28;
  const h = humanoid({ skin: SK, shirt: COAT, pants: 0x2b2b2b, shoe: 0x5a3a22, sole: 0x2a1a10, W: 0.52, D: 0.32,
    face: { closed: true, brow: 0x1a1a1a, browTilt: -0.3, browY: 1.5, mouth: false } });
  const { g, body, head, armL, armR, foreL, foreR, HR } = h;
  // 風衣下擺、翻領、腰帶、鈕扣
  body.add(cyl(0.3, 0.38, 0.5, COAT, 0, -0.12, 0, { seg: 16 }));
  for (const s of [-1, 1]) body.add(at(box(0.1, 0.3, 0.04, COAT2), s * 0.1, 0.48, 0.165, 0, 0, s * 0.35));
  body.add(box(0.54, 0.07, 0.34, 0x2a1a10, 0, 0.16, 0));
  body.add(box(0.07, 0.07, 0.02, 0xd4a72c, 0, 0.16, 0.175, { outline: false }));
  for (let i = 0; i < 2; i++) body.add(sphere(0.018, 0x1a1a1a, 0.06, 0.32 + i * 0.12, 0.17, { outline: false }));
  // 背後風衣燕尾（會晃）
  const tails = grp(0, 0.1, -0.15, body);
  tails.add(at(box(0.44, 0.5, 0.05, COAT2), 0, -0.25, -0.03, 0.12, 0, 0));
  // 圍巾＋垂下的一端
  body.add(sc(at(torus(0.14, 0.05, 0xf2b134), 0, 0.62, 0, PI / 2, 0, 0), 1.2, 1, 1));
  const scarf = grp(0.1, 0.6, 0.12, body);
  scarf.add(at(box(0.09, 0.32, 0.03, 0xf2b134), 0, -0.15, 0.02, 0.15, 0, 0.1));
  scarf.add(box(0.09, 0.025, 0.035, 0xd8231a, 0.015, -0.3, 0.04, { outline: false }));
  // 貝雷帽、山羊鬍、鼓起的腮幫子、嘟嘴
  head.add(at(sc(sphere(HR * 1.05, 0x161616), 1.1, 0.35, 1.1), 0.05, HR * 1.75, -0.02, 0, 0, -0.25));
  head.add(sphere(HR * 0.08, 0x161616, 0.02, HR * 2.05, 0));
  head.add(at(cone(HR * 0.16, HR * 0.4, 0x1a1a1a), 0, HR * 0.28, HR * 0.86, PI, 0, 0));
  for (const s of [-1, 1]) head.add(sphere(HR * 0.3, SK, s * HR * 0.5, HR * 0.62, HR * 0.68));
  const mouth = sphere(HR * 0.14, 0x5a2a1e, 0, HR * 0.55, HR * 0.98, { outline: false }); head.add(mouth);
  // 薩克斯風：管身、U 彎、喇叭口、按鍵、吹嘴
  const S = grp(0, 0.28, 0.32, body); S.rotation.set(0.15, 0, -0.25);
  const GOLD = 0xe8b530;
  S.add(cyl(0.05, 0.065, 0.55, GOLD));
  S.add(at(torus(0.09, 0.065, GOLD, 0, 0, 0, { arc: PI, seg: 12 }), 0.09, -0.27, 0, 0, 0, PI));
  S.add(at(cyl(0.065, 0.15, 0.32, GOLD, 0, 0, 0, { open: true }), 0.18, -0.12, 0));
  S.add(at(torus(0.15, 0.018, 0xffd86a, 0, 0, 0, { outline: false }), 0.18, 0.04, 0, PI / 2, 0, 0));
  S.add(cyl(0.13, 0.13, 0.02, 0x3a2410, 0.18, 0.035, 0, { outline: false }));
  S.add(at(cyl(0.02, 0.025, 0.28, GOLD), -0.05, 0.36, 0.06, 0.6, 0, 0.4));
  S.add(at(cone(0.022, 0.08, 0x111111, 0, 0, 0, { outline: false }), -0.1, 0.48, 0.14, 0.6 + PI, 0, 0.4));
  for (let i = 0; i < 4; i++) S.add(sphere(0.026, 0xfff1b0, 0, 0.18 - i * 0.11, 0.06, { outline: false }));
  S.add(box(0.03, 0.3, 0.02, 0xc8952a, -0.05, 0.05, 0.05, { outline: false }));
  reach(armL, foreL, [0.11, 0.44, 0.4]); reach(armR, foreR, [-0.05, 0.16, 0.42]);
  hold(g, foreR, S);
  // 走音音符（浮在頭旁，往上飄）
  const notes = grp(0.45, 1.05, 0.15, body);
  const NOTE = [];
  const note = (x, y, c, r) => { const n = grp(x, y, 0, notes); n.rotation.z = r; n.add(sc(sphere(0.07, c), 1.3, 1, 0.5)); n.add(box(0.025, 0.24, 0.025, c, 0.07, 0.12, 0)); n.add(box(0.1, 0.025, 0.025, c, 0.11, 0.24, 0, { outline: false })); NOTE.push([n, x, y]); };
  note(0, 0, 0x9cff3a, 0.4); note(0.25, 0.32, 0xff4f9a, -0.5); note(-0.05, 0.6, 0xffd400, 0.8);
  // 琴盒＋銅板＋小費牌
  const case_ = grp(-0.45, 0, 0.3, g); case_.rotation.y = 0.5;
  case_.add(box(0.5, 0.08, 0.26, 0x222222, 0, 0.04, 0));
  case_.add(box(0.42, 0.02, 0.2, 0xc0283a, 0, 0.085, 0, { outline: false }));
  for (const [x, z] of [[0.06, 0.02], [-0.08, -0.04], [0.12, -0.05]]) case_.add(cyl(0.035, 0.035, 0.015, 0xf2c230, x, 0.1, z, { outline: false, seg: 10 }));
  const tip = label('TIPS', 0.18, { color: '#ffd23f', stroke: '#1b1226', size: 48 }); at(tip, 0, 0.18, -0.13, -0.3, 0, 0); case_.add(tip);
  const anim = (t) => {
    for (let i = 0; i < NOTE.length; i++) {
      const [n, x, y] = NOTE[i], k = (t * 0.35 + i / 3) % 1;
      n.position.set(x + Math.sin(t * 2 + i) * 0.06, y + k * 0.5 - 0.15, 0);
      n.scale.setScalar(Math.min(1, k * 6, (1 - k) * 5));
    }
  };
  return finish(g, hparts(h, { weapon: S, notes, extra: [tails, scarf] }), 1.85, anim);
}

// 下水道披薩鼠大師・老起司：駝背老鼠、白長眉白鬍、圓眼鏡、歪戴廚師帽、格紋桌巾披風、背上披薩盒、披薩刀法杖、牽絲披薩
function ratking() {
  const FUR = 0x8c7d70, FUR2 = 0x766a5e, PINK = 0xf2a0a8, BEL = 0xcfc2b0, WH = 0xf7f3ea;
  const h = humanoid({ skin: FUR, shirt: FUR, pants: FUR, shoe: PINK, sole: 0xe08a94, W: 0.6, D: 0.44, TH: 0.5, HR: 0.25, legR: 0.09, noHead: true });
  const { g, rig, body, head, armL, armR, foreL, foreR, legL, legR, HR } = h;
  body.rotation.x = 0.22;
  // 粉紅爪手取代圓掌
  for (const f of [foreL, foreR]) { f.remove(f.children[f.children.length - 1]); f.add(P(claw(PINK, 0.09), 0, FH, 0)); }
  // 桌巾披風（長袍）＋起司滴落領口＋臘腸腰帶
  body.add(at(part(cg('ratRobe', () => new THREE.CylinderGeometry(0.34, 0.5, 0.95, 16, 1, true)), 0, { mat: checkerMat() }), 0, 0.12, -0.02));
  body.add(sc(at(torus(0.32, 0.06, 0xffc93c), 0, 0.58, 0, PI / 2, 0, 0), 1.05, 0.85, 1));
  for (let i = 0; i < 5; i++) body.add(capsule(0.03, 0.06 + (i % 2) * 0.06, 0xffc93c, -0.24 + i * 0.12, 0.5 - (i % 2) * 0.03, 0.25 - Math.abs(i - 2) * 0.03, { outline: false }));
  body.add(box(0.36, 0.3, 0.06, BEL, 0, 0.3, 0.2));
  body.add(sc(at(torus(0.4, 0.04, 0x8a2a1a), 0, 0.02, 0, PI / 2, 0, 0), 1, 0.8, 1));
  for (let i = 0; i < 4; i++) body.add(cyl(0.05, 0.05, 0.02, 0xc0283a, -0.24 + i * 0.16, 0.02, 0.33, { outline: false }));
  // 背上一疊披薩盒
  for (let i = 0; i < 3; i++) body.add(at(box(0.5, 0.07, 0.5, i === 1 ? 0xe8d5b0 : 0xd8c49a), 0, 0.18 + i * 0.075, -0.42, 1.25, 0.05 * (i - 1), 0));
  // 頭：尖鼻、大耳、白長眉白鬍、圓眼鏡、門牙
  head.position.y += 0.02;
  head.add(sphere(HR, FUR, 0, HR * 0.95, 0));
  head.add(at(cone(HR * 0.62, HR * 1.5, FUR), 0, HR * 0.8, HR * 1.25, PI / 2, 0, 0));
  head.add(sphere(HR * 0.17, 0xe65a7a, 0, HR * 0.8, HR * 2.0));
  for (const s of [-1, 1]) head.add(box(HR * 0.17, HR * 0.24, 0.025, 0xffffff, s * HR * 0.09, HR * 0.38, HR * 1.4, { outline: false }));
  const mouth = box(HR * 0.42, HR * 0.08, 0.03, 0x4a1a1a, 0, HR * 0.52, HR * 1.38, { outline: false }); head.add(mouth);
  const eyes = [], whisk = [];
  for (const s of [-1, 1]) {
    head.add(at(cyl(HR * 0.62, HR * 0.62, 0.05, FUR), s * HR * 0.85, HR * 1.75, -0.02, PI / 2 - 0.2, 0, s * 0.5));
    head.add(at(cyl(HR * 0.45, HR * 0.45, 0.02, PINK, 0, 0, 0, { outline: false }), s * HR * 0.87, HR * 1.75, 0.01, PI / 2 - 0.2, 0, s * 0.5));
    const e = eye(HR * 0.16, { white: 0x2a1a1a, pupil: 0x111111, pr: 0.3 }); e.position.set(s * HR * 0.36, HR * 1.12, HR * 0.86); head.add(e); eyes.push(e);
    head.add(at(torus(HR * 0.25, 0.013, 0xc9a227, 0, 0, 0, { outline: false, seg: 16 }), s * HR * 0.36, HR * 1.12, HR * 0.97));
    // 下垂的白長眉（會晃）
    const brow = grp(s * HR * 0.4, HR * 1.36, HR * 0.8, head); brow.rotation.z = s * 1.15;
    brow.add(capsule(0.04, HR * 0.6, WH, 0, -HR * 0.32, 0));
    whisk.push(brow);
    // 鬍鬚（會晃）
    const w = grp(s * HR * 0.25, HR * 0.86, HR * 1.6, head);
    for (let i = 0; i < 2; i++) w.add(at(cyl(0.006, 0.006, HR * 1.6, WH, 0, 0, 0, { outline: false, seg: 4 }), s * HR * 0.7, HR * (i * 0.12 - 0.04), -HR * 0.1, 0, 0, s * (1.35 + i * 0.25)));
    whisk.push(w);
  }
  head.add(at(torus(HR * 0.12, 0.012, 0xc9a227, 0, 0, 0, { outline: false, arc: PI, seg: 8 }), 0, HR * 1.1, HR * 1.02, 0, 0, 0));
  // 白鬍子（會晃）
  const beard = grp(0, HR * 0.45, HR * 1.0, head);
  beard.add(at(cone(HR * 0.5, HR * 2.0, WH), 0, -HR * 0.4, HR * 0.35, PI + 0.5, 0, 0));
  // 歪戴的廚師帽
  const toque = grp(-HR * 0.3, HR * 1.75, -HR * 0.1, head); toque.rotation.z = 0.35;
  toque.add(cyl(HR * 0.42, HR * 0.4, HR * 0.4, 0xffffff, 0, 0, 0));
  for (const [x, z] of [[0, 0], [0.06, 0.05], [-0.06, 0.04], [0, -0.06]]) toque.add(sphere(HR * 0.3, 0xffffff, x, HR * 0.38, z, { outline: false }));
  toque.add(sphere(HR * 0.38, 0xffffff, 0, HR * 0.46, 0));
  // 尾巴（OK 繃）
  const tail = grp(0, 0.45, -0.25, rig);
  tail.add(tube([[0, 0, 0], [0, -0.29, -0.3], [0.28, -0.4, -0.45], [0.55, -0.35, -0.25], [0.52, -0.15, -0.05]], 0.05, PINK, { taper: 0.7, seg: 24 }));
  tail.add(at(cyl(0.05, 0.05, 0.06, 0xf3d2a0, 0, 0, 0, { outline: false, seg: 8 }), 0.28, -0.4, -0.45, 0, 0, PI / 2 - 0.3));
  // 右手：披薩刀法杖（刀輪會轉）＋垂吊的臘腸護符
  const staff = grp(0, FH, 0.05, foreR); staff.rotation.x = 0.6;
  staff.add(cyl(0.035, 0.035, 1.6, 0x7a4a24, 0, 0.35, 0));
  for (const y of [-0.2, 0.3]) staff.add(cyl(0.045, 0.045, 0.06, 0xc9a227, 0, y, 0, { outline: false }));
  const wheel = grp(0, 1.25, 0, staff);
  wheel.add(at(cyl(0.3, 0.3, 0.035, 0xd8dde2, 0, 0, 0, { seg: 24 }), 0, 0, 0, 0, 0, PI / 2));
  for (let i = 0; i < 3; i++) wheel.add(at(box(0.04, 0.5, 0.012, 0xa8b0b8, 0, 0, 0, { outline: false }), 0.02, 0, 0, i * PI / 3, 0, 0));
  wheel.add(at(torus(0.3, 0.015, 0xfff4a0, 0, 0, 0, { mat: flat(0xfff4a0), outline: false, seg: 28 }), 0, 0, 0, 0, PI / 2, 0));
  staff.add(at(cyl(0.07, 0.07, 0.08, 0xc0283a), 0, 1.25, 0, 0, 0, PI / 2));
  staff.add(box(0.07, 0.3, 0.07, 0xc0283a, 0, 1.05, 0));
  const charm = grp(0.04, 0.95, 0, staff);
  charm.add(cyl(0.005, 0.005, 0.16, 0x3a2a1a, 0, -0.08, 0, { outline: false, seg: 4 }));
  charm.add(at(cyl(0.05, 0.05, 0.02, 0xc0283a, 0, 0, 0, { seg: 10 }), 0, -0.18, 0, PI / 2, 0, 0));
  armR.rotation.set(-0.6, 0, -0.2);
  // 左手：牽絲披薩
  const pz = grp(0, FH - 0.02, 0.12, foreL); pz.rotation.set(1.0, 0, 0);
  const slice = slab([[-0.2, 0], [0.2, 0], [0, 0.42]], 0.04, 0xffc93c);
  slice.rotation.x = -PI / 2; pz.add(slice);
  pz.add(at(cyl(0.05, 0.05, 0.44, 0xc9853a), 0, 0, 0.02, 0, 0, PI / 2));
  for (const p of [[-0.06, -0.12], [0.06, -0.22], [0.0, -0.3]]) pz.add(cyl(0.045, 0.045, 0.02, 0xc0283a, p[0], 0.03, p[1], { outline: false }));
  const cheese = grp(0, 0.02, 0.02, pz);
  cheese.add(tube([[0.12, 0, 0], [0.16, -0.2, 0.1], [0.13, -0.47, 0.12]], 0.022, 0xfff0a0, { seg: 8, rs: 5 }));
  cheese.add(tube([[-0.1, 0, 0], [-0.14, -0.27, 0.08], [-0.1, -0.62, 0.08]], 0.02, 0xfff0a0, { seg: 8, rs: 5 }));
  cheese.add(sphere(0.04, 0xfff0a0, -0.1, -0.64, 0.08));
  armL.rotation.set(-0.7, 0, 0.3);
  // 飄浮的香料（奧勒岡葉）
  const herbs = grp(0, 1.4, 0, g); const HB = [];
  for (let i = 0; i < 4; i++) { const m = box(0.06, 0.012, 0.04, 0x4f8a2a, 0, 0, 0, { outline: false }); herbs.add(m); HB.push(m); }
  rig.scale.setScalar(1.25);
  const anim = (t) => {
    wheel.rotation.x = t * 2.2;
    herbs.rotation.y = t * 0.6;
    for (let i = 0; i < HB.length; i++) { const a = i * PI / 2; HB[i].position.set(Math.cos(a) * 0.85, Math.sin(t * 1.4 + i * 1.7) * 0.25, Math.sin(a) * 0.85); HB[i].rotation.set(t * 2 + i, t + i, 0); }
  };
  return finish(g, hparts(h, { weapon: staff, pizza: pz, eyes, mouth, tail, extra: [...whisk, beard, charm, cheese] }), 2.35, anim, HB);
}

// ── 第 7 關 ─────────────────────────────────────────
// 墨西哥辣椒飛行魔蝠：紅辣椒身體、蝙蝠翼、尖耳、小草帽、獠牙、辣椒籽子彈帶、尾端冒火、小爪腳
function chiliBat(red, hatBand, wingC, dark) {
  const g = new THREE.Group();
  const body = grp(0, 0.82, 0, g);
  const pep = grp(0, 0, 0, body); pep.rotation.z = 0.12;
  pep.add(sc(capsule(0.2, 0.22, red), 1, 1, 0.92));
  pep.add(sc(sphere(0.08, 0xffffff, 0.08, 0.12, 0.14, { mat: flat(0xffffff, { transparent: true, opacity: 0.45 }), outline: false }), 0.6, 1.4, 0.4));
  pep.add(sc(sphere(0.13, 0x3d8b2a, 0, 0.3, 0), 1.3, 0.45, 1.3));
  const stem = grp(0.04, 0.34, -0.02, pep);
  stem.add(tube([[0, 0, 0], [0.04, 0.1, 0], [0.12, 0.14, 0]], 0.03, 0x3d8b2a, { seg: 6, rs: 6, taper: 0.4 }));
  // 子彈帶（辣椒籽）
  pep.add(sc(at(torus(0.2, 0.025, 0x6b4a2a), 0, -0.05, 0, PI / 2, 0.6, 0), 1, 0.9, 1));
  for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; pep.add(at(sc(sphere(0.028, 0xfff1b0, 0, 0, 0, { outline: false, seg: 8 }), 0.7, 1.3, 0.7), Math.sin(a) * 0.205, -0.05 + Math.sin(a) * 0.12, Math.cos(a) * 0.19, 0, 0, 0)); }
  // 尾端：辣椒尖＋火焰（會閃）
  const tail = grp(0.04, -0.28, 0, pep); tail.rotation.z = -0.35;
  tail.add(at(cone(0.15, 0.3, red), 0, -0.12, 0, PI, 0, 0));
  const fire = grp(0, -0.3, 0, tail);
  fire.add(at(cone(0.07, 0.2, 0xff7a1a, 0, 0, 0, { mat: flat(0xff8a1a), outline: false, seg: 8 }), 0, -0.08, 0, PI, 0, 0));
  fire.add(at(cone(0.04, 0.13, 0xffe14a, 0, 0, 0, { mat: flat(0xffe14a), outline: false, seg: 8 }), 0, -0.05, 0.01, PI, 0, 0));
  const head = grp(0, 0.05, 0, body);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = eye(0.06, { look: -s * 0.3 }); e.position.set(s * 0.08, 0.06, 0.16); head.add(e); eyes.push(e);
    head.add(at(box(0.11, 0.025, 0.03, 0x1a1a1a, 0, 0, 0, { outline: false }), s * 0.08, 0.135, 0.19, 0, 0, s * -0.45));
    head.add(at(cone(0.02, 0.07, 0xffffff, 0, 0, 0, { outline: false, seg: 6 }), s * 0.04, -0.07, 0.19, PI, 0, 0));
    // 尖耳
    head.add(at(cone(0.06, 0.16, dark, 0, 0, 0, { seg: 6 }), s * 0.13, 0.24, 0.0, 0, 0, s * -0.5));
  }
  const mouth = box(0.12, 0.03, 0.03, 0x4a0d0d, 0, -0.03, 0.19, { outline: false }); head.add(mouth);
  // 草帽
  const hat = grp(0.02, 0.36, -0.02, head); hat.rotation.z = -0.25;
  hat.add(cyl(0.3, 0.3, 0.03, 0xf3d27a, 0, 0, 0, { seg: 20 }));
  hat.add(torus(0.3, 0.02, 0xe0b85a, 0, 0.01, 0, { outline: false, seg: 20 }));
  hat.children[1].rotation.x = PI / 2;
  hat.add(cone(0.13, 0.22, 0xf3d27a, 0, 0.11, 0));
  hat.add(cyl(0.11, 0.115, 0.05, hatBand, 0, 0.04, 0, { outline: false }));
  // 小爪腳
  const mkLeg = (s) => { const l = grp(s * 0.08, -0.22, 0.02, body); l.add(cyl(0.018, 0.018, 0.14, 0x2a1418, 0, -0.07, 0, { outline: false, seg: 5 })); l.add(P(claw(0x2a1418, 0.035, 0xffffff), 0, -0.15, 0)); return l; };
  const legL = mkLeg(1), legR = mkLeg(-1);
  const wingL = batWing(1, 0.62, 0.42, wingC, 0x2a1418); wingL.position.set(0.16, 0.05, -0.05); wingL.rotation.z = 0.3; body.add(wingL);
  const wingR = batWing(-1, 0.62, 0.42, wingC, 0x2a1418); wingR.position.set(-0.16, 0.05, -0.05); wingR.rotation.z = -0.3; body.add(wingR);
  const anim = (t) => { const k = 1 + 0.25 * Math.sin(t * 23) + 0.15 * Math.sin(t * 37); fire.scale.set(1, k, 1); };
  return finish(g, { body, head, wingL, wingR, legL, legR, tail, eyes, mouth, extra: [stem] }, 1.4, anim);
}
const batA = () => chiliBat(0xd8231a, 0x1f9d55, 0x4a2733, 0x5a1a1a);
const batB = () => chiliBat(0xff7417, 0xd8231a, 0x3b2c4a, 0x6a2a10);

// 德州雙槍牛排保鑣：超大牛仔帽、瞇眼、八字鬍、領巾、皮背心、T 骨牛排胸甲、星形皮帶扣、槍套、馬刺、雙左輪
function cowboy() {
  const LEA = 0x7a4a24, LEA2 = 0x5a3416, HAT = 0xf1e3c2;
  const h = humanoid({ skin: 0xe0a07a, shirt: 0xc0392b, pants: 0x3a5f9a, shoe: 0x6b3a1e, sole: 0x3a2410, glove: 0x8a5a2a, W: 0.7, D: 0.44, TH: 0.56, armR: 0.11, legR: 0.12, HR: 0.25,
    face: { brow: 0x5a3a1e, browTilt: 0.25, lid: 0xe0a07a, lidX: 0.3, mouth: false } });
  const { g, body, head, armL, armR, foreL, foreR, legL, legR, HR } = h;
  body.add(sphere(0.3, 0xc0392b, 0, 0.28, 0.1));
  // 皮背心兩片＋領巾
  for (const s of [-1, 1]) body.add(box(0.2, 0.52, 0.46, LEA, s * 0.26, 0.36, 0));
  body.add(at(cone(0.14, 0.22, 0xf2c230, 0, 0, 0, { seg: 3 }), 0, 0.55, 0.2, PI + 0.3, 0, 0));
  body.add(sc(at(torus(0.14, 0.04, 0xf2c230, 0, 0, 0, { seg: 14, outline: false }), 0, 0.64, 0, PI / 2, 0, 0), 1.2, 1, 1));
  // T 骨牛排胸甲（油花＋烤痕）
  const steak = grp(0, 0.42, 0.25, body);
  steak.add(sc(sphere(0.2, 0x9a3a26), 1.2, 1, 0.3));
  steak.add(box(0.05, 0.3, 0.05, 0xf3eadb, 0, 0, 0.05, { outline: false }));
  steak.add(box(0.22, 0.05, 0.05, 0xf3eadb, 0, 0.12, 0.05, { outline: false }));
  for (let i = 0; i < 3; i++) steak.add(at(box(0.3, 0.018, 0.01, 0x3a1410, 0, 0, 0, { outline: false }), 0, -0.1 + i * 0.09, 0.065, 0, 0, 0.5));
  steak.add(at(torus(0.19, 0.02, 0xf5e6d0, 0, 0, 0, { outline: false, arc: PI * 1.2, seg: 14 }), 0, 0, 0.04, 0, 0, -0.2));
  // 皮帶、星形扣、槍套
  body.add(box(0.66, 0.08, 0.46, 0x3a2410, 0, 0.1, 0));
  const star = slab(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.05 : 0.11, a = PI / 2 + i * PI / 5; return [Math.cos(a) * r, Math.sin(a) * r]; }), 0.03, 0xf2c230);
  star.position.set(0, 0.1, 0.24); body.add(star);
  for (const s of [-1, 1]) {
    body.add(at(box(0.12, 0.26, 0.16, LEA2), s * 0.37, -0.06, 0.04, 0, 0, s * 0.12));
  }
  // 八字鬍（會晃）＋鬢角
  const stache = grp(0, HR * 0.68, HR * 0.94, head);
  for (const s of [-1, 1]) stache.add(at(capsule(0.035, 0.12, 0x5a3a1e), s * 0.08, 0, 0, 0, 0, s * 1.2));
  for (const s of [-1, 1]) head.add(box(0.05, HR * 0.5, 0.06, 0x5a3a1e, s * HR * 0.88, HR * 0.8, HR * 0.3, { outline: false }));
  // 牛仔帽（超大，帶星章）
  const hat = grp(0, HR * 1.6, -0.02, head); hat.rotation.x = -0.1;
  hat.add(sc(cyl(0.48, 0.48, 0.04, HAT, 0, 0, 0, { seg: 24 }), 1, 1, 0.85));
  for (const s of [-1, 1]) hat.add(at(box(0.16, 0.04, 0.5, HAT), s * 0.38, 0.06, 0, 0, 0, s * 0.5));
  hat.add(cyl(0.21, 0.24, 0.3, HAT, 0, 0.16, 0));
  hat.add(box(0.2, 0.06, 0.3, 0xe0d0aa, 0, 0.3, 0, { outline: false }));
  hat.add(cyl(0.245, 0.245, 0.06, 0x5a3a1e, 0, 0.05, 0, { outline: false }));
  const hs = slab(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.025 : 0.055, a = PI / 2 + i * PI / 5; return [Math.cos(a) * r, Math.sin(a) * r]; }), 0.02, 0xd4dce4, { outline: false });
  hs.position.set(0, 0.06, 0.24); hat.add(hs);
  // 靴跟、馬刺、皮套褲流蘇
  for (const l of [legL, legR]) {
    l.add(box(0.1, 0.08, 0.1, 0x3a2410, 0, -0.66, -0.1));
    l.add(at(torus(0.045, 0.012, 0xd4dce4, 0, 0, 0, { outline: false, seg: 10 }), 0, -0.64, -0.16, 0, PI / 2, 0));
    l.add(box(0.03, 0.34, 0.05, LEA, (l.position.x > 0 ? 1 : -1) * 0.12, -0.25, 0, { outline: false }));
  }
  // 雙左輪：木柄、轉輪、槍管、準星
  const gun = (fore) => {
    const r = grp(0, FH, 0.04, fore);
    r.add(at(box(0.07, 0.08, 0.18, 0xf3eadb), 0, 0.0, -0.08, 0.3, 0, 0));
    r.add(cyl(0.055, 0.055, 0.1, 0x8a9096, 0, -0.1, 0.02));
    r.add(cyl(0.032, 0.032, 0.32, 0x8a9096, 0, -0.28, 0.04));
    r.add(box(0.015, 0.03, 0.02, 0x4a4f55, 0, -0.42, 0.08, { outline: false }));
    return r;
  };
  const gR = gun(foreR), gL = gun(foreL);
  armR.rotation.set(-1.25, 0, -0.15); armL.rotation.set(-1.25, 0, 0.15);
  // 叼著的牙籤（會晃）
  const pick = grp(HR * 0.15, HR * 0.55, HR * 0.95, head);
  pick.add(at(cyl(0.008, 0.008, 0.16, 0xe8d5a0, 0, 0, 0, { outline: false, seg: 4 }), 0.06, 0, 0.04, PI / 2, 0, -0.6));
  const mouth = box(HR * 0.4, HR * 0.08, 0.02, 0x3a1a10, 0, HR * 0.5, HR * 0.93, { outline: false }); head.add(mouth);
  return finish(g, hparts(h, { weapon: gR, weapon2: gL, mouth, extra: [stache, pick] }), 2.0);
}

// 鑄鐵煙燻機甲・牛胸肉 9000 號：橫置煙燻桶身體、鉚釘、側邊火箱、煙囪冒煙、溫度計、肉探針天線、背上肋排、烤網拳、平底鍋腳
function mecha() {
  const g = new THREE.Group();
  const IRON = 0x45403d, IRON2 = 0x5d5652, EMB = 0xff7a1a, RUST = 0xa0522d, DK = 0x1f1c1a;
  const HIP = 1.15;
  const mkLeg = (s) => {
    const l = grp(s * 0.5, HIP, 0, g);
    l.add(cyl(0.2, 0.17, 0.6, IRON2, 0, -0.3, 0));
    l.add(cyl(0.05, 0.05, 0.5, 0xb8c0c8, s * 0.2, -0.45, 0.1, { outline: false, seg: 8 }));
    l.add(sphere(0.2, RUST, 0, -0.62, 0.02));
    l.add(box(0.32, 0.45, 0.34, IRON, 0, -0.85, 0));
    for (const y of [-0.7, -1.0]) for (const x of [-0.11, 0.11]) l.add(sphere(0.025, DK, x, y, 0.175, { outline: false, seg: 6 }));
    // 鑄鐵平底鍋當腳
    l.add(cyl(0.36, 0.3, 0.13, 0x2a2624, 0, -1.08, 0.08, { seg: 20 }));
    l.add(box(0.1, 0.06, 0.4, 0x2a2624, 0, -1.06, -0.42));
    return l;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  const body = grp(0, HIP, 0, g);
  // 主桶身＋兩端鏽圈＋鉚釘
  body.add(at(cyl(0.62, 0.62, 1.45, IRON, 0, 0, 0, { seg: 20 }), 0, 0.72, 0, 0, 0, PI / 2));
  for (const s of [-1, 1]) body.add(at(cyl(0.64, 0.64, 0.08, RUST, 0, 0, 0, { seg: 20 }), s * 0.62, 0.72, 0, 0, 0, PI / 2));
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; body.add(sphere(0.03, 0x2a2624, s * 0.67, 0.72 + Math.cos(a) * 0.55, Math.sin(a) * 0.55, { outline: false, seg: 6 })); }
  // 桶蓋縫線、鉸鏈、木把手
  body.add(box(1.3, 0.05, 0.05, DK, 0, 0.88, 0.6, { outline: false }));
  for (const x of [-0.4, 0.4]) body.add(box(0.14, 0.06, 0.1, 0x2a2624, x, 1.2, -0.42, { outline: false }));
  body.add(at(cyl(0.05, 0.05, 0.7, 0xb07a44), 0, 1.0, 0.72, 0, 0, PI / 2));
  for (const s of [-1, 1]) body.add(box(0.05, 0.12, 0.12, DK, s * 0.3, 0.96, 0.66));
  // 臉：LED 眼（會眨）、烤架嘴（炭火光）、溫度計
  const eyes = [], ledMat = own(0xff2a1a);
  for (const s of [-1, 1]) {
    const e = grp(s * 0.2, 0.68, 0.62, body); e.rotation.z = s * -0.25;
    e.add(box(0.24, 0.07, 0.04, 0, 0, 0, 0, { mat: ledMat, outline: false }));
    e.add(box(0.28, 0.11, 0.03, DK, 0, 0, -0.012, { outline: false }));
    eyes.push(e);
  }
  const gauge = grp(0, 0.42, 0.56, body); gauge.rotation.x = 0.5;
  gauge.add(at(cyl(0.13, 0.13, 0.05, 0xf3eadb), 0, 0, 0, PI / 2, 0, 0));
  gauge.add(at(torus(0.13, 0.02, 0xc9a227, 0, 0, 0, { outline: false, seg: 16 }), 0, 0, 0.02, 0, 0, 0));
  const needle = grp(0, 0, 0.03, gauge);
  needle.add(box(0.02, 0.1, 0.02, 0xd8231a, 0, 0.04, 0.01, { outline: false }));
  const lab = label('BRISKET 9000', 0.9, { color: '#ffd23f', stroke: '#2a1a10', size: 56 });
  lab.position.set(0, 0.2, 0.6); lab.rotation.x = -0.35; body.add(lab);
  // 腹部火箱＋發光炭火（閃爍）＋爐門柵欄
  body.add(box(0.6, 0.62, 0.7, IRON2, 0.0, 0.0, 0.0));
  const emb = own(EMB);
  const mouth = box(0.44, 0.22, 0.04, 0, 0, 0.04, 0.36, { mat: emb, outline: false }); body.add(mouth);
  for (let i = 0; i < 4; i++) body.add(box(0.03, 0.24, 0.03, DK, -0.15 + i * 0.1, 0.04, 0.39, { outline: false }));
  body.add(box(0.5, 0.05, 0.06, RUST, 0, -0.12, 0.37, { outline: false }));
  // 側掛工具：夾子、刷子（會晃）
  const tools = grp(0.72, 0.5, 0.2, body);
  tools.add(box(0.03, 0.4, 0.03, 0xb8c0c8, 0, -0.2, 0, { outline: false }));
  tools.add(box(0.06, 0.08, 0.04, 0x2a2624, 0, -0.42, 0));
  // 背上掛的肋排
  const ribs = grp(0, 0.85, -0.66, body); ribs.rotation.x = -0.25;
  ribs.add(box(0.7, 0.28, 0.1, 0x8a3a1a, 0, 0, 0));
  for (let i = 0; i < 5; i++) ribs.add(cyl(0.025, 0.025, 0.36, 0xf3eadb, -0.28 + i * 0.14, 0, 0.02, { outline: false, seg: 6 }));
  ribs.add(box(0.72, 0.04, 0.12, 0x5a1e0a, 0, 0.1, 0.01, { outline: false }));
  // 煙囪＋會上升的煙
  body.add(cyl(0.12, 0.12, 0.62, IRON2, -0.55, 1.3, -0.18));
  body.add(cyl(0.2, 0.16, 0.08, RUST, -0.55, 1.62, -0.18));
  const smoke = grp(-0.55, 1.68, -0.18, body);
  const PUFF = [];
  for (let i = 0; i < 4; i++) { const m = sphere(0.16, 0xd8d4cf, 0, 0, 0, { transparent: true, opacity: 0.75, outline: false, shadow: false }); smoke.add(m); PUFF.push(m); }
  // 肉探針天線＋閃燈
  const probe = grp(0.42, 1.25, -0.25, body); probe.rotation.z = -0.2;
  probe.add(cyl(0.015, 0.015, 0.5, 0xd4dce4, 0, 0.25, 0, { outline: false, seg: 6 }));
  const tipMat = own(0xff3a2a);
  const ptip = sphere(0.045, 0, 0, 0.52, 0, { mat: tipMat, outline: false }); probe.add(ptip);
  // 小牛仔帽（頭）
  const head = grp(0.15, 1.33, 0, body);
  const hat = grp(0.15, 0, 0, head); hat.rotation.z = -0.2;
  hat.add(cyl(0.34, 0.34, 0.04, 0x7a4a24, 0, 0, 0, { seg: 20 }));
  hat.add(cyl(0.16, 0.19, 0.24, 0x7a4a24, 0, 0.13, 0));
  hat.add(cyl(0.195, 0.195, 0.05, 0x3a2410, 0, 0.04, 0, { outline: false }));
  // 手臂：鏽肩甲＋排煙管手臂＋烤網拳（炭火光）
  const mkArm = (s) => {
    const a = grp(s * 0.74, 0.95, 0, body);
    a.add(sphere(0.2, RUST, 0, 0, 0));
    a.add(sc(dome(0.27, IRON2), 1, 0.8, 1));
    a.add(cyl(0.12, 0.12, 0.55, IRON2, 0, -0.32, 0));
    a.add(torus(0.13, 0.03, DK, 0, -0.18, 0, { outline: false, seg: 12 })); a.children[a.children.length - 1].rotation.x = PI / 2;
    const f = grp(0, -0.62, 0, a);
    f.add(sphere(0.14, IRON));
    f.add(cyl(0.15, 0.13, 0.35, IRON2, 0, -0.2, 0));
    const fist = grp(0, -0.5, 0.02, f);
    fist.add(box(0.46, 0.4, 0.46, 0x2a2624, 0, 0, 0));
    fist.add(box(0.36, 0.3, 0.04, 0, 0, 0, 0.22, { mat: emb, outline: false }));
    for (let i = 0; i < 4; i++) fist.add(box(0.035, 0.36, 0.04, DK, -0.135 + i * 0.09, 0, 0.25, { outline: false }));
    for (let i = 0; i < 3; i++) fist.add(box(0.1, 0.1, 0.12, 0x3a3532, -0.15 + i * 0.15, 0.22, 0.12));
    a.rotation.set(-0.25, 0, s * 0.1); f.rotation.x = -0.15;
    return { a, f, fist };
  };
  const L = mkArm(1), R = mkArm(-1);
  const anim = (t) => {
    for (let i = 0; i < PUFF.length; i++) {
      const k = (t * 0.45 + i / PUFF.length) % 1;
      PUFF[i].position.set(Math.sin(t + i * 2) * 0.08 + k * 0.15, k * 0.9, 0);
      PUFF[i].scale.setScalar(0.5 + k * 1.1);
    }
    const f = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3);
    emb.color.setRGB(1, 0.36 + 0.2 * f, 0.08 * f);
    needle.rotation.z = -0.8 + Math.sin(t * 0.7) * 0.5;
    ptip.visible = blink(t, 1.2, 0.5);
    ledMat.color.setRGB(1, 0.12 + 0.1 * Math.sin(t * 3), 0.08);
  };
  return finish(g, { body, head, armL: L.a, armR: R.a, forearmL: L.f, forearmR: R.f, legL, legR, weapon: R.fist, smoke, eyes, mouth, extra: [tools, probe] }, 3.0, anim, [ptip, ...PUFF]);
}

// ── 第 8 關 ─────────────────────────────────────────
// 喝醉的兄弟會猛男：曬紅肌肉、曬痕、醉眼、大笑、啤酒罐頭盔（吸管會晃）、花圈、夾腳拖、抱啤酒桶（泡沫）
function frat() {
  const SK = 0xf0a08a, SK2 = 0xe0806a;
  const h = humanoid({ skin: SK, shirt: 0xffffff, pants: 0xc8b07a, leg: SK, shoe: null, sleeve: SK, W: 0.74, D: 0.42, TH: 0.56, armR: 0.13, legR: 0.11,
    face: { look: 0.6, lid: SK2, lidX: 0.25, lidTilt: 0.2, brow: 0x8a5a2a, browTilt: -0.25, browY: 1.5, mouth: 0x7a1e1e, mouthW: 0.62, mouthH: 0.2, my: 0.5, teeth: true, tongue: true } });
  const { g, body, head, armL, armR, foreL, foreR, legL, legR, HR } = h;
  for (const s of [-1, 1]) body.add(sphere(0.17, SK, s * 0.36, 0.5, 0));
  for (const s of [-1, 1]) head.add(sphere(HR * 0.2, 0xff6a6a, s * HR * 0.6, HR * 0.72, HR * 0.78, { outline: false }));
  // 背心肩帶、希臘字母、腹肌線
  for (const s of [-1, 1]) body.add(box(0.1, 0.14, 0.43, 0xffffff, s * 0.2, 0.6, 0, { outline: false }));
  const lt = label('ΩΜΓ', 0.4, { color: '#c0283a', size: 64 });
  lt.position.set(0, 0.38, 0.215); body.add(lt);
  // 夏威夷花圈
  const lei = grp(0, 0.6, 0.02, body);
  const LEI = [0xff4f9a, 0xffd23f, 0x7dff4a, 0xff7a1a];
  for (let i = 0; i < 9; i++) { const a = -PI * 0.85 + i * PI * 0.21; lei.add(sphere(0.045, LEI[i % 4], Math.sin(a) * 0.24, -Math.abs(Math.cos(a * 0.5)) * 0.05 - (1 - Math.abs(Math.sin(a))) * 0.12, Math.cos(a) * 0.2, { outline: false, seg: 8 })); }
  // 短褲（花紋）＋夾腳拖
  for (const l of [legL, legR]) {
    l.add(cyl(0.14, 0.15, 0.28, 0xc8b07a, 0, -0.12, 0));
    l.add(sphere(0.04, 0xff7a1a, 0.08, -0.08, 0.1, { outline: false, seg: 8 }));
    l.add(box(0.2, 0.04, 0.34, 0x1f9dd8, 0, -0.68, 0.06));
    l.add(sc(sphere(0.1, SK), 1, 0.6, 1.4)); l.children[l.children.length - 1].position.set(0, -0.62, 0.05);
    l.add(box(0.03, 0.05, 0.12, 0xffd23f, 0, -0.63, 0.12, { outline: false }));
  }
  // 啤酒罐頭盔＋吸管（會晃）＋推到頭上的墨鏡
  const hat = grp(0, HR * 1.5, 0, head); hat.rotation.z = 0.15;
  hat.add(sc(dome(HR * 1.08, 0xc0283a), 1, 0.85, 1));
  const straws = [];
  for (const s of [-1, 1]) {
    hat.add(cyl(0.07, 0.07, 0.2, 0xd6d9dc, s * HR * 1.1, 0.06, 0));
    hat.add(cyl(0.07, 0.07, 0.08, 0x2f6fcf, s * HR * 1.1, 0.06, 0, { outline: false }));
    const st = grp(s * HR * 1.1, -0.04, 0.04, hat);
    st.add(tube([[0, 0, 0], [-s * HR * 0.2, -0.26, HR * 0.6], [s * 0.02 - s * HR * 1.1, -HR * 0.81, HR * 0.95]], 0.012, 0xffffff, { seg: 8, rs: 4, outline: false }));
    straws.push(st);
  }
  hat.add(box(HR * 1.4, HR * 0.22, 0.05, 0x111111, 0, HR * 0.1, HR * 0.95));
  // 啤酒桶（雙手抱在胸前，泡沫溢出）
  const keg = grp(0, 0.3, 0.42, body); keg.rotation.z = PI / 2;
  keg.add(cyl(0.23, 0.23, 0.6, 0xc9ced3, 0, 0, 0, { seg: 18 }));
  for (const y of [-0.2, 0.2]) keg.add(cyl(0.245, 0.245, 0.04, 0x8a9096, 0, y, 0, { seg: 18 }));
  keg.add(cyl(0.06, 0.06, 0.1, 0xc0283a, 0, 0.33, 0));
  const foam = grp(0, 0.4, 0, keg);
  for (const [x, y, z, r] of [[0, 0, 0, 0.07], [0.05, 0.03, 0.04, 0.05], [-0.04, 0.02, -0.03, 0.055]]) foam.add(sphere(r, 0xfffbe8, x, y, z, { outline: false, seg: 10 }));
  reach(armL, foreL, [0.3, 0.36, 0.38]); reach(armR, foreR, [-0.3, 0.36, 0.38]);
  hold(g, foreR, keg);
  const anim = (t) => { foam.scale.setScalar(1 + 0.15 * Math.sin(t * 4)); };
  return finish(g, hparts(h, { weapon: keg, extra: straws }), 1.95, anim);
}

// 深夜宿醉怨靈：漂浮床單鬼（下擺抖動）、黑眼圈、綠舌頭、冰袋、外帶咖啡、空酒瓶、暈眩星星與 Zzz
function ghost() {
  const g = new THREE.Group();
  const SHEET = 0xe9f3e2;
  const body = grp(0, 0.62, 0, g);
  const geo = cg('ghostSheet', () => {
    const prof = [];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * PI / 2; prof.push(new THREE.Vector2(Math.sin(a) * 0.42 + 0.0001, 0.72 + Math.cos(a) * 0.45)); }
    prof.push(new THREE.Vector2(0.46, 0.4), new THREE.Vector2(0.54, 0.12), new THREE.Vector2(0.6, 0));
    const gg = new THREE.LatheGeometry(prof, 24);
    const pos = gg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y < 0.2) { const a = Math.atan2(v.z, v.x); v.y += Math.sin(a * 7) * 0.07 * (1 - v.y / 0.2); }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    gg.computeVertexNormals();
    return gg;
  });
  const sheet = part(geo, SHEET, { mat: toon(SHEET, { side: THREE.DoubleSide, emissive: 0x24301f, emissiveIntensity: 0.4 }) });
  body.add(sheet);
  // 床單皺褶、補丁
  body.add(at(box(0.16, 0.14, 0.02, 0xbfd8f0, 0, 0, 0, { outline: false }), -0.25, 0.3, 0.43, 0, -0.5, 0.2));
  for (const s of [-1, 1]) body.add(at(capsule(0.025, 0.3, 0xd8e6d0, 0, 0, 0, { outline: false, seg: 6 }), s * 0.32, 0.35, 0.36, 0.2, 0, s * 0.25));
  const head = grp(0, 0.72, 0, body);
  const eyes = [];
  for (const s of [-1, 1]) {
    head.add(sc(sphere(0.1, 0x6a4a7a, s * 0.15, 0.18, 0.36, { outline: false }), 1.2, 1, 0.5));
    const e = grp(s * 0.15, 0.2, 0.38, head);
    e.add(sc(sphere(0.085, 0x161616, 0, 0, 0, { outline: false }), 1, 1.15, 0.5));
    e.add(sphere(0.022, 0xffffff, s * 0.02 + 0.02, 0.03, 0.04, { mat: flat(0xffffff), outline: false }));
    e.add(sc(sphere(0.06, SHEET, 0, 0.07, 0.03, { outline: false }), 1.8, 0.7, 0.5));
    eyes.push(e);
    head.add(at(capsule(0.018, 0.1, 0x9aa89a, 0, 0, 0, { outline: false, seg: 6 }), s * 0.16, 0.33, 0.39, 0, 0, s * (PI / 2 + 0.35)));
  }
  const mouth = sc(sphere(0.09, 0x161616, 0, -0.02, 0.4, { outline: false }), 1.2, 0.8, 0.5); head.add(mouth);
  const tongue = grp(0.02, -0.06, 0.42, head);
  tongue.add(at(capsule(0.05, 0.1, 0x8fe04a), 0, -0.05, 0, 0.4, 0, 0));
  // 冰袋（冰塊）
  const ice = grp(0.05, 0.44, 0.05, head); ice.rotation.z = 0.25;
  ice.add(sc(sphere(0.2, 0x5fc6e8), 1.1, 0.4, 1));
  ice.add(at(box(0.05, 0.1, 0.05, 0xffffff), 0.22, 0.02, 0, 0, 0, -0.8));
  for (const [x, z] of [[-0.06, 0.04], [0.06, -0.03]]) ice.add(at(box(0.06, 0.06, 0.06, 0xe8fbff, 0, 0, 0, { outline: false }), x, 0.06, z, 0.4, 0.5, 0));
  // 暈眩星星（環繞）＋ Zzz
  const stars = grp(0, 0.62, 0, head);
  for (let i = 0; i < 3; i++) { const a = i * 2.1; stars.add(sphere(0.05, 0xffe14a, Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32, { mat: flat(0xffe14a), outline: false })); }
  const zz = grp(0.4, 0.5, 0, head); const ZZ = [];
  for (let i = 0; i < 2; i++) { const z = label('Z', 0.14 - i * 0.03, { color: '#bfe3ff', stroke: '#1b1226', size: 64 }); zz.add(z); ZZ.push(z); }
  // 床單小手
  const mkArm = (s) => { const a = grp(s * 0.42, 0.52, 0.05, body); a.add(capsule(0.08, 0.2, SHEET, 0, -0.16, 0)); a.rotation.z = s * 0.6; return a; };
  const armL = mkArm(1), armR = mkArm(-1);
  const cup = grp(0, -0.34, 0.06, armR); armR.rotation.set(-0.8, 0, -0.5);
  cup.add(cyl(0.08, 0.06, 0.2, 0xffffff, 0, 0, 0));
  cup.add(cyl(0.085, 0.085, 0.04, 0x3a2410, 0, 0.11, 0));
  cup.add(cyl(0.083, 0.07, 0.07, 0x8a5a3a, 0, -0.01, 0, { outline: false }));
  const steam = grp(0, 0.14, 0, cup);
  steam.add(tube([[0, 0, 0], [0.03, 0.06, 0], [-0.02, 0.12, 0], [0.02, 0.18, 0]], 0.012, 0xffffff, { seg: 8, rs: 4, outline: false, transparent: true, opacity: 0.6 }));
  const bot = grp(0, -0.34, 0.06, armL); armL.rotation.set(0.3, 0, 0.7);
  bot.add(cyl(0.06, 0.06, 0.2, 0x2f8a3a, 0, -0.05, 0));
  bot.add(cyl(0.025, 0.04, 0.1, 0x2f8a3a, 0, -0.18, 0));
  bot.add(cyl(0.062, 0.062, 0.08, 0xf3eadb, 0, -0.04, 0, { outline: false }));
  const anim = (t) => {
    stars.rotation.y = t * 2.2;
    for (let i = 0; i < ZZ.length; i++) { const k = (t * 0.4 + i * 0.5) % 1; ZZ[i].position.set(k * 0.2, k * 0.45, 0); ZZ[i].scale.setScalar(Math.min(1, k * 5, (1 - k) * 4)); }
    sheet.rotation.y = Math.sin(t * 1.3) * 0.08;
    steam.rotation.y = t * 1.5;
  };
  return finish(g, { body, head, armL, armR, wingL: armL, wingR: armR, weapon: cup, stars, eyes, mouth, extra: [tongue, ice] }, 1.9, anim, [sheet]);
}

// 摺疊椅精準投擲專家：摔角緊身衣、頭帶（飄帶）、鯔魚頭、怒吼、冠軍腰帶、護腕、舉椅過頭、背上一疊備用椅
function foldChair(c = 0x9aa3ab) {
  const ch = grp();
  ch.add(box(0.42, 0.04, 0.4, c, 0, 0, 0));
  ch.add(box(0.42, 0.28, 0.04, c, 0, 0.24, -0.2));
  ch.add(box(0.2, 0.05, 0.01, 0x5a6168, 0, 0.3, -0.175, { outline: false }));
  for (const [x, z, r] of [[0.19, 0.17, 0.25], [-0.19, 0.17, 0.25], [0.19, -0.18, -0.15], [-0.19, -0.18, -0.15]])
    ch.add(at(cyl(0.018, 0.018, 0.46, 0x5a6168, 0, 0, 0, { seg: 6 }), x, -0.2, z, r, 0, 0));
  return ch;
}
function chairman() {
  const TEAL = 0x13a89e, SK = 0xd99a6c, HAIR = 0x6b3a1e, RED = 0xe0362c;
  const h = humanoid({ skin: SK, shirt: TEAL, pants: TEAL, leg: SK, shoe: 0xffffff, sole: RED, sleeve: SK, W: 0.62, D: 0.38, armR: 0.1,
    face: { brow: 0x4a2a14, browTilt: 0.45, er: 0.2, mouth: 0x4a1a10, mouthW: 0.42, mouthH: 0.26, my: 0.5, teeth: true, tongue: true } });
  const { g, body, head, armL, armR, foreL, foreR, legL, legR, HR } = h;
  for (const s of [-1, 1]) body.add(box(0.14, 0.2, 0.36, SK, s * 0.27, 0.52, 0));
  body.add(sc(sphere(0.12, SK, 0, 0.62, 0.12, { outline: false }), 1.6, 0.6, 0.6));
  // 冠軍腰帶（側板＋寶石）
  body.add(box(0.6, 0.12, 0.4, 0x2a2a2a, 0, 0.12, 0));
  body.add(at(sc(cyl(0.12, 0.12, 0.03, 0xf2c230, 0, 0, 0, { seg: 16 }), 1.3, 1, 1), 0, 0.12, 0.2, PI / 2, 0, 0));
  body.add(sphere(0.035, 0xd8231a, 0, 0.12, 0.225, { outline: false }));
  for (const s of [-1, 1]) body.add(at(box(0.1, 0.08, 0.02, 0xd4a72c, 0, 0, 0, { outline: false }), s * 0.2, 0.12, 0.19, 0, s * 0.3, 0));
  // 頭帶＋飄帶（會晃）＋鯔魚頭＋八字鬍
  head.add(cyl(HR * 1.02, HR * 1.02, 0.07, RED, 0, HR * 1.35, 0));
  const band = grp(0, HR * 1.35, -HR * 0.95, head);
  for (const s of [-1, 1]) band.add(at(box(0.05, 0.22, 0.015, RED, 0, 0, 0, { outline: false }), s * 0.03, -0.1, -0.02, 0.4, 0, s * 0.3));
  head.add(at(sc(dome(HR * 1.05, HAIR, { cut: 0.42 }), 1, 0.8, 1), 0, HR * 1.42, 0));
  const mullet = grp(0, HR * 1.0, -HR * 0.85, head);
  mullet.add(box(HR * 1.3, HR * 1.0, 0.12, HAIR, 0, -HR * 0.35, 0));
  for (const x of [-0.08, 0.08]) mullet.add(cone(0.05, 0.12, HAIR, x, -HR * 0.95, 0, { seg: 6 })), mullet.children[mullet.children.length - 1].rotation.x = PI;
  head.add(at(capsule(0.03, 0.14, HAIR), 0, HR * 0.72, HR * 0.95, 0, 0, PI / 2));
  // 怒吼的血管
  head.add(at(box(0.05, 0.015, 0.01, 0xc0283a, 0, 0, 0, { outline: false }), HR * 0.45, HR * 1.6, HR * 0.72, 0, 0.5, 0.6));
  // 護腕、護膝與摔角靴
  for (const f of [foreL, foreR]) f.add(cyl(0.1, 0.1, 0.1, 0xffffff, 0, -0.14, 0, { outline: false }));
  for (const l of [legL, legR]) { l.add(box(0.22, 0.24, 0.22, 0xffffff, 0, -0.52, 0)); l.add(box(0.2, 0.06, 0.3, RED, 0, -0.38, 0.03, { outline: false })); l.add(box(0.06, 0.18, 0.01, RED, 0, -0.5, 0.115, { outline: false })); }
  // 雙手把椅子舉過頭
  const chair = foldChair(); chair.position.set(0, 1.18, -0.02); chair.rotation.set(-0.6, 0, 0.15); body.add(chair);
  armL.rotation.set(-2.95, 0, -0.45); armR.rotation.set(-2.95, 0, 0.45);
  hold(g, foreR, chair);
  // 背上的備用椅（綁帶）
  for (let i = 0; i < 2; i++) body.add(at(box(0.44, 0.62, 0.05, i ? 0x8a939b : 0xb0b8bf), 0, 0.35 + i * 0.04, -0.25 - i * 0.06, 0.15, 0, 0.12));
  body.add(at(box(0.05, 0.7, 0.42, 0x3a2a1a, 0, 0, 0, { outline: false }), 0.18, 0.4, -0.12, 0, 0, 0.5));
  return finish(g, hparts(h, { weapon: chair, extra: [band, mullet] }), 2.25);
}

// 要求退費的暗影飛翼奧客・馬庫斯：漂染刺蝟頭、額上環繞墨鏡、怒吼、POLO 立領、腰包、錄影手機、蝙蝠翅膀、超長收據
function marcus() {
  const SK = 0xe8a07c;
  const h = humanoid({ skin: SK, shirt: 0xf28b82, pants: 0xc8b07a, leg: SK, shoe: 0xffffff, sole: 0x8a8a8a, W: 0.6, D: 0.38, HR: 0.27,
    face: { er: 0.2, ey: 1.0, look: 0.1, pr: 0.38, brow: 0x3a2a14, browTilt: 0.55, browY: 1.15, mouth: 0x3a0d0d, mouthW: 0.55, mouthH: 0.32, my: 0.42, teeth: true, tongue: true } });
  const { g, rig, body, head, armL, armR, foreL, foreR, legL, legR, HR } = h;
  rig.position.y = 0.55;
  // POLO 立領、鈕扣、胸前小徽章、腰包
  for (const s of [-1, 1]) body.add(at(box(0.16, 0.1, 0.12, 0xffffff), s * 0.09, 0.62, 0.13, -0.3, 0, s * 0.4));
  for (let i = 0; i < 2; i++) body.add(sphere(0.015, 0xffffff, 0, 0.5 - i * 0.07, 0.175, { outline: false, seg: 6 }));
  body.add(at(slab([[-0.04, 0], [0, 0.02], [0.04, 0], [0.02, -0.02], [0, 0], [-0.02, -0.02]], 0.01, 0x4a2347, { outline: false }), 0.15, 0.48, 0.175));
  body.add(box(0.36, 0.14, 0.12, 0x1f6f6f, 0, 0.08, 0.22));
  body.add(box(0.3, 0.02, 0.01, 0xd4dce4, 0, 0.12, 0.282, { outline: false }));
  body.add(box(0.7, 0.04, 0.42, 0x1f4f4f, 0, 0.08, 0, { outline: false }));
  for (const l of [legL, legR]) { l.add(cyl(0.14, 0.15, 0.3, 0xc8b07a, 0, -0.12, 0)); l.add(box(0.1, 0.1, 0.03, 0xb09a6a, (l.position.x > 0 ? 1 : -1) * 0.13, -0.15, 0.04, { outline: false })); l.add(cyl(0.1, 0.1, 0.16, 0xffffff, 0, -0.52, 0)); }
  // 紅臉、額頭青筋
  for (const s of [-1, 1]) head.add(sc(sphere(HR * 0.18, 0xff6a5a, s * HR * 0.55, HR * 0.72, HR * 0.8, { outline: false }), 1.2, 0.8, 0.5));
  const vein = grp(HR * 0.4, HR * 1.42, HR * 0.78, head);
  for (const r of [0.5, -0.5]) vein.add(at(box(0.07, 0.016, 0.01, 0xc0283a, 0, 0, 0, { outline: false }), 0, 0, 0, 0, 0, r));
  // 刺蝟頭（漂染尖端，會晃）
  const spikes = grp(0, HR * 1.55, -0.03, head);
  for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 1.8; spikes.add(at(cone(0.06, 0.2, i % 2 ? 0xf5d76e : 0xf8e7a0, 0, 0, 0, { seg: 8 }), Math.sin(a) * HR * 0.7, HR * 0.2, Math.cos(a) * HR * 0.1 - 0.02, -0.3, 0, -a * 0.6)); }
  spikes.add(sc(dome(HR * 1.02, 0x8a6a3a, { cut: 0.38 }), 1, 0.7, 1)); spikes.children[spikes.children.length - 1].position.set(0, -HR * 0.32, 0.02);
  // 環繞墨鏡（推在額頭上方）
  head.add(at(torus(HR * 0.97, 0.035, 0x161616, 0, 0, 0, { seg: 24 }), 0, HR * 1.42, 0, PI / 2 - 0.15, 0, 0));
  head.add(at(box(HR * 1.3, HR * 0.2, 0.04, 0x2a3a5a, 0, 0, 0, { outline: false }), 0, HR * 1.47, HR * 0.92, -0.3, 0, 0));
  head.add(at(cone(0.06, 0.12, 0x8a5a2a), 0, HR * 0.14, HR * 0.86, PI, 0, 0));
  // 右手：超長收據（揮舞，每段會飄）
  const receipt = grp(0, FH - 0.02, 0.08, foreR);
  const RW = 0.28, segs = [];
  let parent = receipt;
  for (let i = 0; i < 4; i++) {
    const s = grp(0, i ? 0 : 0, i ? -0.28 : -0.1, parent); s.rotation.x = i % 2 ? 0.35 : -0.2;
    s.add(box(RW, 0.015, 0.3, 0xfaf8f0, 0, 0, -0.13, { r: 0.004 }));
    s.add(box(RW * 0.7, 0.004, 0.02, 0x9a9a9a, 0, -0.01, -0.24, { outline: false, r: 0.001 }));
    segs.push(s); parent = s;
  }
  const rt = label('REFUND!!', RW * 0.95, { color: '#c0283a', size: 56 }); at(rt, 0, -0.012, -0.13, PI / 2, 0, 0); segs[0].add(rt);
  const rt2 = label('$14.99', RW * 0.8, { color: '#222', size: 56 }); at(rt2, 0, -0.012, -0.13, PI / 2, 0, 0); segs[2].add(rt2);
  armR.rotation.set(-1.45, 0, 0.15);
  // 左手：錄影手機（REC 燈閃）＋指責的手指
  const phone = grp(0, FH - 0.06, 0.08, foreL); phone.rotation.x = PI / 2;
  phone.add(box(0.12, 0.22, 0.025, 0x161616, 0, 0, 0));
  phone.add(strip(0.1, 0.18, 0x3a5a7a)); phone.children[1].position.z = -0.014; phone.children[1].rotation.y = PI;
  const recMat = own(0xff2a2a);
  const rec = sphere(0.018, 0, -0.03, 0.08, -0.016, { mat: recMat, outline: false }); phone.add(rec);
  foreL.add(at(capsule(0.025, 0.1, SK, 0, 0, 0, { outline: false }), 0.04, FH - 0.12, 0.05, 0, 0, 0));
  armL.rotation.set(-1.4, 0, -0.2);
  // 蝙蝠翅膀（翼爪）
  const wingL = batWing(1, 0.85, 0.75, 0x4a2347, 0x1f0f1f); wingL.position.set(0.18, 0.52, -0.22); wingL.rotation.set(0, -0.6, 0.4); body.add(wingL);
  const wingR = batWing(-1, 0.85, 0.75, 0x4a2347, 0x1f0f1f); wingR.position.set(-0.18, 0.52, -0.22); wingR.rotation.set(0, 0.6, -0.4); body.add(wingR);
  // 腳下的暗影氣旋
  const aura = grp(0, 0.18, 0, g); const AU = [];
  for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(cg(`ring${i}`, () => new THREE.RingGeometry(0.3 + i * 0.18, 0.36 + i * 0.18, 24)), flat(0x4a2347, { transparent: true, opacity: 0.45, side: THREE.DoubleSide })); m.rotation.x = -PI / 2; aura.add(m); AU.push(m); }
  rig.scale.setScalar(1.15);
  const anim = (t) => {
    rec.visible = blink(t, 1.4, 0.55);
    for (let i = 0; i < segs.length; i++) segs[i].rotation.x = (i % 2 ? 0.35 : -0.2) + Math.sin(t * 3.2 - i * 0.9) * 0.12;
    for (let i = 0; i < AU.length; i++) { AU[i].rotation.z = t * (i ? -1.2 : 0.8); AU[i].scale.setScalar(1 + 0.08 * Math.sin(t * 2.5 + i)); }
    vein.scale.setScalar(1 + 0.25 * Math.max(0, Math.sin(t * 5)));
  };
  return finish(g, hparts(h, { weapon: receipt, wingL, wingR, extra: [spikes] }), 2.75, anim, [rec, ...AU]);
}

// ── 第 9 關 ─────────────────────────────────────────
// 裁員通知 AI 機械衛兵：方頭螢幕臉（LED 眼會眨、跑馬燈）、警示燈、天線、領帶、員工證、液壓腿、夾爪、粉紅資遣通知書大刀、左手紙箱
function robot() {
  const g = new THREE.Group();
  const WH = 0xe8ebee, GY = 0x9aa3ab, TL = 0x16a0a0, DK = 0x3a4048;
  const HIP = 0.72;
  const mkLeg = (s) => {
    const l = grp(s * 0.16, HIP, 0, g);
    l.add(sphere(0.1, GY));
    l.add(box(0.18, 0.28, 0.2, WH, 0, -0.18, 0));
    l.add(cyl(0.04, 0.04, 0.3, 0xb8c0c8, 0, -0.42, 0, { outline: false, seg: 8 }));
    l.add(box(0.16, 0.12, 0.18, GY, 0, -0.5, 0));
    l.add(box(0.26, 0.14, 0.36, DK, 0, -0.65, 0.05));
    l.add(box(0.27, 0.03, 0.06, 0xffd23f, 0, -0.62, 0.22, { outline: false }));
    return l;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  const body = grp(0, HIP, 0, g);
  body.add(box(0.46, 0.18, 0.32, GY, 0, 0.04, 0));
  body.add(box(0.66, 0.56, 0.4, WH, 0, 0.42, 0));
  body.add(box(0.66, 0.08, 0.41, TL, 0, 0.3, 0, { outline: false }));
  // 胸口通風格柵、肩上警示條紋
  for (let i = 0; i < 3; i++) body.add(box(0.16, 0.02, 0.01, DK, -0.18, 0.56 - i * 0.05, 0.205, { outline: false }));
  // 領帶＋員工證
  body.add(box(0.12, 0.05, 0.02, 0x2a3a6a, 0, 0.67, 0.205, { outline: false }));
  body.add(at(cone(0.06, 0.28, 0x2a3a6a, 0, 0, 0, { seg: 4 }), 0, 0.5, 0.205, PI, PI / 4, 0));
  body.add(tube([[-0.18, 0.7, 0.2], [0.05, 0.42, 0.23], [0.22, 0.7, 0.2]], 0.012, TL, { seg: 8, rs: 4, outline: false }));
  const badge = grp(0.05, 0.43, 0.225, body);
  badge.add(box(0.12, 0.16, 0.02, 0xffffff, 0, -0.08, 0));
  badge.add(box(0.08, 0.06, 0.01, TL, 0, -0.05, 0.011, { outline: false }));
  // 頭
  const head = grp(0, 0.72, 0, body);
  head.add(cyl(0.07, 0.07, 0.1, GY, 0, 0.04, 0));
  head.add(box(0.56, 0.42, 0.42, WH, 0, 0.3, 0));
  head.add(box(0.46, 0.3, 0.02, 0x0e1a1a, 0, 0.3, 0.215, { outline: false }));
  for (const s of [-1, 1]) { head.add(at(cyl(0.08, 0.08, 0.06, TL), s * 0.3, 0.3, 0, 0, 0, PI / 2)); head.add(at(cyl(0.04, 0.04, 0.08, DK, 0, 0, 0, { outline: false, seg: 8 }), s * 0.34, 0.3, 0, 0, 0, PI / 2)); }
  // 螢幕臉：LED 眼＋怒眉＋嘴，下方跑馬燈兩段字輪替
  const scrMat = flat(0xff4a3a);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = grp(s * 0.11, 0.36, 0.228, head);
    e.add(strip(0.09, 0.06, 0, { mat: scrMat }));
    eyes.push(e);
    head.add(at(strip(0.11, 0.02, 0, { mat: scrMat }), s * 0.11, 0.42, 0.228, 0, 0, s * -0.35));
  }
  const mouth = strip(0.16, 0.025, 0, { mat: scrMat }); mouth.position.set(0, 0.28, 0.228); head.add(mouth);
  const scrA = label('YOU\'RE FIRED', 0.36, { color: '#ffd23f', size: 40 }); scrA.position.set(0, 0.2, 0.228); head.add(scrA);
  const scrB = label('資遣 3…2…1', 0.3, { color: '#ffd23f', size: 40 }); scrB.position.set(0, 0.2, 0.228); head.add(scrB); scrB.visible = false;
  // 天線＋警示燈
  head.add(cyl(0.03, 0.03, 0.12, GY, 0, 0.56, 0));
  head.add(cyl(0.1, 0.1, 0.03, DK, 0, 0.6, 0));
  const beacon = sphere(0.08, 0xff2a1a, 0, 0.68, 0, { mat: flat(0xff3a2a) }); head.add(beacon);
  const beaconOff = toon(0x7a1a14);
  const ant = grp(0.2, 0.52, -0.1, head); ant.rotation.z = -0.25;
  ant.add(cyl(0.01, 0.01, 0.3, DK, 0, 0.15, 0, { outline: false, seg: 5 }));
  ant.add(sphere(0.03, TL, 0, 0.31, 0, { outline: false }));
  // 手臂：肩球、上臂、手肘、前臂、夾爪
  const fores = [];
  const mkArm = (s) => {
    const a = grp(s * 0.42, 0.6, 0, body); a.rotation.z = s * 0.12;
    a.add(sphere(0.12, GY));
    a.add(box(0.15, 0.22, 0.15, WH, 0, -0.16, 0));
    const f = grp(0, -0.3, 0, a);
    f.add(sphere(0.07, GY, 0, 0, 0, { outline: false }));
    f.add(box(0.14, 0.18, 0.14, WH, 0, -0.1, 0));
    f.add(box(0.13, 0.08, 0.16, DK, 0, -0.2, 0));
    for (const x of [-0.04, 0.04]) f.add(box(0.03, 0.08, 0.08, GY, x, -0.27, 0.02, { outline: false }));
    fores.push(f); return a;
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // 粉紅資遣通知書大刀
  const blade = grp(0, -0.2, 0.06, fores[1]);
  blade.add(box(0.1, 0.14, 0.12, 0xc0283a, 0, 0, 0));
  blade.add(box(0.3, 0.05, 0.08, DK, 0, 0.08, 0.04));
  blade.add(box(0.24, 0.95, 0.025, 0xff9cc0, 0, 0.62, 0.04, { r: 0.01 }));
  blade.add(box(0.02, 0.9, 0.03, 0xffd0e0, 0.1, 0.62, 0.04, { outline: false }));
  const bt = label('資遣', 0.16, { color: '#7a1030', size: 64 }); bt.position.set(0, 0.62, 0.06); bt.rotation.z = PI / 2; blade.add(bt);
  armR.rotation.set(-1.1, 0, -0.1);
  // 左手紙箱（盆栽＋馬克杯＋相框）
  const boxg = grp(0, -0.26, 0.18, fores[0]); armL.rotation.set(-0.75, 0, 0.1);
  boxg.rotation.x = 0.75;
  boxg.add(box(0.36, 0.22, 0.28, 0xc8a06a, 0, 0, 0));
  boxg.add(cyl(0.05, 0.04, 0.08, 0xffffff, 0.08, 0.14, 0.02));
  boxg.add(cyl(0.035, 0.03, 0.06, 0x8a5a3a, -0.08, 0.13, 0, { outline: false }));
  boxg.add(sphere(0.08, 0x3d8b2a, -0.08, 0.2, 0));
  boxg.add(at(box(0.12, 0.1, 0.015, 0xd4a72c, 0, 0, 0), 0.02, 0.16, -0.08, -0.2, 0, 0));
  const anim = (t) => {
    const on = blink(t, 1.6, 0.5);
    beacon.material = on ? scrMat : beaconOff;
    const b = blink(t, 0.25, 0.6);
    scrA.visible = b; scrB.visible = !b;
    ant.rotation.z = -0.25 + Math.sin(t * 2.4) * 0.08;
  };
  return finish(g, { body, head, armL, armR, forearmL: fores[0], forearmR: fores[1], legL, legR, weapon: blade, eyes, mouth, extra: [ant, badge] }, 2.1, anim, [beacon]);
}

// 保密協議狙擊律師：深灰西裝（翻領、口袋巾）、紅領帶、油頭、金框眼鏡、筆夾耳上、得意半眼、公事包改裝狙擊槍（瞄準鏡反光、傳票飛出）
function lawyer() {
  const SUIT = 0x2e3440, SUIT2 = 0x232831, SK = 0xf0c8a0;
  const h = humanoid({ skin: SK, shirt: SUIT, pants: SUIT, shoe: 0x111111, sole: 0x3a2a1a, cuff: 0xffffff, W: 0.54, D: 0.32,
    face: { brow: 0x161616, browTilt: 0.25, lid: SK, lidX: 0.45, mouth: 0x5a1e1e, mouthW: 0.36, mouthTilt: -0.2, mouthX: 0.06, look: 0.5 } });
  const { g, body, head, armL, armR, foreL, foreR, HR } = h;
  // 襯衫 V 領、領帶、翻領、口袋巾、鈕扣
  body.add(box(0.18, 0.4, 0.02, 0xffffff, 0, 0.42, 0.17, { outline: false }));
  body.add(box(0.07, 0.34, 0.03, 0xc0283a, 0, 0.4, 0.18));
  body.add(box(0.08, 0.06, 0.035, 0xa01a2a, 0, 0.56, 0.18, { outline: false }));
  for (const s of [-1, 1]) body.add(at(box(0.08, 0.3, 0.03, SUIT2), s * 0.1, 0.46, 0.175, 0, 0, s * 0.3));
  body.add(at(cone(0.04, 0.07, 0xf2c230, 0, 0, 0, { outline: false, seg: 3 }), 0.17, 0.5, 0.175, 0, 0, PI));
  for (let i = 0; i < 2; i++) body.add(sphere(0.016, 0x111111, 0.1, 0.18 + i * 0.08, 0.172, { outline: false, seg: 6 }));
  // 油頭（側分）＋耳上的鋼筆
  head.add(at(sc(dome(HR * 1.04, 0x161616, { cut: 0.45 }), 1, 0.7, 1.05), 0, HR * 1.15, -0.02));
  head.add(at(capsule(HR * 0.22, HR * 0.6, 0x161616), HR * 0.2, HR * 1.75, HR * 0.3, 0, 0, PI / 2 - 0.3));
  head.add(at(box(0.012, 0.012, HR * 0.9, 0x6a7380, 0, 0, 0, { outline: false }), -HR * 0.3, HR * 1.55, 0, 0, 0, 0));
  head.add(at(cyl(0.012, 0.012, 0.2, 0xd4a72c, 0, 0, 0, { outline: false, seg: 6 }), -HR * 1.02, HR * 1.1, 0.02, PI / 2, 0, 0));
  // 金框眼鏡＋鏡腳
  for (const s of [-1, 1]) {
    head.add(at(torus(HR * 0.27, 0.012, 0xd4a72c, 0, 0, 0, { outline: false, seg: 16 }), s * HR * 0.36, HR * 1.05, HR * 1.02));
    head.add(box(0.01, 0.01, HR * 0.9, 0xd4a72c, s * HR * 0.62, HR * 1.05, HR * 0.55, { outline: false }));
  }
  head.add(box(HR * 0.18, 0.012, 0.01, 0xd4a72c, 0, HR * 1.07, HR * 1.04, { outline: false }));
  // 金錶
  foreL.add(cyl(0.085, 0.085, 0.04, 0xd4a72c, 0, -0.15, 0, { outline: false }));
  // 公事包狙擊槍
  const rifle = grp(0, 0.38, 0.32, body); rifle.rotation.set(0, 0.1, 0);
  rifle.add(box(0.12, 0.3, 0.42, 0x6b3a1e, 0.0, -0.05, -0.05));
  for (const z of [-0.18, 0.08]) rifle.add(box(0.13, 0.04, 0.04, 0xd4a72c, 0, 0.09, z, { outline: false }));
  rifle.add(box(0.05, 0.05, 0.12, 0xd4a72c, 0, 0.12, -0.05));
  rifle.add(at(cyl(0.03, 0.03, 0.45, 0x2a2a2a), 0, 0.04, 0.34, PI / 2, 0, 0));
  rifle.add(at(cyl(0.045, 0.03, 0.06, 0x111111, 0, 0, 0, { outline: false }), 0, 0.04, 0.58, PI / 2, 0, 0));
  rifle.add(at(cyl(0.05, 0.05, 0.3, 0x111111), 0, 0.16, 0.12, PI / 2, 0, 0));
  for (const z of [0.05, 0.2]) rifle.add(box(0.03, 0.06, 0.03, 0x111111, 0, 0.11, z, { outline: false }));
  const lens = own(0x9cff3a);
  rifle.add(at(cyl(0.055, 0.055, 0.02, 0, 0, 0, 0, { mat: lens, outline: false }), 0, 0.16, 0.275, PI / 2, 0, 0));
  const nda = label('NDA', 0.24, { color: '#ffd23f', size: 64 }); nda.position.set(0.065, -0.05, -0.05); nda.rotation.y = PI / 2; rifle.add(nda);
  // 傳票從槍口飛出（會飄）
  const papers = grp(0, 0.04, 0.62, rifle); const PP = [];
  for (let i = 0; i < 3; i++) { const p = at(box(0.16, 0.2, 0.012, 0xfaf8f0, 0, 0, 0, { r: 0.004 }), 0.03 * i, 0.04 + 0.08 * i, i * 0.08, -0.3 + i * 0.3, 0.4 * i, 0.2 * i); papers.add(p); PP.push(p); }
  reach(armR, foreR, [-0.06, 0.28, 0.24]); reach(armL, foreL, [0.07, 0.36, 0.42]);
  hold(g, foreR, rifle);
  const anim = (t) => {
    const k = 0.5 + 0.5 * Math.sin(t * 2.2);
    lens.color.setRGB(0.4 + 0.6 * k, 1, 0.25 + 0.5 * k);
    for (let i = 0; i < PP.length; i++) { PP[i].rotation.z = 0.2 * i + Math.sin(t * 3 + i * 1.3) * 0.3; PP[i].position.y = 0.04 + 0.08 * i + Math.sin(t * 2 + i) * 0.03; }
  };
  return finish(g, hparts(h, { weapon: rifle, extra: [papers] }), 1.85, anim, PP);
}

// 演算法黑客法師：尖頂巫師帽 T（星月刺繡）、黑眼圈、耳機、浮空筆電（貼紙）、旋轉資料符文環、環繞資料方塊、能量飲
function hacker() {
  const HOOD = 0x23302a, ACID = 0x7dff4a, SK = 0xe8d6c0;
  const h = humanoid({ skin: SK, shirt: HOOD, pants: 0x3a3a3a, shoe: 0xff6a1a, sole: 0x1a1a1a, glove: 0x1a1a1a, fore: HOOD, W: 0.52, D: 0.32,
    face: { mouth: 0x3a2a2a, mouthW: 0.28, mouthTilt: 0.25, white: 0xeaffd8, pupil: 0x1a4a1a, lid: 0xc8b6a0, lidX: 0.4, look: 0.2, lookY: -0.6 } });
  const { g, body, head, armL, armR, foreL, foreR, HR } = h;
  // 黑眼圈
  for (const s of [-1, 1]) head.add(sc(sphere(HR * 0.22, 0x6a5a7a, s * HR * 0.36, HR * 0.88, HR * 0.8, { outline: false }), 1.1, 0.5, 0.5));
  // 帽 T 帽兜＋巫師尖頂（彎尖會晃）＋刺繡
  head.add(at(sc(dome(HR * 1.2, HOOD, { cut: 0.6 }), 1, 1.05, 1), 0, HR * 0.95, -0.04, -0.45, 0, 0));
  head.add(at(cone(HR * 0.8, HR * 1.6, HOOD), 0.02, HR * 2.35, -HR * 0.3, -0.45, 0, -0.1));
  const tip = grp(0.06, HR * 3.0, -HR * 0.65, head); tip.rotation.set(-0.6, 0, -0.5);
  tip.add(cone(HR * 0.38, HR * 1.0, HOOD, 0, HR * 0.4, 0));
  tip.add(sphere(0.05, ACID, 0, HR * 0.95, 0, { mat: flat(ACID), outline: false }));
  for (const [x, y, z] of [[0.12, HR * 2.2, -HR * 0.05], [-0.1, HR * 2.6, -HR * 0.25]]) head.add(at(slab(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.015 : 0.035, a = PI / 2 + i * PI / 5; return [Math.cos(a) * r, Math.sin(a) * r]; }), 0.01, 0xffe14a, { mat: flat(0xffe14a), outline: false }), x, y, z, -0.45, 0, 0));
  // 耳機（掛在帽兜外）
  head.add(at(torus(HR * 1.15, 0.025, 0x1a1a1a, 0, 0, 0, { seg: 16, arc: PI }), 0, HR * 0.95, 0.02, 0, 0, 0));
  for (const s of [-1, 1]) head.add(at(cyl(0.08, 0.08, 0.06, 0x1a1a1a), s * HR * 1.15, HR * 0.9, 0.02, 0, 0, PI / 2));
  for (const s of [-1, 1]) head.add(at(cyl(0.05, 0.05, 0.01, 0, 0, 0, 0, { mat: flat(ACID), outline: false }), s * HR * 1.2, HR * 0.9, 0.02, 0, 0, PI / 2));
  // 帽 T 前的綠色程式碼、抽繩
  const code = label('</>', 0.24, { color: '#7dff4a', size: 64 }); code.position.set(0, 0.42, 0.175); body.add(code);
  const cords = [];
  for (const s of [-1, 1]) { const c = grp(s * 0.07, 0.58, 0.17, body); c.add(cyl(0.01, 0.01, 0.2, 0xd8dde2, 0, -0.1, 0, { outline: false, seg: 5 })); cords.push(c); }
  // 浮空筆電（背蓋貼紙）
  const lap = grp(0, 0.45, 0.5, body); lap.rotation.x = 0.15;
  lap.add(box(0.5, 0.03, 0.34, 0x3a3f44, 0, 0, 0));
  lap.add(box(0.42, 0.005, 0.18, 0x22272b, 0, 0.017, 0.03, { outline: false }));
  const scr = grp(0, 0.01, -0.16, lap); scr.rotation.x = -0.25;
  scr.add(box(0.5, 0.34, 0.03, 0x3a3f44, 0, 0.17, 0));
  scr.add(box(0.44, 0.28, 0.01, 0x0a140a, 0, 0.17, 0.018, { outline: false }));
  for (const [x, y, c] of [[-0.12, 0.22, 0xff4f9a], [0.1, 0.1, 0xffd23f], [0.14, 0.25, 0x4ef2ff]]) scr.add(box(0.07, 0.07, 0.005, c, x, y, -0.018, { outline: false }));
  const ct = label('sudo rm -rf\n/privacy', 0.4, { color: '#7dff4a', size: 40, font: 'monospace' }); ct.position.set(0, 0.17, 0.025); scr.add(ct);
  const cur = strip(0.03, 0.04, ACID); cur.position.set(0.14, 0.09, 0.026); scr.add(cur);
  reach(armL, foreL, [0.13, 0.5, 0.44]); reach(armR, foreR, [-0.13, 0.5, 0.44]);
  hold(g, foreR, lap);
  // 資料符文環＋環繞的資料方塊
  const runes = grp(0, 1.25, 0, g);
  runes.add(at(torus(0.65, 0.015, ACID, 0, 0, 0, { mat: flat(ACID), outline: false, seg: 40 }), 0, 0, 0, PI / 2, 0, 0));
  ['{ }', '01', '#', 'λ', '&&'].forEach((t, i) => {
    const a = i / 5 * PI * 2 + 0.3;
    const r = label(t, 0.22, { color: '#7dff4a', size: 64, double: true });
    r.position.set(Math.sin(a) * 0.65, 0.12 * Math.sin(i * 2), Math.cos(a) * 0.65); r.rotation.y = a; runes.add(r);
  });
  const cubes = grp(0, 0.9, 0, g); const CU = [];
  for (let i = 0; i < 3; i++) { const m = box(0.08, 0.08, 0.08, ACID, 0, 0, 0, { mat: flat(i === 1 ? 0x4ef2ff : ACID, { transparent: true, opacity: 0.8 }), outline: false }); cubes.add(m); CU.push(m); }
  // 腰間能量飲（兩罐）
  body.add(cyl(0.05, 0.05, 0.16, 0x111111, -0.3, 0.08, 0.06));
  body.add(cyl(0.051, 0.051, 0.05, ACID, -0.3, 0.1, 0.06, { outline: false }));
  body.add(cyl(0.045, 0.045, 0.14, 0x111111, 0.3, 0.07, 0.02));
  body.add(cyl(0.046, 0.046, 0.04, 0xff4f9a, 0.3, 0.09, 0.02, { outline: false }));
  const anim = (t) => {
    runes.rotation.y = t * 0.5;
    runes.position.y = 1.25 + Math.sin(t * 1.3) * 0.05;
    cubes.rotation.y = -t * 1.1;
    for (let i = 0; i < CU.length; i++) { const a = i * 2.1; CU[i].position.set(Math.cos(a) * 0.5, Math.sin(t * 2 + i) * 0.12, Math.sin(a) * 0.5); CU[i].rotation.set(t + i, t * 1.3, 0); }
    cur.visible = blink(t, 2, 0.5);
  };
  return finish(g, hparts(h, { weapon: lap, runes, extra: [tip, ...cords] }), 2.15, anim, [...CU, cur]);
}

// 不朽的蜥蜴人生化執行長・LZRD：綠鱗、直瞳黃眼、吐信、推到額頭的 VR 頭盔（藍光）、灰 T＋西裝外套、智慧錶、尾巴、伺服器戰錘（LED 閃）
function lizard() {
  const SK = 0x5fae3c, DK = 0x3f7f26, BLZ = 0x1f2a44;
  const h = humanoid({ skin: SK, shirt: 0x9aa0a6, pants: 0x2f4a7a, shoe: 0xf5f5f5, sole: 0xd8dde2, sleeve: BLZ, fore: BLZ, cuff: 0x9aa0a6, W: 0.58, D: 0.34, HR: 0.25, noHead: true });
  const { g, rig, body, head, armL, armR, foreL, foreR, HR } = h;
  // 綠色爪手
  for (const f of [foreL, foreR]) { f.remove(f.children[f.children.length - 1]); f.add(P(claw(SK, 0.09, 0xf5d33a), 0, FH, 0)); }
  // 西裝外套（兩片前襟＋後背＋翻領）、灰 T 領口、名牌
  for (const s of [-1, 1]) body.add(box(0.18, 0.54, 0.38, BLZ, s * 0.22, 0.35, 0));
  body.add(box(0.6, 0.54, 0.1, BLZ, 0, 0.35, -0.13));
  for (const s of [-1, 1]) body.add(at(box(0.08, 0.26, 0.04, 0x2a3858), s * 0.12, 0.5, 0.18, 0, 0, s * 0.4));
  body.add(sc(at(torus(0.1, 0.025, 0x8a9096, 0, 0, 0, { outline: false, seg: 14 }), 0, 0.62, 0.05, PI / 2, 0, 0), 1.3, 1, 1));
  const tag = label('LZRD', 0.14, { color: '#1f2a44', bg: '#ffffff', size: 40 }); tag.position.set(0.2, 0.46, 0.195); body.add(tag);
  // 智慧錶
  foreL.add(box(0.07, 0.03, 0.06, 0x111111, 0, -0.16, 0.08, { outline: false }));
  // 頭：圓頂＋長吻＋鱗斑
  head.add(sphere(HR, SK, 0, HR * 0.95, -0.02));
  head.add(at(sc(capsule(HR * 0.55, HR * 0.6, SK), 1.15, 1, 0.75), 0, HR * 0.72, HR * 0.75, PI / 2, 0, 0));
  const mouth = box(HR * 1.0, 0.03, HR * 0.9, 0x3a1a1a, 0, HR * 0.52, HR * 0.9, { outline: false }); head.add(mouth);
  // 詭異微笑嘴角
  for (const s of [-1, 1]) head.add(at(box(HR * 0.3, 0.02, 0.02, 0x3a1a1a, 0, 0, 0, { outline: false }), s * HR * 0.5, HR * 0.58, HR * 1.12, 0, s * 0.6, s * 0.4));
  const tongue = grp(0, HR * 0.5, HR * 1.4, head);
  tongue.add(tube([[0, 0, 0], [0.02, -0.02, HR * 0.2], [0.06, -0.04, HR * 0.3]], 0.015, 0xd8364a, { seg: 6, rs: 4, outline: false }));
  for (const s of [-1, 1]) tongue.add(at(cone(0.008, 0.05, 0xd8364a, 0, 0, 0, { outline: false, seg: 4 }), 0.06 + s * 0.012, -0.04, HR * 0.3 + 0.02, PI / 2, 0, s * 0.4));
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = eye(HR * 0.28, { white: 0xf5d33a, slit: true, lid: DK, lidX: 0.85, lidZ: s * -0.2 }); e.position.set(s * HR * 0.45, HR * 1.12, HR * 0.62); head.add(e); eyes.push(e);
    head.add(sphere(HR * 0.06, DK, s * HR * 0.15, HR * 0.9, HR * 1.5, { outline: false }));
    head.add(sphere(HR * 0.12, DK, s * HR * 0.35, HR * 1.6, -HR * 0.3, { outline: false }));
    head.add(sphere(HR * 0.08, DK, s * HR * 0.75, HR * 0.8, HR * 0.1, { outline: false }));
  }
  // 頸部鱗冠（會晃）
  const frill = grp(0, HR * 1.75, -HR * 0.55, head);
  for (let i = 0; i < 3; i++) frill.add(at(cone(0.05, 0.14, 0xf08a24, 0, 0, 0, { seg: 6 }), 0, -HR * i * 0.35, -HR * i * 0.3, -0.5 - i * 0.4, 0, 0));
  // VR 頭盔推到額頭（藍光條）
  const vr = grp(0, HR * 1.62, 0.02, head); vr.rotation.x = -0.35;
  vr.add(box(HR * 1.5, HR * 0.5, HR * 0.7, 0xf5f5f5, 0, 0, HR * 0.35));
  vr.add(box(HR * 1.3, HR * 0.34, 0.02, 0x161616, 0, 0, HR * 0.72, { outline: false }));
  const vrGlow = own(0x4ef2ff);
  vr.add(box(HR * 1.1, HR * 0.06, 0.02, 0, 0, -HR * 0.1, HR * 0.74, { mat: vrGlow, outline: false }));
  vr.add(at(sc(torus(HR * 0.98, 0.03, 0x2a2a2a), 1, 1, 1.05), 0, 0, 0, PI / 2, 0, 0));
  // 尾巴（背刺）
  const tail = grp(0, 0.62, -0.12, rig);
  tail.add(tube([[0, 0, 0], [0, -0.26, -0.33], [0.2, -0.54, -0.54], [0.5, -0.57, -0.5]], 0.1, SK, { taper: 0.85, seg: 20 }));
  for (const [x, y, z] of [[0, -0.12, -0.24], [0.08, -0.42, -0.46]]) tail.add(at(cone(0.04, 0.1, 0xf08a24, 0, 0, 0, { outline: false, seg: 6 }), x, y + 0.08, z, -0.6, 0, 0));
  // 右手：伺服器戰錘（LED 閃）
  const ham = grp(0, FH, 0.04, foreR); ham.rotation.set(1.0, 0, -0.6);
  ham.add(cyl(0.035, 0.035, 1.1, 0x2a2a2a, 0, 0.3, 0));
  ham.add(cyl(0.05, 0.05, 0.2, 0x4ef2ff, 0, -0.15, 0, { outline: false }));
  const hd = grp(0, 0.88, 0, ham);
  hd.add(box(0.5, 0.3, 0.3, 0x30363d, 0, 0, 0));
  for (const s of [-1, 1]) hd.add(box(0.04, 0.34, 0.34, 0x14181d, s * 0.25, 0, 0));
  for (let r = 0; r < 3; r++) hd.add(box(0.42, 0.04, 0.01, 0x14181d, 0, -0.09 + r * 0.09, 0.155, { outline: false }));
  const ledOn = flat(0x9cff3a), ledRed = flat(0xff3a2a), ledOff = flat(0x2a4a1a);
  const LED = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const m = sphere(0.018, 0, 0.12 + c * 0.06, -0.09 + r * 0.09, 0.16, { mat: ledOn, outline: false }); hd.add(m); LED.push(m); }
  const dl = label('DATA', 0.24, { color: '#ffffff', size: 48 }); dl.position.set(-0.08, 0.0, 0.158); hd.add(dl);
  armR.rotation.set(-0.5, 0, -0.25); armL.rotation.set(-0.2, 0, 0.25); foreL.rotation.x = -0.6;
  // 左手：保濕防曬乳
  const lotion = grp(0, FH - 0.08, 0.06, foreL);
  lotion.add(capsule(0.05, 0.14, 0xffc04a));
  lotion.add(cyl(0.03, 0.03, 0.05, 0xffffff, 0, 0.14, 0, { outline: false }));
  lotion.add(box(0.07, 0.06, 0.01, 0xffffff, 0, 0, 0.05, { outline: false }));
  rig.scale.setScalar(1.25);
  const anim = (t) => {
    const k = Math.floor(t * 6);
    for (let i = 0; i < LED.length; i++) LED[i].material = ((k * 7 + i * 3) % 5 === 0) ? ledOff : (i === 3 && (k & 1) ? ledRed : ledOn);
    vrGlow.color.setRGB(0.3, 0.75 + 0.25 * Math.sin(t * 3), 1);
    const f = (t * 0.7) % 1;
    tongue.scale.z = f < 0.15 ? Math.sin(f / 0.15 * PI) * 1.4 + 0.2 : 0.2;
  };
  return finish(g, hparts(h, { weapon: ham, vr, eyes, mouth, tail, extra: [frill] }), 2.4, anim, LED);
}

// 二階段：巨型元宇宙機甲蜥蜴（雙足、金屬甲片與鉚釘、發光背刺、排氣管冒煙、掃描面罩、胸前駕駛艙坐著小執行長、短手拿烤肉醬）
function lizard2() {
  const g = new THREE.Group();
  const CH = 0xaab3bc, CH2 = 0x7e8892, GR = 0x48a23a, SAU = 0x7a2e12, VIS = 0xff6a1a, DK = 0x3a4048;
  const HIP = 1.2;
  const mkLeg = (s) => {
    const l = grp(s * 0.5, HIP, -0.1, g);
    l.add(sc(sphere(0.34, GR, 0, -0.12, 0), 1, 1.2, 1.1));
    l.add(box(0.42, 0.5, 0.5, CH, 0, -0.18, 0.06));
    for (const y of [-0.05, -0.3]) l.add(sphere(0.025, DK, s * 0.2, y, 0.3, { outline: false, seg: 6 }));
    l.add(at(box(0.26, 0.55, 0.28, CH2, 0, 0, 0), 0, -0.62, -0.1, -0.35, 0, 0));
    l.add(at(cyl(0.05, 0.05, 0.5, 0xd8dde2, 0, 0, 0, { outline: false, seg: 8 }), s * 0.17, -0.6, 0.0, -0.35, 0, 0));
    l.add(box(0.5, 0.18, 0.66, CH, 0, -1.11, 0.12));
    for (const x of [-0.15, 0, 0.15]) l.add(at(cone(0.06, 0.18, 0xf2f2f2, 0, 0, 0, { seg: 8 }), x, -1.12, 0.5, PI / 2, 0, 0));
    return l;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  const body = grp(0, HIP, 0, g);
  body.rotation.x = 0.18;
  body.add(sc(sphere(0.62, GR, 0, 0.55, 0), 1.05, 1.2, 0.95));
  body.add(box(1.0, 0.85, 0.7, CH, 0, 0.6, 0.08));
  body.add(box(0.8, 0.2, 0.6, CH2, 0, 0.08, 0.06));
  // 甲片接縫、鉚釘、警示條紋
  for (const s of [-1, 1]) { body.add(box(0.03, 0.8, 0.02, DK, s * 0.32, 0.6, 0.435, { outline: false })); for (const y of [0.3, 0.6, 0.9]) body.add(sphere(0.025, DK, s * 0.45, y, 0.435, { outline: false, seg: 6 })); }
  for (let i = 0; i < 4; i++) body.add(at(box(0.08, 0.2, 0.02, i % 2 ? 0x1a1a1a : 0xffd23f, 0, 0, 0, { outline: false }), -0.3 + i * 0.2, 0.08, 0.365, 0, 0, 0.6));
  // 胸前駕駛艙：小執行長（VR 頭盔、會眨眼）
  const pit = grp(0, 0.66, 0.5, body);
  pit.add(at(cyl(0.27, 0.27, 0.06, 0x1a1d22, 0, 0, 0, { outline: false }), 0, 0, -0.04, PI / 2, 0, 0));
  pit.add(sphere(0.13, 0x5fae3c, 0, -0.02, 0));
  pit.add(box(0.2, 0.1, 0.1, 0x9aa0a6, 0, -0.16, 0));
  pit.add(box(0.2, 0.06, 0.1, 0xf5f5f5, 0, 0.08, 0.02));
  const eyes = [];
  for (const s of [-1, 1]) { const e = eye(0.03, { white: 0xf5d33a, slit: true }); e.position.set(s * 0.05, 0.0, 0.11); pit.add(e); eyes.push(e); }
  for (const s of [-1, 1]) pit.add(at(box(0.04, 0.12, 0.04, 0x2a2a2a, 0, 0, 0, { outline: false }), s * 0.12, -0.12, 0.08, -0.6, 0, s * 0.4));
  pit.add(dome(0.25, 0x9ef0ff, { transparent: true, opacity: 0.35, outline: false, cut: 1 }));
  pit.add(torus(0.27, 0.05, 0xf2c230, 0, 0, 0));
  // 烤肉醬滴落（會長短變化）
  const DR = [];
  for (const [x, y] of [[-0.3, 1.0], [0.25, 0.95], [0.4, 0.5]]) { const d = grp(x, y + 0.1, 0.44, body); d.add(sc(capsule(0.04, 0.16, SAU, 0, -0.1, 0), 1, 1, 0.6)); DR.push(d); }
  // 發光背刺＋排氣管＋煙
  const spikeMat = own(VIS);
  for (let i = 0; i < 4; i++) body.add(at(sc(cone(0.18, 0.4, VIS, 0, 0, 0, { mat: spikeMat }), 1, 1, 0.3), 0, 1.05 - i * 0.28, -0.32 - i * 0.08, -0.6 - i * 0.2, PI / 2, 0));
  const PUFF = [];
  for (const s of [-1, 1]) {
    body.add(at(cyl(0.07, 0.08, 0.5, DK), s * 0.4, 1.05, -0.3, -0.3, 0, 0));
    body.add(at(cyl(0.09, 0.09, 0.06, 0x2a2a2a, 0, 0, 0, { outline: false }), s * 0.4, 1.3, -0.38, -0.3, 0, 0));
    const p = sphere(0.12, 0xb8b4b0, s * 0.4, 1.4, -0.4, { transparent: true, opacity: 0.6, outline: false, shadow: false }); body.add(p); PUFF.push(p);
  }
  // 頭（脖子前伸）：掃描面罩、角、牙
  const head = grp(0, 1.12, 0.26, body); head.rotation.x = -0.18;
  head.add(box(0.62, 0.42, 0.6, CH, 0, 0.15, 0.12));
  head.add(box(0.5, 0.22, 0.7, GR, 0, 0.08, 0.66));
  for (const s of [-1, 1]) head.add(sphere(0.04, 0x1f4a18, s * 0.12, 0.2, 1.0, { outline: false }));
  head.add(box(0.66, 0.14, 0.06, 0x1a1a1a, 0, 0.28, 0.46, { outline: false }));
  head.add(box(0.64, 0.1, 0.08, VIS, 0, 0.28, 0.47, { mat: flat(0xa83a10) }));
  const scan = box(0.12, 0.1, 0.02, 0, 0, 0.28, 0.515, { mat: flat(0xffe14a), outline: false }); head.add(scan);
  for (const s of [-1, 1]) head.add(box(0.12, 0.05, 0.4, CH2, s * 0.32, 0.36, 0.1));
  const mouth = box(0.4, 0.04, 0.5, 0xff4a1a, 0, -0.03, 0.55, { mat: flat(0xff5a1a), outline: false }); head.add(mouth);
  const jaw = grp(0, -0.04, 0.15, head); jaw.rotation.x = 0.3;
  jaw.add(box(0.46, 0.1, 0.62, CH2, 0, -0.04, 0.32));
  for (const s of [-1, 1]) jaw.add(cone(0.035, 0.08, 0xffffff, s * 0.17, 0.04, 0.5, { outline: false, seg: 6 }));
  for (const s of [-1, 1]) for (const z of [0.5, 0.75]) head.add(at(cone(0.04, 0.1, 0xffffff, 0, 0, 0, { outline: false, seg: 6 }), s * 0.18, -0.06, z, PI, 0, 0));
  for (const s of [-1, 1]) head.add(at(cone(0.06, 0.25, CH2), s * 0.22, 0.42, 0.0, -0.6, 0, s * -0.4));
  // 小短手（三爪）拿烤肉醬瓶
  const fores = [];
  const mkArm = (s) => {
    const a = grp(s * 0.52, 0.85, 0.32, body);
    a.add(sphere(0.12, CH));
    a.add(capsule(0.08, 0.1, GR, 0, -0.1, 0));
    const f = grp(0, -0.18, 0, a);
    f.add(capsule(0.07, 0.06, CH2, 0, -0.05, 0));
    f.add(P(claw(CH, 0.08, 0xffffff), 0, -0.14, 0));
    a.rotation.set(-1.0, 0, s * 0.3); fores.push(f); return a;
  };
  const armL = mkArm(1), armR = mkArm(-1);
  const bottle = grp(0, -0.16, 0.06, fores[1]);
  bottle.add(cyl(0.08, 0.08, 0.24, SAU, 0, -0.04, 0));
  bottle.add(cone(0.08, 0.12, SAU, 0, 0.14, 0));
  bottle.add(cyl(0.083, 0.083, 0.1, 0xffd23f, 0, -0.04, 0, { outline: false }));
  const bl = label('BBQ', 0.12, { color: '#7a2e12', size: 48 }); bl.position.set(0, -0.04, 0.085); bottle.add(bl);
  // 尾巴（甲片）
  const tail = grp(0, HIP + 0.3, -0.35, g);
  tail.add(tube([[0, 0, 0], [0, -0.4, -0.4], [0.15, -1.15, -0.7], [0.5, -1.35, -0.75]], 0.32, CH, { taper: 0.8, seg: 20 }));
  for (const [x, y, z] of [[0, 0.02, -0.15], [0.05, -0.55, -0.55], [0.25, -1.05, -0.78]]) tail.add(at(sc(cone(0.12, 0.26, VIS, 0, 0, 0, { mat: spikeMat }), 1, 1, 0.3), x, y + 0.2, z, -1.1, PI / 2, 0));
  const anim = (t) => {
    scan.position.x = Math.sin(t * 2.4) * 0.24;
    spikeMat.color.setRGB(1, 0.35 + 0.2 * Math.sin(t * 4), 0.1);
    for (let i = 0; i < DR.length; i++) DR[i].scale.y = 1 + 0.4 * Math.max(0, Math.sin(t * 1.5 + i * 2));
    for (let i = 0; i < PUFF.length; i++) { const k = (t * 0.7 + i * 0.5) % 1; PUFF[i].position.y = 1.4 + k * 0.5; PUFF[i].scale.setScalar(0.5 + k); }
  };
  return finish(g, { body, head, jaw, armL, armR, forearmL: fores[0], forearmR: fores[1], legL, legR, weapon: bottle, pilot: pit, tail, eyes, mouth }, 3.0, anim, [scan, ...PUFF]);
}

// ── 第 10 關 ────────────────────────────────────────
// 百萬訂閱網紅噴火龍戰士：紅橘龍人、頭戴麥克風、尖牙笑、角、背脊、小翅膀、環形補光燈長杖（LIVE）、業配招牌盾、飄浮愛心
function dragon() {
  const SK = 0xe8542c, BEL = 0xffc94a, GOLD = 0xf2c230;
  const h = humanoid({ skin: SK, shirt: SK, pants: 0x2a2a2a, shoe: 0x111111, sole: 0xffd23f, glove: SK, W: 0.66, D: 0.42, TH: 0.56, armR: 0.11, legR: 0.13, HR: 0.25, noHead: true });
  const { g, body, head, armL, armR, foreL, foreR, HR } = h;
  for (const f of [foreL, foreR]) { f.remove(f.children[f.children.length - 1]); f.add(P(claw(SK, 0.095), 0, FH, 0)); f.add(cyl(0.11, 0.11, 0.08, GOLD, 0, -0.14, 0, { outline: false })); }
  body.add(box(0.4, 0.46, 0.06, BEL, 0, 0.36, 0.19));
  for (let i = 0; i < 3; i++) body.add(box(0.38, 0.02, 0.02, 0xd89a2a, 0, 0.2 + i * 0.13, 0.225, { outline: false }));
  // 金色肩甲、背脊
  for (const s of [-1, 1]) body.add(sc(sphere(0.18, GOLD, s * 0.38, 0.58, 0), 1, 0.7, 1));
  for (let i = 0; i < 3; i++) body.add(at(cone(0.06, 0.16, BEL, 0, 0, 0, { seg: 6 }), 0, 0.55 - i * 0.18, -0.22, -0.5, 0, 0));
  // 頭：吻部、大眼、角、牙、頭戴式麥克風
  head.add(sphere(HR, SK, 0, HR * 0.95, 0));
  head.add(box(HR * 1.2, HR * 0.65, HR * 1.4, SK, 0, HR * 0.7, HR * 0.95));
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = eye(HR * 0.24, { look: -s * 0.3, pr: 0.55 }); e.position.set(s * HR * 0.42, HR * 1.18, HR * 0.72); head.add(e); eyes.push(e);
    head.add(at(box(HR * 0.5, HR * 0.1, HR * 0.1, 0x7a1e14), s * HR * 0.42, HR * 1.48, HR * 0.8, 0, 0, s * -0.2));
    head.add(at(cone(HR * 0.18, HR * 0.9, 0xf3eadb), s * HR * 0.5, HR * 1.7, -HR * 0.3, -0.7, 0, s * -0.3));
    head.add(sphere(HR * 0.07, 0x5a1a10, s * HR * 0.22, HR * 0.92, HR * 1.66, { outline: false }));
    head.add(at(cone(0.02, 0.06, 0xffffff, 0, 0, 0, { outline: false, seg: 6 }), s * HR * 0.35, HR * 0.42, HR * 1.6, PI, 0, 0));
  }
  const mouth = box(HR * 1.0, 0.04, 0.02, 0x5a1a10, 0, HR * 0.5, HR * 1.66, { outline: false }); head.add(mouth);
  const mic = grp(0, HR * 0.95, 0, head);
  mic.add(at(torus(HR * 1.02, 0.015, 0x1a1a1a, 0, 0, 0, { outline: false, seg: 16, arc: PI }), 0, 0, 0, 0, 0, 0));
  mic.add(at(cyl(0.008, 0.008, 0.3, 0x1a1a1a, 0, 0, 0, { outline: false, seg: 4 }), -HR * 0.9, -0.12, 0.12, 0.7, 0, 0));
  mic.add(sphere(0.03, 0x1a1a1a, -HR * 0.9, -0.24, 0.24, { outline: false }));
  // 鼻孔的煙（往上飄）
  const smoke = grp(0, 0, HR * 1.75, head); const SM = [];
  for (let i = 0; i < 2; i++) { const m = sphere(0.07, 0xd8d4cf, 0, 0, 0, { transparent: true, opacity: 0.7, outline: false, shadow: false }); smoke.add(m); SM.push(m); }
  // 背上小翅膀、尾巴（尖端火焰）
  const wingL = batWing(1, 0.5, 0.36, 0xc0392b, 0x7a1e14); wingL.position.set(0.15, 0.6, -0.24); wingL.rotation.set(0, -0.5, 0.7); body.add(wingL);
  const wingR = batWing(-1, 0.5, 0.36, 0xc0392b, 0x7a1e14); wingR.position.set(-0.15, 0.6, -0.24); wingR.rotation.set(0, 0.5, -0.7); body.add(wingR);
  const tail = grp(0, 0.7, -0.15, g);
  tail.add(tube([[0, 0, 0], [0, -0.3, -0.35], [-0.2, -0.62, -0.6], [-0.5, -0.65, -0.5]], 0.12, SK, { taper: 0.85, seg: 16 }));
  tail.add(at(cone(0.08, 0.16, BEL), -0.56, -0.6, -0.47, 0, 0, PI / 2));
  // 右手：環形補光燈長杖（中心夾手機，LIVE）
  const rl = grp(0, FH, 0.04, foreR); rl.rotation.x = 1.25;
  rl.add(cyl(0.025, 0.025, 1.3, 0x2a2a2a, 0, 0.35, 0));
  const ring = grp(0, 1.05, 0, rl); ring.rotation.x = -1.25;
  const ringMat = own(0xfffbe8);
  ring.add(torus(0.26, 0.05, 0xffffff, 0, 0, 0, { mat: ringMat, seg: 28 }));
  ring.add(box(0.1, 0.18, 0.02, 0x111111, 0, 0, 0));
  const live = label('● LIVE', 0.1, { color: '#ffffff', bg: '#e02a3a', size: 40 }); live.position.set(0, 0.06, 0.012); ring.add(live);
  armR.rotation.set(-0.8, 0, -0.15);
  // 左手：業配招牌盾
  const sign = grp(0.08, FH, 0.12, foreL); sign.rotation.set(0.95, 0.15, 0);
  sign.add(box(0.62, 0.42, 0.04, 0xffd23f, 0, 0.0, 0));
  sign.add(box(0.66, 0.46, 0.03, 0xc0283a, 0, 0, -0.01, { outline: false }));
  const st = label('#AD\n業配', 0.36, { color: '#c0283a', size: 56 }); st.position.set(0, 0, 0.025); sign.add(st);
  armL.rotation.set(-0.95, 0, 0.2);
  // 飄浮的愛心（按讚）
  const hearts = grp(0.45, 1.6, 0, g); const HT = [];
  const heartPts = [[0, -0.07], [-0.07, 0.0, -0.08, 0.05], [-0.04, 0.08, 0, 0.04], [0.04, 0.08, 0.08, 0.05], [0.07, 0.0, 0, -0.07]];
  for (let i = 0; i < 2; i++) { const m = slab(heartPts, 0.02, 0xff4f9a, { mat: flat(0xff4f9a), outline: false }); hearts.add(m); HT.push(m); }
  const anim = (t) => {
    ringMat.color.setScalar(0.85 + 0.15 * Math.sin(t * 5));
    live.visible = blink(t, 1, 0.7);
    for (let i = 0; i < SM.length; i++) { const k = (t * 0.6 + i * 0.5) % 1; SM[i].position.set((i ? 0.08 : -0.08) + k * 0.05, k * 0.35, k * 0.1); SM[i].scale.setScalar(0.4 + k * 1.2); }
    for (let i = 0; i < HT.length; i++) { const k = (t * 0.35 + i * 0.5) % 1; HT[i].position.set(Math.sin(t * 2 + i * 3) * 0.12 - i * 0.2, k * 0.6, 0); HT[i].scale.setScalar(Math.min(1.2, k * 6, (1 - k) * 5)); }
  };
  return finish(g, hparts(h, { weapon: rl, shield: sign, wingL, wingR, eyes, mouth, tail, extra: [mic] }), 1.95, anim, [...SM, ...HT]);
}

// 演算法觸手總監：橘（A，廣告投放）／粉（B，流量變現）章魚主管，眼鏡、西裝領帶、吸盤觸手、手機與大聲公、背後跑馬燈廣告看板
function adsExec(skin, spot, accent, text) {
  const g = new THREE.Group();
  const SUIT = 0x2b2f36, SUCK = 0xfff0e0;
  const body = grp(0, 0.5, 0, g);
  // 腳觸手（站姿，向外捲；每條以根部為樞紐、帶吸盤）
  const legs = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2 + PI / 5;
    const c = Math.cos(a), s = Math.sin(a);
    const root = [c * 0.12, 0.58, s * 0.12];
    const tg = rooted(g, root, [root, [c * 0.32, 0.3, s * 0.32], [c * 0.5, 0.06, s * 0.5], [c * 0.68, 0.08, s * 0.68], [c * 0.72, 0.2, s * 0.6]], 0.09, skin, { taper: 0.8, seg: 18 });
    for (const [r, y, sz] of [[0.3, 0.38, 0.035], [0.45, 0.2, 0.03], [0.6, 0.14, 0.025]]) tg.add(sc(sphere(sz, SUCK, c * r - root[0], y - root[1], s * r - root[2], { outline: false, seg: 8 }), 1, 0.5, 1));
    legs.push(tg);
  }
  // 西裝身體：襯衫、領帶、翻領、口袋巾
  body.add(cyl(0.3, 0.38, 0.55, SUIT, 0, 0.3, 0, { seg: 16 }));
  body.add(box(0.2, 0.36, 0.04, 0xffffff, 0, 0.38, 0.29, { outline: false }));
  body.add(box(0.08, 0.3, 0.04, accent, 0, 0.36, 0.31));
  body.add(box(0.1, 0.06, 0.045, accent, 0, 0.53, 0.31, { outline: false }));
  for (const s of [-1, 1]) body.add(at(box(0.08, 0.34, 0.04, 0x1f2229, 0, 0, 0, { outline: false }), s * 0.12, 0.42, 0.3, 0, 0, s * 0.35));
  body.add(at(cone(0.035, 0.06, accent, 0, 0, 0, { outline: false, seg: 3 }), 0.2, 0.46, 0.27, 0, -0.5, PI));
  // 頭（大圓外套膜）：斑點、眼睛、方框眼鏡、眉、壞笑
  const head = grp(0, 0.6, 0, body);
  head.add(sc(sphere(0.48, skin, 0, 0.45, -0.05, { seg: 20 }), 1, 1.12, 1));
  for (const [x, y, z, r] of [[0.25, 0.8, 0.22, 0.07], [-0.3, 0.6, 0.26, 0.05], [0.05, 0.95, -0.1, 0.08], [-0.15, 0.85, 0.24, 0.05], [0.35, 0.5, -0.2, 0.06]]) head.add(sphere(r, spot, x, y, z, { outline: false }));
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = eye(0.12, { look: -s * 0.4, lid: skin, lidX: 0.5, lidZ: s * -0.25 }); e.position.set(s * 0.16, 0.38, 0.36); head.add(e); eyes.push(e);
    head.add(at(box(0.18, 0.04, 0.04, 0x1a1a1a, 0, 0, 0, { outline: false }), s * 0.16, 0.56, 0.4, 0, 0, s * 0.3));
    head.add(box(0.27, 0.2, 0.02, 0x1a1a1a, s * 0.16, 0.38, 0.47, { outline: false, r: 0.03 }));
    head.add(box(0.22, 0.15, 0.025, 0xd8f4ff, s * 0.16, 0.38, 0.47, { mat: flat(0xd8f4ff, { transparent: true, opacity: 0.25 }), outline: false, r: 0.02 }));
  }
  head.add(box(0.08, 0.025, 0.02, 0x1a1a1a, 0, 0.4, 0.48, { outline: false }));
  const mouth = sc(sphere(0.06, 0x5a1e2a, 0.03, 0.18, 0.42, { outline: false }), 1.8, 0.6, 0.6); mouth.rotation.z = 0.2; head.add(mouth);
  mouth.add(box(0.06, 0.03, 0.03, 0xffffff, 0, 0.02, 0.04, { outline: false }));
  // 臂觸手：右持手機（螢幕閃）、左持大聲公
  const mkArm = (s, sideItem) => {
    const a = grp(s * 0.3, 0.5, 0.05, body);
    a.add(tube([[0, 0, 0], [s * 0.18, -0.15, 0.08], [s * 0.3, 0.05, 0.22], [s * 0.3, 0.3, 0.28]], 0.07, skin, { taper: 0.6, seg: 14 }));
    for (const [x, y, z] of [[0.2, -0.1, 0.16], [0.3, 0.1, 0.3]]) a.add(sc(sphere(0.02, SUCK, s * x, y, z, { outline: false, seg: 8 }), 1, 1, 0.5));
    const hand = grp(s * 0.3, 0.38, 0.3, a);
    hand.add(sideItem); return { a, hand };
  };
  const scrMat = own(accent);
  const phone = grp(); phone.add(box(0.14, 0.26, 0.03, 0x161616, 0, 0, 0)); phone.add(box(0.11, 0.2, 0.01, 0, 0, 0.01, 0.017, { mat: scrMat, outline: false }));
  const notif = sphere(0.025, 0xff2a2a, 0.06, 0.12, 0.02, { mat: flat(0xff2a2a), outline: false }); phone.add(notif);
  const mega = grp(); mega.rotation.set(-0.6, 0, 0.5);
  mega.add(at(cone(0.16, 0.36, 0xffffff, 0, 0, 0, { seg: 16 }), 0, 0.1, 0, PI, 0, 0));
  mega.add(cyl(0.165, 0.165, 0.04, accent, 0, 0.27, 0, { seg: 16 }));
  mega.add(cyl(0.04, 0.04, 0.12, 0x2a2a2a, 0, -0.12, 0));
  mega.add(box(0.04, 0.1, 0.04, 0x2a2a2a, 0, -0.1, 0.06, { outline: false }));
  const R = mkArm(-1, phone), L = mkArm(1, mega);
  // 背後觸手高舉廣告看板（燈泡跑馬燈）
  const stalk = rooted(body, [0, 0.35, -0.3], [[0, 0.35, -0.3], [0.15, 0.8, -0.55], [-0.1, 1.25, -0.5], [0, 1.6, -0.42]], 0.065, skin, { taper: 0.5, seg: 14 });
  const bb = grp(0, 1.47, -0.1, stalk); bb.rotation.x = -0.25;
  bb.add(box(1.0, 0.44, 0.05, accent, 0, 0, 0));
  bb.add(box(1.04, 0.06, 0.07, 0x2a2a2a, 0, -0.24, 0));
  const bt = label(text, 0.9, { color: '#ffffff', stroke: '#1b1226', size: 56 }); bt.position.set(0, 0.0, 0.03); bb.add(bt);
  const bulbOn = flat(0xfff3a0), bulbOff = toon(0x8a7a40);
  const BU = [];
  for (let i = 0; i < 8; i++) { const m = sphere(0.025, 0, -0.45 + i * (0.9 / 7), 0.25, 0.03, { mat: bulbOn, outline: false, seg: 8 }); bb.add(m); BU.push(m); }
  const anim = (t) => {
    const k = Math.floor(t * 6);
    for (let i = 0; i < BU.length; i++) BU[i].material = (i + k) % 3 === 0 ? bulbOff : bulbOn;
    const f = 0.7 + 0.3 * Math.sin(t * 7);
    scrMat.color.setHex(accent).multiplyScalar(f);
    notif.visible = blink(t, 0.9, 0.6);
  };
  return finish(g, { body, head, armL: L.a, armR: R.a, weapon: phone, megaphone: mega, sign: bb, eyes, mouth, extra: [...legs, stalk] }, 2.6, anim, [...BU, notif]);
}
const adsA = () => adsExec(0xff8a3d, 0xe0662a, 0x14b8a6, 'BUY NOW!!');
const adsB = () => adsExec(0xff6fa5, 0xe04a86, 0xffc93c, 'SUBSCRIBE');

// 不可跳過的雙重 30 秒廣告主腦：漂浮巨腦（突觸閃光）、裂開的液晶螢幕臉（會眨的眼＋倒數計時＋假的 Skip Ad）、
// 自動續訂金冠（環繞箭頭）、5G 天線、環繞彈出式廣告視窗、光纖電纜垂掛（會晃）
function brainGeo(R) {
  return cg('brainGeo' + R, () => {
    const geo = new THREE.SphereGeometry(R, 56, 40);
    const pos = geo.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); n.copy(v).normalize();
      let d = 0.03 * Math.sin(n.x * 7 + n.z * 5) * Math.sin(n.y * 6 - n.z * 4);
      if (n.y > -0.3) d -= 0.22 * Math.exp(-(n.x * n.x) / 0.004) * Math.min(1, (n.y + 0.3) * 2);
      v.addScaledVector(n, d);
      v.y *= 0.82; v.z *= 1.05;
      if (v.y < 0) v.y *= 0.85;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  });
}
// 每個實例自己的動態文字貼片（倒數計時）
function dynLabel(w, h, draw) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(cg(`q${q(w)},${q(h)}`, () => new THREE.PlaneGeometry(w, h)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.2 }));
  m.castShadow = false;
  let last = null;
  m.userData.set = (s) => { if (s === last) return; last = s; const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); draw(x, c, s); tex.needsUpdate = true; };
  return m;
}
function brain() {
  const g = new THREE.Group();
  const PINKB = 0xf59ab0;
  const body = grp(0, 3.0, 0, g);
  const R = 1.5;
  body.add(part(brainGeo(R), PINKB, { mat: toon(PINKB, { emissive: 0x3a0a1a, emissiveIntensity: 0.25 }) }));
  // 腦回：蜿蜒的管子貼著表面走
  const surf = (nx, phi) => {
    const r = Math.sqrt(Math.max(0, 1 - nx * nx));
    const x = nx * R, y0 = r * Math.sin(phi) * R, z = r * Math.cos(phi) * R * 1.05;
    let y = y0 * 0.82; if (y < 0) y *= 0.85; return [x, y, z];
  };
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
    const pts = [], x0 = 0.2 + k * 0.2, ph0 = k % 2 ? 0.55 : 0.2, ph1 = PI - 0.1 + (k % 2) * 0.3;
    for (let i = 0; i <= 16; i++) { const t = i / 16, ph = ph0 + (ph1 - ph0) * t; pts.push(surf(sd * Math.min(0.93, x0 + 0.07 * Math.sin(t * 13 + k * 1.7)), ph)); }
    body.add(tube(pts, 0.065, 0xe9809c, { seg: 48, rs: 6 }));
  }
  // 突觸閃光
  const SY = [];
  const synMat = flat(0xfff3a0);
  for (let i = 0; i < 8; i++) {
    const p = surf((i % 2 ? 1 : -1) * (0.3 + (i % 4) * 0.15), 0.4 + i * 0.32);
    const m = sphere(0.06, 0, p[0] * 1.03, p[1] * 1.03, p[2] * 1.03, { mat: synMat, outline: false, shadow: false, seg: 8 }); body.add(m); SY.push(m);
  }
  // 腦幹＋頸環
  body.add(cyl(0.35, 0.25, 0.7, 0xe9809c, 0, -1.35, -0.2, { seg: 14 }));
  for (let i = 0; i < 2; i++) body.add(torus(0.33 - i * 0.04, 0.05, 0x3a3540, 0, -1.2 - i * 0.25, -0.2, { seg: 16 })), body.children[body.children.length - 1].rotation.x = PI / 2;
  // 螢幕臉
  const head = grp(0, 0.15, R * 1.08, body); head.rotation.x = -0.32;
  head.add(box(1.75, 1.15, 0.2, 0x1a1a1f, 0, 0, 0, { r: 0.08 }));
  for (const s of [-1, 1]) head.add(box(0.12, 0.5, 0.26, 0x2a2a30, s * 0.92, 0, -0.04));
  const scr = strip(1.58, 0.98, 0x0d1f24); scr.position.z = 0.105; head.add(scr);
  // 眼睛（眼白＋虹膜會轉＋上眼皮眨眼）
  const eyeG = grp(0, -0.04, 0.11, head);
  const sclera = disc(0.34, 0xffffff); sclera.position.z = 0.002; sclera.scale.set(1.35, 0.85, 1); eyeG.add(sclera);
  const iris = grp(0, 0, 0, eyeG);
  const ir = disc(0.22, 0xff3a2a); ir.position.z = 0.004; iris.add(ir);
  const pu = disc(0.11, 0x111111); pu.position.z = 0.006; iris.add(pu);
  const gl = disc(0.04, 0xffffff); gl.position.set(0.06, 0.06, 0.008); iris.add(gl);
  for (let i = 0; i < 5; i++) { const v = strip(0.12, 0.01, 0xd84a5a); const a = PI + 0.4 + i * 0.25; v.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.2 + 0.02, 0.003); v.rotation.z = a; eyeG.add(v); }
  // 文字：倒數（每實例 canvas）、1 of 2、假 Skip
  const timer = dynLabel(0.5, 0.12, (x, c, s) => { x.font = '900 52px monospace'; x.fillStyle = '#ffd23f'; x.textBaseline = 'middle'; x.fillText(s, 6, c.height / 2); });
  timer.position.set(-0.48, 0.36, 0.112); head.add(timer);
  const ad1 = label('1 of 2', 0.22, { color: '#ffffff', size: 48 }); ad1.position.set(0.58, 0.38, 0.112); head.add(ad1);
  const ad2 = label('2 of 2', 0.22, { color: '#ff9cc0', size: 48 }); ad2.position.set(0.58, 0.38, 0.112); head.add(ad2); ad2.visible = false;
  const skipA = label('Skip Ad ▸', 0.16, { color: '#ffffff', bg: '#333333', size: 40 }); skipA.position.set(0.62, -0.38, 0.113); head.add(skipA);
  const skipB = label('Skip in ∞', 0.16, { color: '#ffd23f', bg: '#333333', size: 40 }); skipB.position.set(0.62, -0.38, 0.113); head.add(skipB); skipB.visible = false;
  // 進度條（會長）
  const track = strip(1.5, 0.03, 0x555555); track.position.set(0, -0.47, 0.111); head.add(track);
  const barG = grp(-0.75, -0.47, 0.112, head);
  const bar = strip(1.5, 0.03, 0xffd23f); bar.position.x = 0.75; barG.add(bar);
  barG.scale.x = 0.08;
  // 喇叭嘴（下方格柵）
  const mouth = grp(0, -0.72, 0.02, head);
  mouth.add(box(0.7, 0.18, 0.12, 0x2a2a30, 0, 0, 0));
  for (let i = 0; i < 5; i++) mouth.add(box(0.04, 0.12, 0.02, 0xff3a2a, -0.24 + i * 0.12, 0, 0.065, { mat: flat(0xff3a2a), outline: false }));
  // 裂痕
  const crack = grp(0.35, 0.15, 0.114, head);
  for (const [x, y, l, r] of [[0, 0, 0.42, 0.6], [0.12, -0.18, 0.3, -0.5], [-0.15, 0.12, 0.28, 2.4], [0.28, 0.08, 0.22, 0.2], [-0.05, -0.22, 0.25, 1.9]]) {
    const m = strip(l, 0.018, 0xe8f6ff); m.position.set(x, y, 0); m.rotation.z = r; crack.add(m);
  }
  // 金冠（自動續訂之冠）＋寶石＋環繞的續訂箭頭
  const crown = grp(0, R * 0.8, -0.1, body); crown.rotation.x = -0.12;
  crown.add(cyl(0.55, 0.62, 0.22, 0xf2c230, 0, 0, 0, { seg: 20 }));
  crown.add(torus(0.6, 0.035, 0xffe27a, 0, -0.1, 0, { outline: false, seg: 24 })); crown.children[1].rotation.x = PI / 2;
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; crown.add(cone(0.12, 0.3, 0xf2c230, Math.sin(a) * 0.53, 0.25, Math.cos(a) * 0.53)); crown.add(sphere(0.04, 0xffffff, Math.sin(a) * 0.53, 0.42, Math.cos(a) * 0.53, { outline: false, seg: 8 })); }
  for (const [a, c] of [[0, 0xd8231a], [PI / 3, 0x14b8a6], [-PI / 3, 0x4ea2ff]]) crown.add(sphere(0.07, c, Math.sin(a) * 0.6, 0.0, Math.cos(a) * 0.6, { seg: 10 }));
  const renew = grp(0, 0.05, 0, crown);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2;
    // 弧形箭身（XZ 平面、從 +X 往 +Z 繞）＋切線方向的箭頭
    const arr = grp(0, 0, 0, renew); arr.rotation.y = a;
    arr.add(at(torus(0.85, 0.025, 0x4ef2ff, 0, 0, 0, { mat: flat(0x4ef2ff), outline: false, seg: 10, arc: 1.2 }), 0, 0, 0, PI / 2, 0, 0));
    arr.add(at(cone(0.08, 0.18, 0x4ef2ff, 0, 0, 0, { mat: flat(0x4ef2ff), outline: false, seg: 8 }), Math.cos(1.2) * 0.85, 0, Math.sin(1.2) * 0.85, 0, -(1.2 + PI / 2), -PI / 2));
  }
  // 5G 天線（燈閃）
  const ANT = [];
  for (const s of [-1, 1]) {
    const a = grp(s * 0.8, 0.95, -0.4, body); a.rotation.z = s * -0.35;
    a.add(cyl(0.02, 0.03, 0.6, 0x3a3540, 0, 0.3, 0, { seg: 6 }));
    for (const y of [0.25, 0.45]) a.add(cyl(0.12 - y * 0.12, 0.12 - y * 0.12, 0.02, 0x3a3540, 0, y, 0, { outline: false, seg: 8 }));
    const tip = sphere(0.05, 0, 0, 0.62, 0, { mat: own(0xff3a2a), outline: false }); a.add(tip); ANT.push(tip);
  }
  // 環繞的彈出式廣告視窗（小到點不到的 X）
  const pops = grp(0, 0, 0, body); const POP = [];
  const popTxt = [['WIN!!', '#ff4f9a'], ['FREE TRIAL', '#14b8a6'], ['HOT DEALS', '#ffd23f']];
  for (let i = 0; i < 3; i++) {
    const p = grp(0, 0, 0, pops);
    p.add(box(0.62, 0.42, 0.04, 0xf3f3f3, 0, 0, 0, { r: 0.02 }));
    p.add(box(0.62, 0.08, 0.05, 0x3a5ad8, 0, 0.17, 0, { outline: false, r: 0.01 }));
    p.add(box(0.035, 0.035, 0.06, 0xd8231a, 0.27, 0.17, 0, { outline: false, r: 0.005 }));
    const tx = label(popTxt[i][0], 0.5, { color: popTxt[i][1], stroke: '#1b1226', size: 48 }); tx.position.set(0, -0.04, 0.03); p.add(tx);
    POP.push(p);
  }
  // 光纖電纜垂掛（每條以根部為樞紐，會晃）
  const tips = [0xff6a1a, 0x7dff4a, 0x4ef2ff, 0xffd23f, 0xff4f9a, 0x7dff4a, 0x4ef2ff];
  const cables = [], TIP = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * PI * 2 + 0.2, rr = 0.5 + (i % 2) * 0.35;
    const x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr * 0.9;
    const x1 = Math.cos(a) * (rr + 0.45), z1 = Math.sin(a) * (rr + 0.4);
    const y1 = -2.6 + (i % 3) * 0.25;
    const cg_ = rooted(body, [x0, -0.9, z0], [[x0, -0.9, z0], [x0 * 1.1, -1.6, z0 * 1.1], [x1, y1 + 0.3, z1], [x1 + 0.08, y1, z1 + 0.05]], 0.045, 0x1f1c24, { seg: 14, rs: 6 });
    cg_.add(at(cyl(0.07, 0.07, 0.12, 0x8a9096, 0, 0, 0, { seg: 8 }), x1 + 0.08 - x0, y1 + 0.04 + 0.9, z1 + 0.05 - z0));
    const tip = sphere(0.07, 0, x1 + 0.08 - x0, y1 - 0.06 + 0.9, z1 + 0.05 - z0, { mat: flat(tips[i]), outline: false, shadow: false });
    cg_.add(tip); TIP.push(tip);
    cables.push(cg_);
  }
  const anim = (t) => {
    // 倒數：每 31 拍一輪，兩支廣告輪播
    const tt = t * 1.5, cyc = Math.floor(tt / 31), sec = 30 - Math.floor(tt % 31);
    timer.userData.set('AD 0:' + (sec < 10 ? '0' : '') + sec);
    const second = (cyc & 1) === 1;
    ad1.visible = !second; ad2.visible = second;
    barG.scale.x = Math.max(0.02, (tt % 31) / 31);
    const sk = blink(t, 0.5, 0.5); skipA.visible = sk; skipB.visible = !sk;
    iris.position.set(Math.sin(t * 0.7) * 0.12, Math.sin(t * 1.1) * 0.05, 0);
    renew.rotation.y = -t * 1.2;
    for (let i = 0; i < SY.length; i++) SY[i].scale.setScalar(0.4 + 0.8 * Math.max(0, Math.sin(t * 3 + i * 1.9)));
    for (let i = 0; i < ANT.length; i++) ANT[i].visible = blink(t + i * 0.3, 1.1, 0.5);
    for (let i = 0; i < TIP.length; i++) TIP[i].scale.setScalar(1 + 0.3 * Math.sin(t * 4 + i));
    // 彈窗繞行；轉到臉前方時「被關掉」縮小，離開後又彈出來
    for (let i = 0; i < POP.length; i++) {
      const a = i / 3 * PI * 2 + t * 0.35, ca = Math.cos(a), sa = Math.sin(a);
      POP[i].position.set(sa * 2.3, 0.3 + Math.sin(t * 1.2 + i * 2) * 0.25, ca * 2.3);
      POP[i].rotation.set(0, a, Math.sin(t + i) * 0.1);
      const k = Math.min(1, Math.max(0, (0.82 - ca) * 4));
      POP[i].scale.setScalar(k < 0.02 ? 0.001 : k);
    }
  };
  return finish(g, { body, head, eye: eyeG, iris, crown, eyes: [eyeG], mouth, extra: cables }, 4.75, anim, [...SY, ...ANT, ...TIP]);
}

export const FOE2 = {
  gator, dodger, sax, ratking, batA, batB, cowboy, mecha,
  frat, ghost, chairman, marcus,
  robot, lawyer, hacker, lizard, lizard2,
  dragon, adsA, adsB, brain,
};
