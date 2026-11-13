// 四位可操作英雄的卡通模型：查德（健身房狂戰士）、凱倫阿姨、佛州老戴、多吉。
// 契約：回傳 THREE.Group，腳底 y=0、面向 +Z；角色的右手在 -X、左手在 +X。
// userData.height = 頭頂高度；userData.parts = { body, head, armL, armR, forearmL, forearmR, legL, legR,
//   weapon, eyes[], mouth, extra[] }；userData.anim(t, dt) = 每幀小動畫（喇叭、螢幕、引信等）。
// 大臂、腿的群組原點在肩／髖，前臂原點在手肘，幾何往 -Y 垂下；姿勢用前臂的靜止旋轉擺出，
// 動畫層以「靜止值＋偏移」驅動。眼睛群組原點在眼球中心（縮 scale.y 就是眨眼）。
// 細節很多，所以同一個關節下的靜態零件用 bake() 依材質合併成少數網格，描邊也合成一個。
/* global THREE */
import { part, box, sphere, cyl, cone, capsule, torus, group, textPlane, gradientMap, outlineMat, seg, toonify } from '../kit.js';

const NO = { outline: false };

// ── 調色盤（純數字，頂層不碰 THREE）──────────────────────
const INK = 0x2a1a2e;      // 眼線、瞳孔、嘴巴
const WHITE = 0xffffff;
const GOLD = 0xffc23a;
const GOLD_DK = 0xb47a12;

// ── 小工具 ───────────────────────────────────────────────
function V(x, y, z) { return new THREE.Vector3(x, y, z); }
function rot(m, x = 0, y = 0, z = 0) { m.rotation.set(x, y, z); return m; }
function scl(m, x, y = x, z = x) { m.scale.set(x, y, z); return m; }
function at(m, x, y, z) { m.position.set(x, y, z); return m; }
// 把沿 +Y 的網格擺到 a→b（幾何 +Y 端落在 b）
function span(m, a, b) {
  const A = V(a[0], a[1], a[2]), B = V(b[0], b[1], b[2]);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), B.sub(A).normalize());
  return m;
}
function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
function limb(r, a, b, color, o) { return span(capsule(r, dist(a, b), color, 0, 0, 0, o), a, b); }
// 錐形管：a 端半徑 ra、b 端半徑 rb
function tube(ra, rb, a, b, color, o) { return span(cyl(rb, ra, dist(a, b), color, 0, 0, 0, o), a, b); }
// 頭部球面上 (x, y) 的表面 z（球心在 (0, cy, cz)，半徑 R）
function fz(R, cy, x, y, cz = 0) { return cz + Math.sqrt(Math.max(0, R * R - x * x - (y - cy) * (y - cy))); }
// 旋轉體（pts = [[半徑, y], ...] 由下往上）
function lathe(pts, color, o = {}) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg(o.seg || 18), o.phi0 || 0, o.phiLen || Math.PI * 2);
  return part(g, color, o);
}
function DS() { return { side: THREE.DoubleSide }; }

// ── 合併：同材質的靜態零件合成一個網格，有描邊的合成一個描邊網格 ──
function matKey(m) {
  return [m.type, m.color ? m.color.getHex() : 0, m.emissive ? m.emissive.getHex() : 0, m.emissiveIntensity ?? 0,
    m.transparent, m.opacity, m.side, m.map ? m.map.uuid : ''].join('|');
}
function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array, vo * 3);
    if (n) nor.set(n.array, vo * 3);
    if (u) uv.set(u.array, vo * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < g.index.count; i++) idx[io++] = a[i] + vo; }
    else for (let i = 0; i < p.count; i++) idx[io++] = vo + i;
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
// kids 的座標以 target 為準（可巢狀群組、可傳陣列）
function bake(target, ...kids) {
  const root = new THREE.Group();
  for (const k of kids.flat(4)) if (k) root.add(k);
  root.updateMatrixWorld(true);
  const buckets = new Map(), ol = [], used = [];
  root.traverse(o => {
    if (!o.isMesh || o.name === 'outline') return;
    const geo = o.geometry;
    geo.applyMatrix4(o.matrixWorld);
    used.push(geo);
    const k = matKey(o.material);
    let b = buckets.get(k);
    if (!b) buckets.set(k, b = { mat: o.material, geos: [] });
    b.geos.push(geo);
    if (o.children.some(c => c.name === 'outline')) ol.push(geo);
  });
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeos(b.geos), b.mat);
    m.castShadow = !b.mat.transparent;
    target.add(m);
  }
  if (ol.length) {
    const m = new THREE.Mesh(mergeGeos(ol), outlineMat());
    m.name = 'outline'; m.raycast = () => {};
    target.add(m);
  }
  for (const g of used) g.dispose();
  return target;
}
function pivot(name, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); return g; }

// ── 共用部件 ─────────────────────────────────────────────
// 卡通眼：墨線外框＋眼白＋虹膜＋瞳孔＋高光；群組原點在眼球中心
function eye(x, y, z, r, iris, o = {}) {
  const e = pivot('eye', x, y, z);
  e.rotation.set(o.rx || 0, Math.atan2(x, 0.22) * 0.9, o.rz || 0);
  const lx = (o.lx || 0) * r, ly = (o.ly || 0) * r, sy = o.sy || 1;
  bake(e,
    scl(sphere(r * 1.15, INK, 0, 0, -0.003, NO), 1, sy, 0.42),
    scl(sphere(r, WHITE, 0, 0, 0, NO), 1, sy, 0.45),
    scl(sphere(r * 0.62, iris, lx, ly, r * 0.3, NO), 1, 1, 0.42),
    iris !== INK && scl(sphere(r * 0.32, INK, lx, ly, r * 0.5, NO), 1, 1, 0.35),
    sphere(r * 0.17, WHITE, lx + r * 0.24, ly + r * 0.26, r * 0.52, NO),
    sphere(r * 0.08, WHITE, lx - r * 0.2, ly - r * 0.22, r * 0.5, NO),
  );
  return e;
}
// 握拳（s=+1 角色左手、-1 右手；拇指在內側前方）
function fist(c, s, x, y, z, k = 1) {
  return at(group(
    box(0.1 * k, 0.1 * k, 0.1 * k, c, 0, 0, 0, { r: 0.035 * k }),
    rot(capsule(0.027 * k, 0.07 * k, c, 0, -0.03 * k, 0.04 * k), 0, 0, Math.PI / 2),
    rot(capsule(0.022 * k, 0.04 * k, c, -s * 0.045 * k, 0.005 * k, 0.03 * k), 0.4, 0, -s * 0.5),
  ), x, y, z);
}
// 連指手套手：掌心朝身體、拇指朝前
function mitten(c, s, x, y, z, k = 1) {
  return at(group(
    scl(sphere(0.05 * k, c, 0, 0, 0), 0.72, 1.15, 1),
    scl(sphere(0.042 * k, c, 0, -0.05 * k, 0.004 * k), 0.68, 1.05, 0.95),
    rot(capsule(0.018 * k, 0.04 * k, c, -s * 0.01 * k, -0.01 * k, 0.045 * k), 0.7, 0, 0),
  ), x, y, z);
}
// 球鞋：鞋底在 y=0、鞋頭朝 +Z
function sneaker(w, l, h, cU, cS, cL, cT, sole = 0.04) {
  const top = sole + h;
  return group(
    box(w * 1.06, sole, l, cS, 0, sole / 2, 0, { r: Math.min(0.018, sole * 0.4) }),
    box(w, h, l * 0.6, cU, 0, sole + h / 2 - 0.004, -l * 0.18, { r: Math.min(w, h) * 0.32 }),
    scl(sphere(w / 2, cU, 0, sole, l * 0.14), 1, (h * 0.8) / (w / 2), (l * 0.34) / (w / 2)),
    cT && box(w * 1.02, h * 0.34, l * 0.26, cT, 0, sole + h * 0.3, -l * 0.33, { r: 0.02, outline: false }),
    rot(box(w * 0.46, 0.014, 0.022, cL, 0, top - 0.006, -l * 0.02, NO), -0.3, 0, 0),
    rot(box(w * 0.46, 0.014, 0.022, cL, 0, top - 0.016, l * 0.05, NO), -0.45, 0, 0),
    rot(box(w * 0.42, 0.014, 0.022, cL, 0, top - 0.03, l * 0.115, NO), -0.6, 0, 0),
    rot(box(w * 0.5, h * 0.5, 0.03, cU, 0, top - 0.004, -l * 0.08, { r: 0.012 }), -0.35, 0, 0),
  );
}

// 骨架：腿與身體掛在根節點，手臂與頭掛在身體下，前臂掛在大臂下
function rig(o) {
  const g = new THREE.Group();
  const body = pivot('body', 0, o.hipY, 0);
  const legL = pivot('legL', o.hipX, o.hipY, 0);
  const legR = pivot('legR', -o.hipX, o.hipY, 0);
  const armL = pivot('armL', o.shX, o.shY, o.shZ || 0);
  const armR = pivot('armR', -o.shX, o.shY, o.shZ || 0);
  const head = pivot('head', 0, o.neckY, o.neckZ || 0);
  const forearmL = pivot('forearmL', 0, -o.elbow, 0);
  const forearmR = pivot('forearmR', 0, -o.elbow, 0);
  armL.add(forearmL); armR.add(forearmR);
  body.add(armL, armR, head);
  g.add(legL, legR, body);
  return { g, body, legL, legR, armL, armR, forearmL, forearmR, head };
}
function finish(R, weapon, o = {}) {
  weapon.name = 'weapon';
  const { g, body, head, armL, armR, forearmL, forearmR, legL, legR } = R;
  g.userData.parts = { body, head, armL, armR, forearmL, forearmR, legL, legR, weapon, eyes: o.eyes || [], extra: o.extra || [] };
  if (o.mouth) g.userData.parts.mouth = o.mouth;
  if (o.anim) g.userData.anim = o.anim;
  // 頭頂高度不算會晃的髮束（避免名牌浮太高）
  const loose = (o.extra || []).filter(e => e.parent === head);
  for (const e of loose) head.remove(e);
  g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(head);
  g.userData.height = Math.round(bb.max.y * 100) / 100;
  for (const e of loose) head.add(e);
  g.updateMatrixWorld(true);
  return g;
}

// 浴袍條紋材質（程序產生的直條紋貼圖）
let _stripe = null;
function stripeMat() {
  if (_stripe) return _stripe;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const x = c.getContext('2d');
  x.fillStyle = '#3fd17a'; x.fillRect(0, 0, 64, 4);
  x.fillStyle = '#fff6dc'; x.fillRect(22, 0, 14, 4);
  x.fillStyle = '#1f8f55'; x.fillRect(40, 0, 5, 4);
  x.fillStyle = '#fff6dc'; x.fillRect(49, 0, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 1);
  t.magFilter = THREE.NearestFilter;
  _stripe = toonify(new THREE.MeshToonMaterial({ map: t, gradientMap: gradientMap(), side: THREE.DoubleSide }));
  return _stripe;
}

// ═════════════════════════════════════════════════════════
// 1) 查德・布羅：倒三角巨型上身＋竹竿細腿
// ═════════════════════════════════════════════════════════
function buildChad() {
  const SKIN = 0xd9905a, SKIN_DK = 0xb8703e, VEIN = 0x9a5a34, TANK = 0xff6b2c, TANK_DK = 0xd9531c, SHORTS = 0x2d2b3a, HAIR = 0x4a2a16;
  const BELT = 0x6b3a1e, STITCH = 0xe8a868, STEEL = 0xc8ccd6, STEEL_DK = 0x8a90a0, PLATE = 0x3a3a4a, PLATE2 = 0x55556a;
  const SOCK = 0xf6f6f2, SHOE = 0xf2f2f2, LACE = 0x3a3a4a, LENS = 0x241d30, IRIS = 0x3f7fd6, TEETH = 0xfffbef, TONGUE = 0xe0576a;
  const R = rig({ hipY: 0.5, hipX: 0.11, shX: 0.55, shY: 0.75, neckY: 0.86, neckZ: 0.02, elbow: 0.34 });
  const { body, armL, armR, head, forearmL, forearmR } = R;

  // 腿：細到可笑，配條紋高筒襪與厚底球鞋
  for (const [leg, s] of [[R.legL, 1], [R.legR, -1]]) {
    bake(leg,
      cyl(0.108, 0.1, 0.13, SHORTS, 0, -0.09, 0),
      cyl(0.104, 0.104, 0.022, TANK, 0, -0.15, 0, NO),
      limb(0.05, [0, -0.12, 0], [0, -0.38, 0], SKIN),
      scl(sphere(0.058, SKIN, 0, -0.24, 0.01), 1, 0.9, 1),
      cyl(0.062, 0.058, 0.16, SOCK, 0, -0.39, 0),
      cyl(0.064, 0.064, 0.02, TANK, 0, -0.33, 0, NO),
      cyl(0.0635, 0.0635, 0.016, TANK, 0, -0.355, 0, NO),
      at(sneaker(0.15, 0.27, 0.1, SHOE, TANK, LACE, TANK), 0, -0.5, 0.045),
      sphere(0.012, TANK, s * 0.077, -0.43, -0.02, NO),
    );
  }

  // 身體（原點在髖）：短褲、舉重腰帶、背心、斜方肌
  const tank = scl(lathe([[0.22, 0.02], [0.27, 0.14], [0.36, 0.32], [0.46, 0.52], [0.5, 0.64], [0.46, 0.74], [0.32, 0.83], [0.12, 0.87]], TANK), 1, 1, 0.6);
  const back = textPlane('從不練腿', 0.36, { color: '#fff4e0', size: 56 });
  back.position.set(0, 0.5, -0.283); back.rotation.y = Math.PI;
  bake(body,
    box(0.5, 0.2, 0.34, SHORTS, 0, -0.03, 0, { r: 0.07 }),
    [1, -1].map(s => limb(0.009, [s * 0.03, 0.05, 0.176], [s * 0.045, -0.05, 0.176], WHITE, NO)),
    scl(cyl(0.285, 0.285, 0.13, BELT, 0, 0.12, 0), 1, 1, 0.76),
    scl(cyl(0.287, 0.287, 0.006, STITCH, 0, 0.168, 0, NO), 1, 1, 0.76),
    scl(cyl(0.287, 0.287, 0.006, STITCH, 0, 0.072, 0, NO), 1, 1, 0.76),
    box(0.13, 0.095, 0.03, STEEL, 0, 0.12, 0.222, { r: 0.014 }),
    box(0.08, 0.05, 0.02, BELT, 0, 0.12, 0.234, NO),
    box(0.012, 0.06, 0.016, STEEL_DK, 0, 0.12, 0.246, NO),
    tank,
    scl(cyl(0.232, 0.232, 0.02, TANK_DK, 0, 0.19, 0, NO), 1, 1, 0.66),
    [1, -1].map(s => scl(sphere(0.17, TANK, s * 0.16, 0.66, 0.2), 1.15, 0.72, 0.62)),
    [1, -1].map(s => scl(sphere(0.05, TANK_DK, s * 0.16, 0.6, 0.29, NO), 2.2, 0.25, 0.3)),
    scl(sphere(0.24, SKIN, 0, 0.83, -0.03), 1.65, 0.55, 0.95),   // 斜方肌
    [1, -1].map(s => rot(capsule(0.036, 0.24, TANK, s * 0.2, 0.93, -0.02), Math.PI / 2)),
    scl(sphere(0.16, SKIN, 0, 0.765, 0.2), 1.15, 0.6, 0.4),       // 背心 U 領
    cyl(0.13, 0.15, 0.14, SKIN, 0, 0.88, 0.02),
    back,
  );
  // 腰帶上的藍牙音響（左髖）：喇叭振膜會跟著重低音鼓動
  const spk = pivot('spk', 0.25, 0.12, 0.17); spk.rotation.y = 0.75;
  const woofer = pivot('woofer', 0, 0, 0.047);
  bake(spk,
    box(0.18, 0.11, 0.09, 0x1c1b24, 0, 0, 0, { r: 0.035 }),
    box(0.04, 0.12, 0.02, 0x3a3a48, 0, 0.0, -0.05, NO),
    sphere(0.008, 0x55ff99, 0, 0.045, 0.046, { outline: false, emissive: 0x33ff88, emissiveIntensity: 1 }),
  );
  bake(woofer, [-1, 1].map(s => rot(cyl(0.033, 0.033, 0.016, TANK, s * 0.045, 0, 0, NO), Math.PI / 2)),
    [-1, 1].map(s => sphere(0.012, 0x1c1b24, s * 0.045, 0, 0.008, NO)));
  spk.add(woofer); body.add(spk);
  // 右髖：掛在腰帶上的蛋白粉搖搖杯
  const shaker = pivot('shaker', -0.27, 0.07, 0.15); shaker.rotation.set(0.1, -0.5, 0.08);
  bake(shaker,
    cyl(0.055, 0.05, 0.1, 0xc9935e, 0, -0.04, 0),
    cyl(0.056, 0.055, 0.08, 0xeef4ff, 0, 0.05, 0),
    cyl(0.058, 0.058, 0.035, 0x23222c, 0, 0.105, 0),
    cyl(0.022, 0.026, 0.03, TANK, 0.018, 0.135, 0),
    [0, 1, 2].map(i => box(0.02, 0.004, 0.01, 0x7a8aa0, 0, 0.0 + i * 0.025, 0.054, NO)),
  );
  body.add(shaker);
  // 塞在背後腰帶的毛巾（會擺動）
  const towel = pivot('towel', 0.12, 0.17, -0.225);
  bake(towel,
    rot(box(0.15, 0.32, 0.03, WHITE, 0, -0.13, -0.012, { r: 0.012 }), 0.12, 0, 0),
    rot(box(0.152, 0.025, 0.032, TANK, 0, -0.22, -0.023, NO), 0.12, 0, 0),
    rot(box(0.152, 0.012, 0.032, TANK, 0, -0.255, -0.027, NO), 0.12, 0, 0),
  );
  body.add(towel);

  // 手臂：大三角肌、二頭三頭、青筋、大力水手前臂、方拳頭
  for (const [a, f, s] of [[armL, forearmL, 1], [armR, forearmR, -1]]) {
    bake(a,
      sphere(0.2, SKIN, 0, -0.02, 0),
      limb(0.15, [0, -0.05, 0], [0, -0.27, 0], SKIN),
      scl(sphere(0.14, SKIN, 0, -0.2, 0.07), 1, 1.1, 1),
      scl(sphere(0.12, SKIN, 0, -0.18, -0.07), 1, 1.2, 1),
      sphere(0.125, SKIN, 0, -0.34, -0.01),
      limb(0.011, [s * 0.02, -0.12, 0.205], [s * 0.035, -0.27, 0.185], VEIN, NO),
      limb(0.009, [s * 0.028, -0.2, 0.2], [s * 0.075, -0.25, 0.165], VEIN, NO),
      [0, 1].map(i => scl(sphere(0.03, TANK_DK, s * 0.13, 0.02 - i * 0.03, 0.12, NO), 0.4, 0.4, 0.4)),
    );
    bake(f,
      tube(0.11, 0.14, [0, 0, 0], [0, -0.24, 0.01], SKIN),
      limb(0.009, [s * 0.03, -0.06, 0.12], [s * 0.05, -0.2, 0.135], VEIN, NO),
      cyl(0.135, 0.135, 0.06, s > 0 ? 0x23222c : WHITE, 0, -0.27, 0.01),
      cyl(0.137, 0.137, 0.014, TANK, 0, -0.27, 0.01, NO),
      s > 0 && box(0.07, 0.04, 0.012, 0x66ffaa, 0, -0.27, 0.146, { outline: false, emissive: 0x33ff88, emissiveIntensity: 0.7 }),
      fist(SKIN, s, 0, -0.37, 0.02, 2.05),
    );
  }
  forearmL.rotation.x = -0.22;
  forearmR.rotation.x = -1.3;
  // 右手單手拎起奧林匹克槓（槓與前臂一起轉，槓身保持水平）
  const bar = pivot('weapon', 0, -0.37, 0.02);
  const cx = 0.55;
  bake(bar,
    rot(cyl(0.024, 0.024, 1.2, STEEL, cx, 0, 0), 0, 0, Math.PI / 2),
    rot(cyl(0.027, 0.027, 0.26, STEEL_DK, cx, 0, 0, NO), 0, 0, Math.PI / 2),
    [1, -1].map(s => [
      rot(cyl(0.036, 0.036, 0.38, STEEL, cx + s * 0.62, 0, 0), 0, 0, Math.PI / 2),
      rot(cyl(0.055, 0.055, 0.04, STEEL_DK, cx + s * 0.44, 0, 0), 0, 0, Math.PI / 2),
      rot(cyl(0.25, 0.25, 0.07, PLATE, cx + s * 0.6, 0, 0, { seg: 22 }), 0, 0, Math.PI / 2),
      rot(torus(0.226, 0.022, PLATE2, cx + s * 0.637, 0, 0, NO), 0, Math.PI / 2, 0),
      rot(torus(0.226, 0.022, PLATE2, cx + s * 0.563, 0, 0, NO), 0, Math.PI / 2, 0),
      rot(cyl(0.19, 0.19, 0.06, TANK, cx + s * 0.53, 0, 0, { seg: 20 }), 0, 0, Math.PI / 2),
      rot(cyl(0.13, 0.13, 0.045, PLATE, cx + s * 0.4775, 0, 0), 0, 0, Math.PI / 2),
      rot(cyl(0.05, 0.05, 0.02, STEEL, cx + s * 0.81, 0, 0, NO), 0, 0, Math.PI / 2),
    ]),
  );
  forearmR.add(bar);

  // 頭：方下巴、平頭＋抓尖、白頭帶、太陽眼鏡推在頭帶上、自信咧嘴
  const HC = 0.3, HR = 0.25, eyY = 0.3;
  const ez = fz(HR, HC, 0.09, eyY);
  bake(head,
    sphere(HR, SKIN, 0, HC, 0),
    box(0.4, 0.22, 0.34, SKIN, 0, 0.14, 0.04, { r: 0.09 }),
    scl(sphere(0.07, SKIN, 0, 0.07, 0.165), 1.5, 0.8, 0.8),
    limb(0.006, [0, 0.045, 0.218], [0, 0.085, 0.218], SKIN_DK, NO),
    [1, -1].map(s => [
      scl(sphere(0.062, SKIN, s * 0.245, 0.27, -0.01), 0.55, 1, 0.8),
      scl(sphere(0.034, SKIN_DK, s * 0.27, 0.27, 0.0, NO), 0.35, 0.75, 0.6),
      scl(sphere(0.05, HAIR, s * 0.222, 0.3, 0.07, NO), 0.4, 1.1, 0.75),
      rot(capsule(0.024, 0.085, HAIR, s * 0.09, 0.368, fz(HR, HC, 0.09, 0.368) + 0.004, NO), 0, 0, Math.PI / 2 + s * 0.24),
      scl(sphere(0.04, 0xe0a070, s * 0.15, 0.2, fz(HR, HC, 0.15, 0.2) - 0.012, NO), 1, 0.6, 0.35),
    ]),
    box(0.44, 0.13, 0.42, HAIR, 0, 0.48, -0.02, { r: 0.05 }),
    box(0.44, 0.19, 0.2, HAIR, 0, 0.38, -0.13, { r: 0.07 }),
    cyl(0.258, 0.258, 0.075, WHITE, 0, 0.41, 0),
    cyl(0.26, 0.26, 0.016, TANK, 0, 0.41, 0, NO),
    // 推上去的太陽眼鏡
    [1, -1].map(s => [
      rot(box(0.13, 0.07, 0.03, LENS, s * 0.075, 0.445, 0.255, { r: 0.022 }), -0.25, s * 0.15, 0),
      rot(box(0.05, 0.012, 0.005, WHITE, s * 0.075 + 0.02, 0.455, 0.272, NO), -0.25, s * 0.15, 0.5),
      rot(box(0.012, 0.012, 0.18, LENS, s * 0.252, 0.44, 0.15, NO), 0, 0, 0),
    ]),
    box(0.04, 0.016, 0.02, LENS, 0, 0.452, 0.262, NO),
    sphere(0.045, SKIN_DK, 0, 0.235, fz(HR, HC, 0, 0.235) + 0.008),
    [1, -1].map(s => sphere(0.014, 0x8a4a2a, s * 0.02, 0.215, fz(HR, HC, 0, 0.215) + 0.022, NO)),
  );
  // 前額抓尖的髮束（會晃）
  const tuft = pivot('tuft', 0, 0.54, 0.1);
  bake(tuft, [[-0.1, 0.0, -0.25], [0, 0.01, 0], [0.1, 0.0, 0.25]].map(([x, y, rz]) => rot(cone(0.045, 0.1, HAIR, x, y + 0.03, 0), 0.55, 0, rz)));
  head.add(tuft);
  const eyes = [1, -1].map(s => eye(s * 0.09, eyY, ez - 0.012, 0.052, IRIS, { ly: -0.05, lx: -s * 0.05 }));
  head.add(...eyes);
  const mouth = pivot('mouth', 0, 0.135, 0.212);
  bake(mouth,
    box(0.2, 0.085, 0.02, INK, 0, 0, 0, { r: 0.028, outline: false }),
    box(0.17, 0.032, 0.02, TEETH, 0, 0.018, 0.006, NO),
    box(0.15, 0.02, 0.02, TEETH, 0, -0.027, 0.005, NO),
    scl(sphere(0.04, TONGUE, 0, -0.014, 0.002, NO), 1.4, 0.45, 0.4),
  );
  head.add(mouth);
  return finish(R, bar, {
    eyes, mouth, extra: [tuft, towel],
    anim(t) { const b = Math.max(0, Math.sin(t * 8.4)); woofer.scale.setScalar(1 + b * b * b * b * 0.25); },
  });
}

// ═════════════════════════════════════════════════════════
// 2) 凱倫阿姨：不對稱金色鮑伯頭、滑到鼻樑的大墨鏡、開襟衫＋白七分褲
// ═════════════════════════════════════════════════════════
function buildKaren() {
  const SKIN = 0xf3c3a0, SKIN_DK = 0xe2a588, CARD = 0xffd23f, CARD_DK = 0xe0a91a, BLOUSE = 0xfff1e8, PANTS = 0xfbfbf7, PANTS_DK = 0xdedcd2;
  const HAIR = 0xf6e7b0, LOW = 0xc28a3e, BROW = 0x7a4a22, LIPS = 0xd8213f, SHOE = 0xa0503a, SOLE = 0x4a2418, SHADOW = 0x8fb0e8, BLUSH = 0xf29a9a;
  const CUP = 0xff5d8f, CUP_DK = 0xd93a6f, LENS = 0x1f1722, FRAME = 0x6a2430, PEARL = 0xfdf6ee, PURSE = 0x9a4a3a, PURSE_DK = 0x6a2e24, IRIS = 0x4f8f5a;
  const R = rig({ hipY: 0.68, hipX: 0.1, shX: 0.27, shY: 0.49, neckY: 0.58, elbow: 0.22 });
  const { body, armL, armR, head, forearmL, forearmR } = R;

  for (const [leg, s] of [[R.legL, 1], [R.legR, -1]]) {
    bake(leg,
      limb(0.088, [0, -0.02, 0], [0, -0.38, 0], PANTS),
      box(0.008, 0.32, 0.01, PANTS_DK, 0, -0.22, 0.087, NO),
      cyl(0.096, 0.092, 0.05, PANTS_DK, 0, -0.44, 0),
      limb(0.054, [0, -0.46, 0], [0, -0.6, 0], SKIN),
      at(group(
        box(0.125, 0.022, 0.25, SOLE, 0, 0.011, 0.02, { r: 0.008 }),
        box(0.115, 0.065, 0.15, SHOE, 0, 0.05, -0.03, { r: 0.03 }),
        scl(sphere(0.058, SHOE, 0, 0.026, 0.07), 1, 0.7, 1.15),
        rot(capsule(0.008, 0.06, GOLD, 0, 0.074, 0.055, NO), 0, 0, Math.PI / 2),
        cyl(0.026, 0.02, 0.03, SOLE, 0, 0.012, -0.085),
      ), 0, -0.68, 0.035),
      sphere(0.01, GOLD, s * 0.054, -0.6, 0.0, NO),
    );
  }

  // 身體：開襟衫（前方開口）罩在白襯衫外，珍珠項鍊、細腰帶、斜背包
  const cardPts = [[0.215, 0.0], [0.24, 0.12], [0.25, 0.3], [0.24, 0.44], [0.2, 0.53], [0.12, 0.6]];
  const gap = 0.34;
  const cardigan = scl(lathe(cardPts, CARD, { phi0: gap, phiLen: Math.PI * 2 - gap * 2, ...DS() }), 1, 1, 0.72);
  const blouse = scl(lathe([[0.2, 0.06], ...cardPts.slice(1).map(([r, y]) => [r - 0.012, y])], BLOUSE), 1, 1, 0.72);
  const edge = (s, r, y) => [s * r * Math.sin(gap), y, r * Math.cos(gap) * 0.72];
  const placket = [];
  for (const s of [1, -1]) for (let i = 0; i < cardPts.length - 1; i++) placket.push(limb(0.013, edge(s, cardPts[i][0] + 0.004, cardPts[i][1]), edge(s, cardPts[i + 1][0] + 0.004, cardPts[i + 1][1]), CARD_DK));
  const pearls = [];
  for (let i = 0; i <= 12; i++) { const a = -1.35 + i * (2.7 / 12); pearls.push(sphere(0.0145, PEARL, Math.sin(a) * 0.095, 0.53 - Math.cos(a) * 0.045, 0.015 + Math.cos(a) * 0.09, { seg: 8, outline: false })); }
  bake(body,
    box(0.38, 0.18, 0.28, PANTS, 0, 0.02, 0, { r: 0.08 }),
    scl(cyl(0.205, 0.205, 0.035, 0x5a3020, 0, 0.075, 0), 1, 1, 0.72),
    box(0.04, 0.03, 0.02, GOLD, 0, 0.075, 0.15, NO),
    blouse, cardigan, placket,
    [0, 1, 2].map(i => sphere(0.014, GOLD, edge(1, 0.25, 0.4)[0] + 0.012, 0.4 - i * 0.12, edge(1, 0.25, 0.4)[2] + 0.012, NO)),
    [0, 1, 2].map(i => sphere(0.01, PEARL, 0, 0.42 - i * 0.12, 0.178, NO)),
    [1, -1].map(s => rot(box(0.1, 0.09, 0.02, CARD_DK, s * 0.2, 0.13, 0.1, { r: 0.012 }), 0, s * 1.05, 0)),
    [1, -1].map(s => rot(scl(cone(0.06, 0.11, BLOUSE, s * 0.055, 0.52, 0.13), 1, 1, 0.3), Math.PI + 0.35, 0, -s * 0.55)),
    pearls,
    cyl(0.062, 0.068, 0.1, SKIN, 0, 0.58, 0.01),
    // 斜背包：左肩→右髖
    limb(0.012, [0.15, 0.53, 0.1], [0.0, 0.34, 0.19], PURSE_DK, NO),
    limb(0.012, [0.0, 0.34, 0.19], [-0.19, 0.16, 0.16], PURSE_DK, NO),
    at(rot(group(
      box(0.17, 0.13, 0.07, PURSE, 0, 0, 0, { r: 0.03 }),
      box(0.172, 0.065, 0.074, PURSE_DK, 0, 0.035, 0.003, { r: 0.02 }),
      box(0.03, 0.025, 0.012, GOLD, 0, 0.0, 0.042, NO),
    ), 0, -0.45, 0.1), -0.2, 0.08, 0.17),
  );
  // 左口袋插著正在錄影的手機（紅燈閃）
  const phone = pivot('phone', 0.205, 0.2, 0.105); phone.rotation.set(0, 1.05, 0.12);
  bake(phone, box(0.06, 0.11, 0.014, 0x2a2a33, 0, 0, -0.004, { r: 0.01 }), sphere(0.009, 0x55555f, 0.014, 0.035, 0.005, NO));
  const rec = sphere(0.009, 0xff2a3a, -0.014, 0.038, 0.005, { outline: false, emissive: 0xff2030, emissiveIntensity: 1.5 });
  phone.add(rec); body.add(phone);

  for (const [a, f, s] of [[armL, forearmL, 1], [armR, forearmR, -1]]) {
    bake(a,
      scl(sphere(0.095, CARD, 0, -0.01, 0), 1, 1.05, 1),
      limb(0.072, [0, -0.02, 0], [0, -0.2, 0], CARD),
    );
    bake(f,
      limb(0.068, [0, 0, 0], [0, -0.13, 0], CARD),
      cyl(0.08, 0.075, 0.05, CARD_DK, 0, -0.165, 0),
      [0, 1].map(i => cyl(0.081, 0.081, 0.006, CARD, 0, -0.152 - i * 0.025, 0, NO)),
      cyl(0.038, 0.04, 0.05, SKIN, 0, -0.2, 0),
      s > 0 && rot(torus(0.042, 0.009, GOLD, 0, -0.205, 0, NO), Math.PI / 2),
      mitten(SKIN, s, 0, -0.255, 0.01, 1.1),
    );
  }
  forearmL.rotation.x = -0.55;
  forearmR.rotation.x = -0.42;
  // 左手：40oz 不鏽鋼保溫杯（武器）
  const cupTube = new THREE.TorusGeometry(0.06, 0.015, 6, 12, Math.PI);
  const cup = pivot('weapon', 0, -0.27, 0.085);
  bake(cup,
    lathe([[0.066, -0.18], [0.07, -0.1], [0.086, 0.05], [0.1, 0.17]], CUP),
    cyl(0.066, 0.066, 0.02, 0xd4d8de, 0, -0.185, 0),
    cyl(0.089, 0.089, 0.03, WHITE, 0, 0.05, 0, NO),
    cyl(0.104, 0.104, 0.05, 0xeef0f2, 0, 0.19, 0),
    cyl(0.07, 0.07, 0.02, 0xd4d8de, 0, 0.222, 0, NO),
    rot(cyl(0.013, 0.013, 0.24, 0xffe14d, 0.03, 0.3, -0.01), 0, 0, -0.2),
    rot(at(part(cupTube, CUP_DK), 0.09, 0.03, 0), 0, 0, -Math.PI / 2),
  );
  forearmL.add(cup);
  // 右手：過期三年的折價券法典（有書籤和綁帶）
  const book = pivot('book', -0.01, -0.29, 0.07); book.rotation.set(-0.2, -0.4, 0);
  bake(book,
    box(0.16, 0.21, 0.05, 0x2fb36b, 0, 0, 0, { r: 0.012 }),
    box(0.15, 0.2, 0.046, 0xf3ecd6, 0.008, 0, 0, NO),
    box(0.1, 0.06, 0.012, 0xffd23f, 0, 0.04, 0.026, NO),
    box(0.165, 0.014, 0.054, CUP, 0, -0.05, 0, NO),
    rot(box(0.12, 0.06, 0.012, 0xff5d8f, 0.02, 0.12, 0.005), 0, 0, -0.35),
    rot(box(0.12, 0.06, 0.012, 0x7fd3ff, -0.03, 0.125, -0.008), 0, 0, 0.3),
  );
  forearmR.add(book);

  // 頭：從墨鏡上方瞪人的眼睛、一高一低的眉毛、下彎紅唇
  const HC = 0.24, HR = 0.235, eyY = 0.292;
  const ez = fz(HR, HC, 0.082, eyY);
  const gy = 0.208;
  bake(head,
    sphere(HR, SKIN, 0, HC, 0),
    [1, -1].map(s => [
      scl(sphere(0.05, SHADOW, s * 0.082, eyY + 0.022, ez + 0.003, NO), 1.08, 0.5, 0.55),
      rot(capsule(0.0065, 0.08, INK, s * 0.082, eyY + 0.008, ez + 0.026, NO), 0, 0, Math.PI / 2 - s * 0.12),
      rot(cone(0.008, 0.03, INK, s * 0.132, eyY + 0.022, ez + 0.0, NO), 0, 0, -s * 1.0),
      scl(sphere(0.042, BLUSH, s * 0.135, 0.16, fz(HR, HC, 0.135, 0.16) - 0.006, NO), 1, 0.6, 0.35),
      // 墨鏡（貓眼、滑到鼻樑上）
      rot(box(0.135, 0.085, 0.03, LENS, s * 0.086, gy, fz(HR, HC, 0.086, gy) + 0.016, { r: 0.03 }), 0, s * 0.25, s * 0.14),
      rot(box(0.055, 0.014, 0.005, WHITE, s * 0.086 + 0.015, gy + 0.012, fz(HR, HC, 0.086, gy) + 0.033, NO), 0, s * 0.25, 0.6),
      rot(box(0.008, 0.01, 0.2, FRAME, s * 0.212, gy + 0.012, 0.06, NO), 0, -s * 0.12, 0),
      rot(torus(0.028, 0.0065, GOLD, s * 0.233, 0.13, 0.0, NO), 0, Math.PI / 2, 0),
    ]),
    rot(box(0.1, 0.024, 0.02, BROW, 0.09, 0.368, fz(HR, HC, 0.09, 0.368) + 0.006, NO), 0, 0, 0.42),
    rot(box(0.1, 0.026, 0.02, BROW, -0.088, 0.345, fz(HR, HC, 0.088, 0.345) + 0.008, NO), 0, 0, -0.28),
    box(0.05, 0.02, 0.02, FRAME, 0, gy + 0.025, fz(HR, HC, 0, gy) + 0.02, NO),
    scl(sphere(0.03, SKIN_DK, 0, 0.185, fz(HR, HC, 0, 0.185) + 0.01), 1, 1.15, 1),
    // 頭髮：頭頂髮量、左側短、後腦勺經理剪刺刺短髮
    scl(sphere(0.27, HAIR, 0, 0.32, -0.085), 1.06, 0.88, 1.0),
    box(0.08, 0.2, 0.24, HAIR, 0.235, 0.3, -0.02, { r: 0.04 }),
    rot(capsule(0.016, 0.16, LOW, 0.16, 0.44, -0.06, NO), 0.5, 0, 0.9),
    [[0, 0.4, 0, HAIR], [0.11, 0.37, -0.35, LOW], [-0.11, 0.37, 0.35, HAIR], [0.06, 0.25, -0.2, HAIR], [-0.07, 0.25, 0.25, LOW], [0, 0.48, 0.05, HAIR]]
      .map(([x, y, rz, c]) => rot(cone(0.085, 0.24, c, x * 1.3, y, -0.33 + (y - 0.3) * 0.35), -1.05 - (y - 0.3) * 1.2, 0, rz)),
  );
  // 斜瀏海與右側長髮片（會晃）
  const bang = pivot('bang', 0.0, 0.47, 0.05);
  bake(bang,
    rot(scl(sphere(0.16, HAIR, 0.06, -0.02, 0.05), 1.45, 0.6, 0.9), 0.25, 0, -0.32),
  );
  const lock = pivot('lock', -0.24, 0.36, 0.03);
  bake(lock,
    rot(box(0.1, 0.4, 0.3, HAIR, 0, -0.19, 0, { r: 0.05 }), 0.3, 0, 0.06),
    rot(box(0.035, 0.3, 0.06, LOW, -0.05, -0.16, 0.03, NO), 0.3, 0, 0.06),
  );
  head.add(bang, lock);
  const eyes = [1, -1].map(s => eye(s * 0.082, eyY, ez - 0.01, 0.046, IRIS, { ly: -0.12, lx: -0.12 }));
  head.add(...eyes);
  const mouth = pivot('mouth', 0, 0.085, fz(HR, HC, 0, 0.085) + 0.004);
  bake(mouth,
    at(part(new THREE.TorusGeometry(0.046, 0.016, 6, 12, Math.PI), LIPS, NO), 0, -0.02, 0),
    at(part(new THREE.TorusGeometry(0.046, 0.005, 4, 12, Math.PI), INK, NO), 0, -0.024, 0.012),
  );
  head.add(mouth);
  return finish(R, cup, {
    eyes, mouth, extra: [bang, lock],
    anim(t) { rec.visible = (t % 1.2) < 0.7; },
  });
}

// ═════════════════════════════════════════════════════════
// 3) 佛州老戴：敞開條紋浴袍、啤酒肚、飛行員墨鏡、鯔魚頭、洞洞鞋、懷裡的小鱷魚
// ═════════════════════════════════════════════════════════
function buildDale() {
  const SKIN = 0xf2a27a, SKIN_DK = 0xd9805e, NOSE = 0xec6f58, BURN = 0xf2786a, BOX = 0xe63946, MUL = 0xb57a3c, MUL_DK = 0x7a4a1e, CHEST = 0x8a5a2e;
  const CLOG = 0x8bff3a, CLOG_DK = 0x4fc71c, ROBE_DK = 0x1f8f55, GATOR = 0x4e8f3a, GATOR_DK = 0x356a2a, GATOR_BELLY = 0xc9d97a;
  const MON = 0x23232b, IRIS = 0x4a86d8;
  const R = rig({ hipY: 0.6, hipX: 0.12, shX: 0.36, shY: 0.6, neckY: 0.72, neckZ: 0.03, elbow: 0.25 });
  const { body, armL, armR, head, forearmL, forearmR } = R;
  const SM = { mat: stripeMat() };

  // 腿：四角褲管、毛腿、洞洞鞋（後跟帶撥下來：運動模式）、右腳踝電子腳鐐
  for (const [leg, s] of [[R.legL, 1], [R.legR, -1]]) {
    const holes = [];
    for (const [x, z] of [[-0.035, 0.07], [0, 0.07], [0.035, 0.07], [-0.03, 0.125], [0.03, 0.125]]) holes.push(cyl(0.012, 0.012, 0.01, CLOG_DK, x, 0.126, z, NO));
    bake(leg,
      cyl(0.105, 0.11, 0.13, BOX, 0, -0.07, 0),
      sphere(0.02, WHITE, s * 0.07, -0.09, 0.083, NO),
      sphere(0.02, WHITE, -s * 0.03, -0.05, 0.105, NO),
      limb(0.066, [0, -0.1, 0], [0, -0.5, 0], SKIN),
      scl(sphere(0.07, SKIN, 0, -0.3, 0.012), 1, 0.9, 1),
      [0, 1, 2].map(i => rot(capsule(0.004, 0.022, CHEST, (i - 1) * 0.025, -0.38 - i * 0.03, 0.064, NO), 0, 0, 0.3)),
      at(group(
        box(0.18, 0.12, 0.31, CLOG, 0, 0.066, 0.05, { r: 0.04 }),
        box(0.19, 0.03, 0.32, CLOG_DK, 0, 0.015, 0.05, { r: 0.012 }),
        ...holes,
        rot(box(0.17, 0.03, 0.06, CLOG_DK, 0, 0.035, -0.135), 0.7, 0, 0),
        sphere(0.016, 0xb0b0b0, s * 0.09, 0.075, -0.06, NO),
        sphere(0.022, s > 0 ? 0xffd23f : 0xff7ab8, s * 0.092, 0.08, 0.1, NO),
      ), 0, -0.6, 0),
    );
  }
  const led = sphere(0.01, 0x44ff66, 0, 0.02, 0.112, { outline: false, emissive: 0x22ff44, emissiveIntensity: 1.5 });
  const ankle = pivot('monitor', 0, -0.46, 0);
  bake(ankle, cyl(0.072, 0.072, 0.035, MON, 0, 0, 0), box(0.075, 0.065, 0.05, MON, 0, 0.0, 0.085, { r: 0.015 }));
  ankle.add(led); R.legR.add(ankle);

  // 浴袍：前方敞開的部分圓柱（雙面條紋材質）
  const robe = part(new THREE.CylinderGeometry(0.31, 0.38, 0.82, 18, 1, true, 0.95, Math.PI * 2 - 1.9), null, SM);
  robe.position.y = 0.3; robe.scale.z = 0.9;
  const chest = [[-0.05, 0.6], [0.04, 0.62], [0.0, 0.57], [-0.1, 0.55], [0.09, 0.56], [0.0, 0.66]];
  bake(body,
    scl(cyl(0.26, 0.25, 0.24, BOX, 0, 0.0, 0.02), 1, 1, 0.9),
    scl(cyl(0.263, 0.263, 0.04, WHITE, 0, 0.1, 0.02), 1, 1, 0.9),
    [[0.12, -0.04], [-0.1, 0.05], [0.2, 0.03], [-0.19, -0.06]].map(([x, y]) => sphere(0.026, WHITE, x, y, 0.02 + Math.sqrt(0.0625 - x * x) * 0.9, NO)),
    cyl(0.24, 0.27, 0.4, SKIN, 0, 0.44, 0),
    scl(sphere(0.3, SKIN, 0, 0.3, 0.09), 1, 0.95, 0.95),
    [1, -1].map(s => scl(sphere(0.11, SKIN, s * 0.11, 0.56, 0.2), 1.1, 0.8, 0.6)),
    scl(sphere(0.022, 0x8a4a3a, 0, 0.26, 0.375, NO), 1, 1.3, 0.5),
    limb(0.006, [0, 0.3, 0.37], [0, 0.4, 0.345], CHEST, NO),
    chest.map(([x, y]) => scl(sphere(0.022, CHEST, x, y, 0.262, NO), 1, 1, 0.4)),
    robe,
    // 披肩領（前緣加厚）＋後領
    [1, -1].map(s => [
      limb(0.045, [s * 0.17, 0.72, 0.11], [s * 0.29, 0.28, 0.2], ROBE_DK),
      limb(0.036, [s * 0.29, 0.28, 0.2], [s * 0.31, -0.08, 0.2], ROBE_DK),
    ]),
    rot(at(part(new THREE.TorusGeometry(0.19, 0.05, 8, 14, Math.PI), ROBE_DK), 0, 0.72, 0.0), -Math.PI / 2 - 0.25, 0, 0),
    // 鯊魚牙項鍊
    rot(at(part(new THREE.TorusGeometry(0.13, 0.006, 4, 20), 0x5a3a20, NO), 0, 0.68, 0.07), Math.PI / 2 - 0.55, 0, 0),
    rot(cone(0.022, 0.07, WHITE, 0, 0.585, 0.262), Math.PI, 0, 0),
    cyl(0.1, 0.12, 0.12, SKIN, 0, 0.72, 0.01),
  );
  // 浴袍腰帶兩端（會晃）
  const sashes = [1, -1].map(s => {
    const p = pivot('sash', s * 0.33, 0.12, 0.12);
    bake(p, limb(0.026, [0, 0, 0], [s * 0.02, -0.28, 0.02], ROBE_DK), sphere(0.035, 0xfff6dc, s * 0.02, -0.31, 0.02));
    body.add(p);
    return p;
  });
  // 浴袍右前口袋＋插著的走私煙火
  const pocket = pivot('pocket', -0.3, 0.12, 0.2); pocket.rotation.y = -0.85;
  bake(pocket,
    box(0.16, 0.13, 0.05, ROBE_DK, 0, 0, 0, { r: 0.02 }),
    [[-0.035, 0xff3b3b, 0xffd23f, -0.22], [0.04, 0x4af0ff, 0xff5d8f, 0.2]].map(([x, c1, c2, rz]) => rot(at(group(
      cyl(0.026, 0.026, 0.26, c1, 0, 0.13, 0),
      cyl(0.027, 0.027, 0.03, WHITE, 0, 0.18, 0, NO),
      cone(0.04, 0.08, c2, 0, 0.3, 0),
      limb(0.004, [0, 0.34, 0], [0.02, 0.38, 0], 0x333333, NO),
    ), x, 0.02, 0), 0, 0, rz)),
  );
  body.add(pocket);

  // 小鱷魚「小乖」趴在肚子上（尾巴會甩）
  const gator = pivot('gator', 0.0, 0.6, 0.27); gator.rotation.set(0, -0.45, 0.12);
  bake(gator,
    rot(capsule(0.075, 0.22, GATOR, 0, 0, 0), 0, 0, Math.PI / 2),
    rot(scl(capsule(0.06, 0.2, GATOR_BELLY, 0, -0.03, 0, NO), 1, 1, 0.9), 0, 0, Math.PI / 2),
    [0, 1, 2, 3, 4].map(i => cone(0.02, 0.04, GATOR_DK, -0.13 + i * 0.065, 0.075, 0, NO)),
    box(0.14, 0.09, 0.14, GATOR, 0.2, 0.01, 0, { r: 0.035 }),
    box(0.17, 0.05, 0.11, GATOR, 0.31, -0.005, 0, { r: 0.022 }),
    box(0.15, 0.025, 0.095, GATOR_BELLY, 0.31, -0.038, 0, { r: 0.01 }),
    [1, -1].map(s => [
      [0, 1, 2, 3].map(i => rot(cone(0.008, 0.022, WHITE, 0.26 + i * 0.033, -0.026, s * 0.05, NO), Math.PI, 0, 0)),
      sphere(0.03, GATOR, 0.2, 0.06, s * 0.04),
      sphere(0.021, 0xffe14d, 0.21, 0.075, s * 0.045, NO),
      box(0.006, 0.026, 0.01, INK, 0.218, 0.082, s * 0.055, NO),
      sphere(0.009, INK, 0.39, 0.02, s * 0.02, NO),
      [-1, 1].map(e => rot(capsule(0.022, 0.05, GATOR, e * 0.08, -0.05, s * 0.075), s * 0.6, 0, 0)),
    ]),
  );
  const gTail = pivot('tail', -0.14, 0, 0);
  bake(gTail,
    rot(cone(0.065, 0.28, GATOR, -0.13, 0, 0), 0, 0, Math.PI / 2),
    [0, 1, 2].map(i => cone(0.016, 0.03, GATOR_DK, -0.05 - i * 0.06, 0.05 - i * 0.012, 0, NO)),
  );
  gator.add(gTail);
  body.add(gator);

  // 手臂：條紋喇叭袖、曬傷前臂、愛心刺青
  for (const [a, f, s] of [[armL, forearmL, 1], [armR, forearmR, -1]]) {
    bake(a, sphere(0.1, 0, 0, 0, 0, SM), tube(0.095, 0.11, [0, 0, 0], [0, -0.26, 0], 0, SM));
    bake(f,
      tube(0.108, 0.125, [0, -0.01, 0], [0, -0.1, 0], 0, SM),
      cyl(0.128, 0.128, 0.022, ROBE_DK, 0, -0.1, 0, NO),
      limb(0.056, [0, -0.06, 0], [0, -0.2, 0], SKIN),
      s < 0 && [
        scl(sphere(0.016, 0xd8213f, 0.011, -0.15, 0.055, NO), 1, 1, 0.4),
        scl(sphere(0.016, 0xd8213f, -0.011, -0.15, 0.055, NO), 1, 1, 0.4),
        rot(scl(cone(0.02, 0.026, 0xd8213f, 0, -0.168, 0.054, NO), 1, 1, 0.4), Math.PI, 0, 0),
        box(0.06, 0.012, 0.006, 0x2f6fd0, 0, -0.15, 0.06, NO),
      ],
      mitten(SKIN, s, 0, -0.27, 0.01, 1.15),
    );
  }
  forearmL.rotation.x = -0.7;
  forearmR.rotation.x = -0.18;
  // 左手：泡棉杯套裝的啤酒
  const can = pivot('can', 0, -0.28, 0.075);
  bake(can,
    cyl(0.058, 0.058, 0.1, 0xff7ab8, 0, 0, 0),
    cyl(0.05, 0.05, 0.045, 0xdfe3ea, 0, 0.07, 0),
    cyl(0.044, 0.05, 0.012, 0xc4c8d0, 0, 0.098, 0, NO),
    box(0.018, 0.004, 0.012, 0x9aa0aa, 0.01, 0.105, 0, NO),
    box(0.06, 0.03, 0.004, 0xffe14d, 0, 0.0, 0.058, NO),
  );
  forearmL.add(can);
  // 右手羅馬蠟燭煙火筒（武器）：平時斜指前下方，揮臂時指向前上方；引信火花會閃
  const candle = pivot('weapon', 0, -0.28, 0.03);
  candle.quaternion.setFromUnitVectors(V(0, 1, 0), V(0, -0.7, 0.7).normalize());
  bake(candle,
    cyl(0.042, 0.042, 0.66, 0xff3b3b, 0, 0.2, 0),
    [0, 1, 2, 3, 4].map(i => rot(cyl(0.0435, 0.0435, 0.025, WHITE, 0, -0.06 + i * 0.12, 0, NO), 0.3, 0, 0)),
    cyl(0.046, 0.046, 0.04, 0xffd23f, 0, 0.36, 0),
    cyl(0.048, 0.048, 0.03, 0x1f6fd0, 0, 0.52, 0),
    limb(0.006, [0, 0.535, 0], [0.025, 0.58, 0.01], 0x333333, NO),
  );
  const spark = pivot('spark', 0.028, 0.59, 0.012);
  const SP = { outline: false, emissive: 0xffd23f, emissiveIntensity: 1.4 };
  bake(spark, sphere(0.024, 0xfff3a0, 0, 0, 0, SP), box(0.09, 0.012, 0.012, 0xfff3a0, 0, 0, 0, SP), box(0.012, 0.09, 0.012, 0xfff3a0, 0, 0, 0, SP), rot(box(0.07, 0.01, 0.01, 0xff9a3a, 0, 0, 0, SP), 0, 0, 0.785));
  candle.add(spark);
  forearmR.add(candle);

  // 頭：鯔魚頭（前短後長）、半透明飛行員墨鏡後面的瞇瞇眼、紅鼻頭、馬蹄鬍、金牙
  const HC = 0.26, HR = 0.255, eyY = 0.278;
  const gz = fz(HR, HC, 0.09, 0.28) + 0.008;
  const LT = { transparent: true, opacity: 0.5 };
  bake(head,
    sphere(HR, SKIN, 0, HC, 0),
    scl(sphere(0.268, MUL, 0, 0.37, -0.05), 1.0, 0.58, 1.0),
    box(0.42, 0.26, 0.16, MUL, 0, 0.25, -0.17, { r: 0.07 }),
    [1, -1].map(s => [
      scl(sphere(0.06, BURN, s * 0.255, 0.24, -0.01), 0.5, 1, 0.8),
      scl(sphere(0.05, MUL_DK, s * 0.23, 0.22, 0.07, NO), 0.4, 1.2, 0.75),
      scl(sphere(0.052, SKIN, s * 0.09, eyY + 0.028, fz(HR, HC, 0.09, eyY) + 0.002, NO), 1.1, 0.62, 0.55),
      scl(sphere(0.05, BURN, s * 0.15, 0.17, fz(HR, HC, 0.15, 0.17) - 0.006, NO), 1, 0.6, 0.35),
      rot(scl(sphere(0.074, 0x6a4a18, s * 0.09, 0.27, gz, LT), 1.15, 0.9, 0.35), 0, 0, -s * 0.2),
      rot(scl(torus(0.074, 0.011, GOLD, s * 0.09, 0.27, gz + 0.008, NO), 1.15, 0.9, 1), 0, 0, -s * 0.2),
      rot(box(0.05, 0.012, 0.004, WHITE, s * 0.09 + 0.025, 0.3, gz + 0.03, NO), 0, 0, 0.6),
      rot(box(0.01, 0.01, 0.2, GOLD, s * 0.235, 0.29, 0.08, NO), 0, -s * 0.15, 0),
      rot(capsule(0.03, 0.09, MUL_DK, s * 0.09, 0.375, fz(HR, HC, 0.09, 0.375), NO), 0, 0, Math.PI / 2 + s * 0.28),
      sphere(0.012, 0x8a3a2a, s * 0.022, 0.175, fz(HR, HC, 0, 0.2) + 0.05, NO),
      capsule(0.03, 0.07, MUL_DK, s * 0.118, 0.1, fz(HR, HC, 0.118, 0.1)),
    ]),
    box(0.06, 0.014, 0.014, GOLD, 0, 0.31, gz + 0.015, NO),
    sphere(0.058, NOSE, 0, 0.2, fz(HR, HC, 0, 0.2) + 0.015),
    rot(capsule(0.036, 0.19, MUL_DK, 0, 0.145, fz(HR, HC, 0, 0.145) + 0.01), 0, 0, Math.PI / 2),
  );
  // 後面的長髮（派對在後面，會甩）
  const mullet = pivot('mullet', 0, 0.16, -0.2);
  bake(mullet,
    box(0.38, 0.24, 0.1, MUL, 0, -0.1, -0.02, { r: 0.045 }),
    [-0.13, -0.065, 0, 0.065, 0.13].map((x, i) => rot(cone(0.045, 0.12, i % 2 ? MUL_DK : MUL, x, -0.26, -0.02), Math.PI, 0, x * 0.8)),
  );
  head.add(mullet);
  const eyes = [1, -1].map(s => eye(s * 0.09, eyY, fz(HR, HC, 0.09, eyY) - 0.014, 0.046, IRIS, { ly: -0.15 }));
  head.add(...eyes);
  const mouth = pivot('mouth', 0, 0.088, fz(HR, HC, 0, 0.088) - 0.002);
  bake(mouth,
    box(0.12, 0.05, 0.02, INK, 0, 0, 0, { r: 0.018, outline: false }),
    box(0.04, 0.02, 0.02, WHITE, -0.03, 0.01, 0.005, NO),
    box(0.025, 0.02, 0.02, GOLD, 0.008, 0.01, 0.005, NO),
    box(0.02, 0.02, 0.02, WHITE, 0.038, 0.01, 0.005, NO),
    rot(capsule(0.004, 0.09, 0xe8d4a0, 0.07, -0.005, 0.03, NO), 0.3, 0, 1.25),
  );
  head.add(mouth);
  return finish(R, candle, {
    eyes, mouth, extra: [mullet, gTail, ...sashes],
    anim(t) {
      const k = Math.abs(Math.sin(t * 23)) * 0.5 + Math.abs(Math.sin(t * 37)) * 0.5;
      spark.scale.setScalar(0.7 + k * 0.6); spark.rotation.z = t * 9;
      led.visible = (t % 1.6) < 0.18;
    },
  });
}

// ═════════════════════════════════════════════════════════
// 4) 多吉：慘白加密貨幣吸血鬼，黑帽 T＋吸血鬼立領、金鍊大幣、冷錢包匕首、駝背
// ═════════════════════════════════════════════════════════
function buildDoge() {
  const SKIN = 0xf3eff6, SKIN_DK = 0xd8cde2, BAG = 0xb9a2d6, HOOD = 0x1e1c26, HOOD2 = 0x2e2b3a, LAV = 0xb48cff, LINING = 0x8a1030;
  const HAIR = 0x2a1f3a, HAIR_HI = 0x5a4680, JEANS = 0x3b3f52, JEANS_HI = 0x5a5f78, IRIS = 0xe0263a, DEVICE = 0x30303c, STEEL = 0xd6dde6, SILVER = 0xc9ccd6;
  const lean = 0.16;
  const R = rig({ hipY: 0.8, hipX: 0.1, shX: 0.25, shY: 0.53, shZ: 0.085, neckY: 0.59, neckZ: 0.13, elbow: 0.26 });
  const { body, armL, armR, head, forearmL, forearmR } = R;

  // 腿：破膝窄管牛仔褲、反摺褲口、厚底球鞋
  for (const [leg, s] of [[R.legL, 1], [R.legR, -1]]) {
    bake(leg,
      limb(0.07, [0, -0.02, 0], [0, -0.62, 0], JEANS),
      limb(0.006, [s * 0.07, -0.04, 0], [s * 0.07, -0.6, 0], JEANS_HI, NO),
      scl(sphere(0.042, SKIN, 0, -0.34, 0.06, NO), 1.15, 0.75, 0.5),
      [0, 1, 2].map(i => box(0.07, 0.006, 0.01, 0xe8e8f0, 0, -0.325 - i * 0.015, 0.076, NO)),
      cyl(0.08, 0.078, 0.06, JEANS_HI, 0, -0.62, 0),
      at(sneaker(0.16, 0.31, 0.11, WHITE, LAV, HOOD2, 0x9b9aa8, 0.06), 0, -0.8, 0.05),
    );
  }

  // 上身包在傾斜的子群組裡（body 本身保持零旋轉）
  const slouch = pivot('slouch'); slouch.rotation.x = lean;
  const hodl = textPlane('HODL', 0.26, { color: '#b48cff', size: 64 });
  hodl.position.set(0, 0.3, -0.168); hodl.rotation.y = Math.PI;
  const collarGeo = (r0, r1) => new THREE.CylinderGeometry(r1, r0, 0.22, 16, 1, true, Math.PI - 1.35, 2.7);
  const links = [];
  for (let i = 0; i < 10; i++) { const a = -1.2 + i * (2.4 / 9); links.push(sphere(0.012, GOLD_DK, Math.sin(a) * 0.13, 0.46 - Math.cos(a) * 0.055, 0.085 + Math.cos(a) * 0.12, { seg: 6, outline: false })); }
  bake(slouch,
    scl(lathe([[0.235, -0.05], [0.235, 0.08], [0.22, 0.3], [0.21, 0.46], [0.17, 0.56], [0.09, 0.62]], HOOD), 1, 1, 0.75),
    scl(cyl(0.24, 0.24, 0.07, HOOD2, 0, -0.02, 0), 1, 1, 0.76),
    box(0.3, 0.14, 0.04, HOOD2, 0, 0.12, 0.165, { r: 0.02 }),
    [1, -1].map(s => rot(box(0.012, 0.13, 0.044, HOOD, s * 0.12, 0.12, 0.168, NO), 0, 0, s * 0.35)),
    hodl,
    // 吸血鬼立領（外黑內酒紅）
    at(part(collarGeo(0.15, 0.24), HOOD, DS()), 0, 0.66, -0.03),
    at(part(collarGeo(0.142, 0.232), LINING, { ...DS(), outline: false }), 0, 0.66, -0.03),
    rot(torus(0.11, 0.04, LAV, 0, 0.59, 0.0), Math.PI / 2),
    [1, -1].map(s => [
      limb(0.014, [s * 0.055, 0.55, 0.15], [s * 0.06, 0.39 + (s > 0 ? 0 : 0.02), 0.17], LAV, NO),
      capsule(0.017, 0.02, SILVER, s * 0.06, 0.375 + (s > 0 ? 0 : 0.02), 0.17, NO),
    ]),
    rot(torus(0.13, 0.014, GOLD, 0, 0.46, 0.085, NO), 1.15),
    links,
  );
  // 胸前大幣（不合併：文字貼片要留在自己的材質上）
  const coin = pivot('coin', 0, 0.34, 0.2); coin.rotation.x = -0.1;
  bake(coin,
    rot(cyl(0.08, 0.08, 0.026, GOLD, 0, 0, 0), Math.PI / 2),
    torus(0.058, 0.009, GOLD_DK, 0, 0, 0.014, NO),
    at(textPlane('$', 0.075, { color: '#9a6206', size: 64 }), 0, 0, 0.015),
  );
  slouch.add(coin);
  body.add(slouch);
  bake(body, cyl(0.06, 0.066, 0.12, SKIN, 0, 0.6, 0.11));
  // 錢包鍊（會晃）
  const chain = pivot('chain', 0.17, 0.0, 0.1);
  bake(chain,
    rot(part(new THREE.TorusGeometry(0.11, 0.008, 4, 16, Math.PI), SILVER, NO), 0, Math.PI / 2, Math.PI),
    [0, 1, 2, 3, 4].map(i => { const a = Math.PI * (0.1 + i * 0.2); return sphere(0.012, SILVER, 0.0, -Math.sin(a) * 0.11, Math.cos(a) * 0.11, { seg: 6, outline: false }); }),
  );
  chain.position.set(0.19, 0.0, -0.01);
  body.add(chain);

  for (const [a, f, s] of [[armL, forearmL, 1], [armR, forearmR, -1]]) {
    bake(a, sphere(0.088, HOOD, 0, -0.01, 0), limb(0.07, [0, 0, 0], [0, -0.24, 0], HOOD));
    bake(f,
      limb(0.066, [0, 0, 0], [0, -0.18, 0], HOOD),
      cyl(0.075, 0.07, 0.06, LAV, 0, -0.22, 0),
      [0, 1].map(i => cyl(0.0755, 0.0755, 0.006, HOOD2, 0, -0.205 - i * 0.025, 0, NO)),
      mitten(SKIN, s, 0, -0.3, 0.01, 1.0),
      rot(torus(0.017, 0.005, SILVER, -s * 0.008, -0.33, 0.04, NO), 0.2, 0, 0),
    );
  }
  forearmL.rotation.x = -1.05;
  forearmR.rotation.x = -0.25;
  // 右手：冷錢包匕首（握柄就是一台帶螢幕的硬體錢包）
  const dagger = pivot('weapon', 0, -0.3, 0.03);
  dagger.quaternion.setFromUnitVectors(V(0, 1, 0), V(0, -0.72, 0.7).normalize());
  bake(dagger,
    box(0.07, 0.24, 0.04, DEVICE, 0, -0.06, 0, { r: 0.014 }),
    [1, -1].map(s => cyl(0.009, 0.009, 0.01, SILVER, s * 0.02, -0.03, 0.021, NO)).map(m => rot(m, Math.PI / 2)),
    rot(torus(0.016, 0.005, SILVER, 0, -0.2, 0, NO), 0, Math.PI / 2, 0),
    box(0.15, 0.03, 0.06, GOLD, 0, 0.085, 0, { r: 0.012 }),
    [1, -1].map(s => sphere(0.016, LAV, s * 0.08, 0.085, 0, NO)),
    scl(cone(0.05, 0.4, STEEL, 0, 0.3, 0, { seg: 4 }), 1, 1, 0.32),
    box(0.006, 0.24, 0.026, 0x8f9aae, 0, 0.23, 0, NO),
    box(0.05, 0.035, 0.05, LAV, 0, -0.19, 0, { r: 0.012 }),
  );
  const dScreen = box(0.046, 0.08, 0.006, 0x7dffb0, 0, -0.08, 0.022, { outline: false, emissive: 0x3dff90, emissiveIntensity: 0.9 });
  dagger.add(dScreen);
  forearmR.add(dagger);
  // 左手：舉在胸前的手機，螢幕上 K 線一路往下（價格點會沿著跌）
  const phone = pivot('phone', 0, -0.3, 0.07); phone.rotation.x = -1.45;
  bake(phone,
    box(0.085, 0.16, 0.018, DEVICE, 0, 0, 0, { r: 0.012 }),
    box(0.07, 0.135, 0.004, 0x1a0a14, 0, 0, 0.0095, NO),
    box(0.03, 0.03, 0.006, 0x50505e, -0.02, 0.055, -0.011, NO),
    sphere(0.016, LAV, 0.012, -0.03, -0.01, { outline: false, seg: 8 }),
  );
  const chart = pivot('chart', 0, 0, 0.012);
  const CH = { outline: false, emissive: 0xff2a50, emissiveIntensity: 0.9 };
  const pts = [[-0.028, 0.05], [-0.014, 0.03], [-0.004, 0.038], [0.008, 0.0], [0.016, 0.01], [0.028, -0.05]];
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push(limb(0.0035, [pts[i][0], pts[i][1], 0], [pts[i + 1][0], pts[i + 1][1], 0], 0xff4d6d, CH));
  bake(chart, segs, box(0.06, 0.002, 0.002, 0x66334a, 0, -0.058, 0, NO));
  const dot = sphere(0.006, 0xffffff, 0, 0, 0.002, { outline: false, emissive: 0xffffff, emissiveIntensity: 1 });
  chart.add(dot);
  phone.add(chart);
  forearmL.add(phone);

  // 頭：慘白、紅眼＋黑眼圈、尖耳、獠牙、側掃瀏海
  const HC = 0.25, HR = 0.235, eyY = 0.258;
  const ez = fz(HR, HC, 0.085, eyY);
  bake(head,
    scl(sphere(HR, SKIN, 0, HC, 0), 0.95, 1.05, 1),
    scl(sphere(0.25, HAIR, 0, 0.33, -0.045), 1.0, 0.78, 1.05),
    rot(scl(cone(0.055, 0.11, HAIR, 0, 0.405, fz(HR, HC, 0, 0.405) - 0.01), 1, 1, 0.5), Math.PI, 0, 0),
    [1, -1].map(s => [
      rot(cone(0.045, 0.15, SKIN, s * 0.235, 0.27, -0.02), 0, 0, -s * 0.95),
      scl(sphere(0.07, BAG, s * 0.085, eyY - 0.012, ez - 0.016, NO), 1.12, 0.98, 0.35),
      scl(sphere(0.052, SKIN, s * 0.085, eyY + 0.03, ez + 0.002, NO), 1.12, 0.55, 0.55),
      rot(capsule(0.006, 0.075, INK, s * 0.085, eyY + 0.006, ez + 0.022, NO), 0, 0, Math.PI / 2 + s * 0.1),
      scl(sphere(0.03, SKIN_DK, s * 0.135, 0.15, fz(HR, HC, 0.135, 0.15) - 0.01, NO), 0.7, 1.4, 0.3),
      scl(sphere(0.022, WHITE, s * 0.222, 0.215, 0.03), 1, 1, 1),
      capsule(0.008, 0.03, WHITE, s * 0.222, 0.18, 0.04, NO),
    ]),
    rot(torus(0.018, 0.005, SILVER, 0.318, 0.36, -0.02, NO), 0, Math.PI / 2, 0),
    rot(box(0.1, 0.02, 0.02, HAIR, 0.09, 0.352, fz(HR, HC, 0.09, 0.352) + 0.004, NO), 0, 0, 0.3),
    rot(box(0.1, 0.02, 0.02, HAIR, -0.09, 0.33, fz(HR, HC, 0.09, 0.33) + 0.004, NO), 0, 0, 0.05),
    rot(cone(0.022, 0.07, SKIN_DK, 0, 0.19, fz(HR, HC, 0, 0.19) + 0.012), Math.PI / 2 + 0.35, 0, 0),
  );
  // 側掃瀏海與後腦的翹毛（會晃）
  const bang = pivot('bang', 0.03, 0.45, 0.07);
  bake(bang,
    rot(scl(sphere(0.13, HAIR, 0, 0, 0), 1.45, 0.62, 1.1), -0.35, 0, -0.12),
    rot(capsule(0.012, 0.13, HAIR_HI, 0.03, 0.03, 0.09, NO), 0.4, 0, 1.2),
    rot(cone(0.05, 0.16, HAIR, -0.14, -0.08, 0.1), 0.2, 0, 2.5),
  );
  const spikes = pivot('spikes', 0, 0.44, -0.16);
  bake(spikes, [[-0.08, 0.5], [0.02, 0.0], [0.1, -0.5]].map(([x, rz]) => rot(cone(0.05, 0.15, HAIR, x, 0.04, -0.03), -1.0, 0, rz)));
  head.add(bang, spikes);
  const eyes = [1, -1].map(s => eye(s * 0.085, eyY, ez - 0.012, 0.047, IRIS, { lx: 0.15, ly: -0.05 }));
  head.add(...eyes);
  const mouth = pivot('mouth', 0.012, 0.118, fz(HR, HC, 0.012, 0.118) + 0.002);
  bake(mouth,
    rot(box(0.11, 0.022, 0.02, INK, 0, 0, 0, NO), 0, 0, 0.16),
    rot(cone(0.016, 0.05, WHITE, 0.028, -0.02, 0.006, NO), Math.PI, 0, 0),
    rot(cone(0.016, 0.05, WHITE, -0.024, -0.026, 0.006, NO), Math.PI, 0, 0),
  );
  head.add(mouth);
  return finish(R, dagger, {
    eyes, mouth, extra: [bang, spikes, chain],
    anim(t) {
      const k = (t * 0.45) % 1, i = Math.min(pts.length - 2, Math.floor(k * (pts.length - 1))), f = k * (pts.length - 1) - i;
      dot.position.set(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, 0.003);
      dScreen.visible = (t % 2.2) > 0.12;
    },
  });
}

export const HERO_BUILDERS = {
  chad: buildChad,
  karen: buildKaren,
  dale: buildDale,
  doge: buildDoge,
};
