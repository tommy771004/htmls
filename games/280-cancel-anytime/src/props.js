// 道具與地表貼花：buildProp(type, w, d) / buildSurface(type)。
// 原點＝佔地範圍（w×d 格，每格 2 m）的中心、地面（所站格子的頂面）為 y=0。
// 會動的物件在 g.userData.anim = (t) => {} 裡做程序動畫（view 每幀以秒數呼叫）。
// 注意：kit 的 toon()/flat() 依參數共用材質，會改材質屬性的動畫一律用本檔自建的私有材質，或改 visible / transform。
/* global THREE */
import { toon, flat, part, box, sphere, cyl, cone, capsule, torus, group, textPlane, textTexture, gradientMap } from './kit.js';
import { instOutline } from './scenery.js';

// ── 小工具 ───────────────────────────────────────────
const R = (m, x = 0, y = 0, z = 0) => { m.rotation.set(x, y, z); return m; };
const S = (m, x = 1, y = x, z = x) => { m.scale.set(x, y, z); return m; };
const P = (m, x, y, z) => { m.position.set(x, y, z); return m; };
// 卡通火舌：圓底尖頂的水滴形車削體
function flameGeo(r, h) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const s = i / 10; pts.push(new THREE.Vector2(r * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.15)), 0.7) * (1 - s * 0.55) + 0.001, s * h)); }
  pts[pts.length - 1].x = 0.001;
  return new THREE.LatheGeometry(pts, 8);
}
const NO = { outline: false };
const HALF = Math.PI / 2;

function label(text, w, o, x, y, z, ry = 0, rx = 0) {
  const m = textPlane(text, w, o);
  m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
  return m;
}
// 合併多個已變換的幾何（只保留 position / normal）
function merge(geos) {
  const list = geos.map(g => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
// 從 yTop 往下垂的鐵鍊（單一網格）
function chain(x, yTop, z, len, color = 0x5d636e, s = 1) {
  const step = 0.27 * s, n = Math.max(1, Math.round(len / step)), geos = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.TorusGeometry(0.11 * s, 0.035 * s, 5, 10);
    g.scale(1, 1.5, 1);
    if (i % 2) g.rotateY(HALF);
    g.translate(0, -i * step - 0.14 * s, 0);
    geos.push(g);
  }
  const m = part(merge(geos), color);
  m.position.set(x, yTop, z);
  return m;
}
// a→b 的斜拉鐵鍊
function chainBetween(a, b, color, s = 1) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = chain(0, 0, 0, A.distanceTo(B), color, s);
  m.position.copy(A);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), B.sub(A).normalize());
  return m;
}
// 兩點間的圓管（繩子、電纜、支架）
function rod(a, b, r, color, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = cyl(r, r, len, color, 0, 0, 0, { seg: o.seg || 8, ...o });
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
  return m;
}
function tube(points, r, color, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return part(new THREE.TubeGeometry(curve, o.seg || 24, r, o.rseg || 6, false), color, o);
}
// 簡易隨機（每個實例略有差異）
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ── 道具 ─────────────────────────────────────────────
const PB = {
  // 外星自動點餐機：薄荷綠機身、桃紅螢幕罩、頭頂觸角與獨眼
  kiosk() {
    const g = group(
      box(1.0, 0.16, 0.8, 0x2b2540, 0, 0.08, 0),
      box(0.62, 1.0, 0.46, 0x39d6a8, 0, 0.66, 0),
      box(0.7, 0.08, 0.5, 0xffd23f, 0, 0.62, 0.02),
    );
    const head = group(
      box(1.05, 0.78, 0.3, 0xff4f9e, 0, 0, 0),
      box(0.86, 0.6, 0.04, 0x1a1030, 0, 0, 0.15, { mat: flat(0x1a1030) }),
      label('ORDER\n HERE ▸', 0.7, { color: '#b6ff3d', size: 56 }, 0, 0.03, 0.18),
      cyl(0.04, 0.04, 0.5, 0x2b2540, -0.32, 0.6, 0, { seg: 6 }), sphere(0.11, 0xc6ff3d, -0.32, 0.88, 0),
      cyl(0.04, 0.04, 0.38, 0x2b2540, 0.34, 0.54, 0, { seg: 6 }), sphere(0.09, 0xc6ff3d, 0.34, 0.76, 0),
      sphere(0.2, 0xffffff, 0, 0.5, 0.02), sphere(0.1, 0x111111, 0, 0.53, 0.15, NO),
    );
    head.position.set(0, 1.5, 0.04); head.rotation.x = -0.22;
    const slot = box(0.3, 0.1, 0.12, 0xffd23f, 0.12, 0.98, 0.27);
    // 吐出長長收據（從出紙口往下長，撕掉再來）
    const rc = new THREE.Group(); rc.position.set(0.12, 0.96, 0.33); rc.rotation.x = 0.25;
    const paper = box(0.16, 0.5, 0.015, 0xfffbe8, 0, -0.25, 0, { ...NO, r: 0.005 });
    for (let i = 0; i < 4; i++) paper.add(box(0.1 - (i % 2) * 0.03, 0.012, 0.004, 0x6a6a72, -0.01, 0.17 - i * 0.08, 0.01, NO));
    paper.add(label('TIP 25%', 0.12, { color: '#d0102a', size: 40 }, 0, -0.17, 0.01));
    rc.add(paper);
    // 讀卡機、按鍵、側面散熱孔、底座貼紙
    const pad = box(0.2, 0.14, 0.06, 0x2b2540, -0.17, 0.98, 0.25);
    const padLed = box(0.05, 0.03, 0.02, 0x3dff7a, -0.17, 1.03, 0.285, { mat: new THREE.MeshBasicMaterial({ color: 0x3dff7a }), outline: false });
    for (let i = 0; i < 3; i++) g.add(box(0.03, 0.4, 0.02, 0x2b8a6e, 0.315, 0.6, -0.12 + i * 0.08, NO));
    g.add(label('NO\nCASH', 0.24, { color: '#2b2540', size: 40 }, 0, 0.42, 0.235));
    g.add(head, slot, rc, pad, padLed);
    const eye = head.children[head.children.length - 1];
    const scr = head.children[1];
    scr.material = new THREE.MeshBasicMaterial({ color: 0x1a1030 });
    g.userData.anim = t => {
      eye.position.x = Math.sin(t * 0.9) * 0.07; head.children[4].position.y = 0.88 + Math.sin(t * 3) * 0.03;
      const k = (t * 0.25) % 1; rc.scale.y = 0.15 + Math.min(1, k * 1.3) * 0.85; rc.visible = k < 0.95;
      scr.material.color.setRGB(0.1 + (Math.sin(t * 40) > 0.95 ? 0.12 : 0), 0.06, 0.19);
      padLed.material.color.set(Math.floor(t * 2) % 2 ? 0x3dff7a : 0xff3a5a);
      head.rotation.z = Math.sin(t * 1.3) * 0.03;
    };
    return g;
  },

  // 塞滿衛生紙的購物車
  cart() {
    const g = group(
      box(1.0, 0.05, 0.62, 0x8b95a1, 0, 0.3, 0),
      box(1.05, 0.55, 0.7, 0xc8d0d8, 0, 0.72, 0),
      box(1.08, 0.06, 0.73, 0x8b95a1, 0, 0.99, 0),
      rod([-0.62, 0.95, -0.36], [-0.62, 0.95, 0.36], 0.05, 0xff7a1a),
      rod([-0.52, 0.48, -0.3], [-0.62, 0.95, -0.3], 0.025, 0x8b95a1),
      rod([-0.52, 0.48, 0.3], [-0.62, 0.95, 0.3], 0.025, 0x8b95a1),
    );
    for (const [x, z] of [[-0.42, -0.26], [-0.42, 0.26], [0.42, -0.26], [0.42, 0.26]]) {
      g.add(cyl(0.025, 0.025, 0.24, 0x8b95a1, x, 0.24, z, { seg: 6 }));
      g.add(R(cyl(0.08, 0.08, 0.05, 0x222222, x, 0.08, z, { seg: 10 }), HALF));
    }
    // 衛生紙堆（溢出車外）
    const rolls = [[-0.3, -0.16], [0, -0.16], [0.3, -0.16], [-0.3, 0.16], [0, 0.16], [0.3, 0.16], [-0.15, 0], [0.15, 0]];
    rolls.forEach(([x, z], i) => g.add(cyl(0.15, 0.15, 0.28, 0xffffff, x, i < 6 ? 1.15 : 1.43, z, { seg: 12 })));
    g.add(R(cyl(0.15, 0.15, 0.28, 0xffffff, 0.02, 1.68, 0.02, { seg: 12 }), HALF, 0, 0.3));
    g.add(box(0.5, 0.42, 0.34, 0x9ad7ff, 0.65, 0.3, 0.55, { r: 0.08 }), R(label('SUPER\nSOFT 48', 0.38, { color: '#0b3a6b', size: 48 }, 0.65, 0.33, 0.73), 0, 0));
    g.add(sphere(0.06, 0x2a6fd6, 0.72, 0.53, 0.55, { seg: 8 }));
    return g;
  },

  // 流動廁所：綠色小屋、月牙門、蒼蠅
  potty() {
    const g = group(
      box(1.15, 1.55, 1.1, 0x3fb24a, 0, 0.8, 0),
      box(1.28, 0.14, 1.24, 0xf2f2ea, 0, 1.62, 0),
      sphere(0.42, 0xf2f2ea, 0, 1.62, 0, { seg: 12 }),
      cyl(0.07, 0.07, 0.3, 0x7f8a96, 0.32, 1.82, -0.3, { seg: 8 }),
      R(cyl(0.12, 0.12, 0.04, 0xffd23f, -0.02, 1.2, 0.6, { seg: 14 }), HALF),
      R(cyl(0.12, 0.12, 0.05, 0x2e8f39, 0.05, 1.23, 0.61, { seg: 14, outline: false }), HALF),
      box(0.1, 0.2, 0.08, 0xd8d8d8, 0.33, 0.75, 0.62),
      box(0.36, 0.1, 0.02, 0xff2a3a, 0.2, 0.98, 0.61, { mat: flat(0xff2a3a), outline: false }),
      label('OCCUPIED', 0.34, { color: '#fff', size: 40 }, 0.2, 0.98, 0.625),
    );
    g.children[2].scale.y = 0.35;
    // 門（鉸鍊在左緣，會被裡面的人撞得喀喀響）
    const door = new THREE.Group(); door.position.set(-0.43, 0, 0.57);
    door.add(box(0.86, 1.3, 0.06, 0x2e8f39, 0.43, 0.75, 0));
    for (const y of [0.3, 1.2]) door.add(box(0.08, 0.1, 0.08, 0xb8c0c8, 0.02, y, 0.03, NO));
    g.add(door);
    // 側面通風百葉、背後水箱、屋頂旋轉排氣球
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) g.add(box(0.02, 0.05, 0.5, 0x2a7a33, sx * 0.585, 1.3 - i * 0.09, 0, NO));
    g.add(box(0.7, 0.5, 0.12, 0x2e8f39, 0, 0.5, -0.6, { r: 0.04 }));
    g.add(label('VACANT?', 0.5, { color: '#ffffff', stroke: '#1a5a22', size: 40 }, 0.586, 0.45, 0, HALF));
    const vent = new THREE.Group(); vent.position.set(0.32, 2.03, -0.3);
    vent.add(sphere(0.13, 0xb8c0c8, 0, 0, 0, { seg: 10 }));
    for (let i = 0; i < 6; i++) vent.add(R(box(0.03, 0.2, 0.1, 0x8b95a1, Math.cos(i * 1.047) * 0.12, 0, Math.sin(i * 1.047) * 0.12, NO), 0, -i * 1.047, 0.3));
    g.add(vent);
    const flies = [];
    for (let i = 0; i < 3; i++) { const f = sphere(0.045, 0x111111, 0, 1.9, 0, { seg: 6, outline: false }); flies.push(f); g.add(f); }
    g.userData.anim = t => {
      flies.forEach((f, i) => { const a = t * (3 + i) + i * 2; f.position.set(Math.cos(a) * (0.4 + i * 0.1), 2.0 + Math.sin(t * 7 + i) * 0.12, Math.sin(a * 1.3) * 0.4); });
      vent.rotation.y = t * 2.5;
      const k = (t * 0.3) % 1; door.rotation.y = k > 0.85 ? Math.abs(Math.sin(t * 30)) * 0.08 : 0; // 偶爾被撞
    };
    return g;
  },

  // 大型垃圾桶：綠色子母車、半開的蓋子、垃圾袋與披薩盒
  trash() {
    const g = group(
      box(1.65, 0.95, 1.15, 0x2f7d3a, 0, 0.6, 0),
      box(1.72, 0.1, 1.22, 0x245f2c, 0, 0.18, 0),
      sphere(0.36, 0x22222a, -0.35, 1.08, 0.05), sphere(0.3, 0x2c2c38, 0.25, 1.1, -0.1), sphere(0.26, 0x22222a, 0.5, 1.05, 0.25),
      R(box(0.5, 0.06, 0.5, 0xe9c58a, 0.05, 1.22, 0.32), 0.3, 0.4, 0.2),
      R(box(0.8, 0.06, 1.2, 0x1d4f25, -0.42, 1.35, -0.3), 0.9, 0, 0.1),
      label('NO DUMPING*', 1.1, { color: '#fff', size: 48 }, 0, 0.62, 0.59),
      label('*except you', 0.5, { color: '#ffd23f', size: 40 }, 0.35, 0.36, 0.59),
    );
    for (const x of [-0.65, 0.65]) for (const z of [-0.45, 0.45]) g.add(R(cyl(0.1, 0.1, 0.07, 0x222222, x, 0.1, z, { seg: 10 }), HALF));
    // 右半蓋會被裡面的東西頂起來，縫裡有一對發光眼睛
    const lid = new THREE.Group(); lid.position.set(0.42, 1.24, -0.6);
    lid.add(R(box(0.8, 0.06, 1.2, 0x1d4f25, 0, 0, 0.55), 0, 0, 0));
    g.add(lid);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffe14f });
    const eyes = group(sphere(0.045, 0, 0.32, 1.12, 0.2, { mat: eyeM, seg: 6, outline: false }), sphere(0.045, 0, 0.5, 1.12, 0.2, { mat: eyeM, seg: 6, outline: false }));
    g.add(eyes);
    // 側邊把手、凹痕、貼紙
    for (const x of [-0.6, 0.6]) g.add(R(cyl(0.035, 0.035, 0.35, 0x8b95a1, x, 0.85, 0.62, { seg: 6 }), 0, 0, HALF));
    g.add(S(sphere(0.12, 0x24602c, -0.4, 0.45, 0.575, { seg: 8, outline: false }), 1, 0.7, 0.15));
    // 臭味線
    const stink = [];
    for (let i = 0; i < 3; i++) { const s = tube([[0, 0, 0], [0.08, 0.15, 0], [-0.06, 0.3, 0], [0.06, 0.45, 0]], 0.025, 0x9ad94a, { mat: flat(0x9ad94a), outline: false, seg: 10 }); s.position.set(-0.4 + i * 0.4, 1.35, 0.2); stink.push(s); g.add(s); }
    g.userData.anim = t => {
      stink.forEach((s, i) => { const k = (t * 0.6 + i / 3) % 1; s.position.y = 1.3 + k * 0.5; s.scale.setScalar(Math.sin(k * Math.PI) + 0.01); });
      const k = (t * 0.22) % 1, up = k > 0.7 ? Math.sin((k - 0.7) / 0.3 * Math.PI) : 0;
      lid.rotation.x = -0.2 - up * 0.4 - (up > 0.3 ? Math.abs(Math.sin(t * 25)) * 0.05 : 0);
      eyes.visible = up > 0.25 && Math.sin(t * 9) > -0.8; eyes.position.y = up * 0.08;
    };
    return g;
  },

  // 巨型薯條石柱：石座＋紅紙盒＋一束巨大薯條（高約 3.8 m）
  pillar() {
    const g = group(
      box(1.75, 0.35, 1.75, 0x9a8b74, 0, 0.17, 0),
      R(cyl(0.98, 0.72, 1.45, 0xe8322d, 0, 1.07, 0, { seg: 4 }), 0, Math.PI / 4),
      R(cyl(0.99, 0.99, 0.12, 0xb81f1f, 0, 1.76, 0, { seg: 4 }), 0, Math.PI / 4),
      sphere(0.3, 0xffd23f, 0, 1.0, 0.6, { seg: 12 }),
      label('FRY', 0.5, { color: '#fff', size: 64, stroke: '#7a1010' }, 0, 1.38, 0.6),
    );
    g.children[3].scale.set(1, 1, 0.25);
    const fr = [[0, 0, 2.3], [-0.38, -0.2, 1.9], [0.36, -0.22, 2.05], [-0.3, 0.3, 1.7], [0.32, 0.28, 1.8], [0.05, -0.45, 1.65], [-0.05, 0.42, 2.0], [0.55, 0.05, 1.55], [-0.55, 0.0, 1.6]];
    const fries = [];
    fr.forEach(([x, z, h], i) => {
      const p = new THREE.Group(); p.position.set(x, 1.7, z); p.rotation.set(z * 0.25, i * 0.4, -x * 0.25);
      const f = box(0.27, h, 0.27, i % 3 ? 0xffc93c : 0xf2b52a, 0, h / 2, 0, { r: 0.04 });
      f.add(box(0.2, 0.12, 0.275, 0xd88a1a, 0, h / 2 - 0.08, 0, NO)); // 焦尖
      p.add(f); g.add(p); fries.push(p);
    });
    // 鹽粒＋石座碎角
    for (let i = 0; i < 10; i++) { const a = i * 2.3; g.add(box(0.04, 0.04, 0.04, 0xffffff, Math.cos(a) * 0.4, 1.8 + (i % 4) * 0.35, Math.sin(a) * 0.4, NO)); }
    g.add(R(box(0.3, 0.2, 0.25, 0x847662, 0.82, 0.1, 0.78), 0, 0.5, 0.2));
    g.userData.anim = t => fries.forEach((p, i) => { p.rotation.x = fr[i][1] * 0.25 + Math.sin(t * 1.4 + i) * 0.025; p.rotation.z = -fr[i][0] * 0.25 + Math.cos(t * 1.1 + i * 1.7) * 0.025; });
    return g;
  },

  // 地鐵刷卡閘門：兩座不鏽鋼機櫃、三叉轉臂、讀卡燈
  gate() {
    const g = group(
      box(0.36, 1.0, 1.5, 0xb8c0c8, -0.72, 0.5, 0),
      box(0.36, 1.0, 1.5, 0xb8c0c8, 0.72, 0.5, 0),
      box(0.4, 0.08, 1.54, 0xffd23f, -0.72, 1.02, 0),
      box(0.4, 0.08, 1.54, 0xffd23f, 0.72, 1.02, 0),
      box(0.2, 0.06, 0.24, 0x16161c, -0.72, 1.08, 0.35),
      box(0.14, 0.02, 0.14, 0x3dff7a, -0.72, 1.12, 0.35, { mat: new THREE.MeshBasicMaterial({ color: 0x3dff7a }), outline: false }),
      R(cyl(0.12, 0.12, 0.14, 0x6b737c, -0.5, 0.85, 0, { seg: 10 }), 0, 0, HALF),
      label('TAP ▸', 0.5, { color: '#16161c', size: 48 }, -0.72, 0.7, 0.76),
    );
    const rotor = new THREE.Group(); rotor.position.set(-0.45, 0.85, 0);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; rotor.add(rod([0, 0, 0], [0.55, Math.sin(a) * 0.32, Math.cos(a) * 0.32], 0.04, 0xdfe5ea)); }
    g.add(rotor);
    // 箭頭指示燈、投幣口、地上的黃色警示線
    g.add(label('↑', 0.22, { color: '#3dff7a', size: 64, bg: '#16161c' }, 0.72, 0.85, 0.76), label('✕', 0.22, { color: '#ff3a3a', size: 64, bg: '#16161c' }, 0.72, 0.85, -0.76, Math.PI));
    g.add(box(0.12, 0.02, 0.04, 0x16161c, 0.72, 1.07, 0.3, NO));
    for (const z of [-0.85, 0.85]) g.add(box(1.8, 0.012, 0.1, 0xffd23f, 0, 0.006, z, { ...NO, shadow: false }));
    const led = g.children[5];
    g.userData.anim = t => {
      const k = (t * 0.4) % 1, turn = k > 0.8 ? (1 - Math.cos((k - 0.8) / 0.2 * Math.PI)) / 2 : 0;
      rotor.rotation.x = (Math.floor(t * 0.4) + turn) * Math.PI * 2 / 3;
      led.material.color.set(turn > 0 ? 0x3dff7a : 0xff3a3a);
    };
    return g;
  },

  // 防彈玻璃會議室隔板（高約 3 m）
  glass() {
    const g = group(
      box(0.16, 3.0, 0.16, 0x2d3036, -0.95, 1.5, 0),
      box(0.16, 3.0, 0.16, 0x2d3036, 0.95, 1.5, 0),
      box(2.06, 0.14, 0.18, 0x2d3036, 0, 3.0, 0),
      box(2.06, 0.2, 0.3, 0x2d3036, 0, 0.1, 0),
      box(1.76, 2.8, 0.06, 0x8fe8ff, 0, 1.55, 0, { transparent: true, opacity: 0.38, outline: false }),
      box(1.76, 0.18, 0.07, 0xff4f9e, 0, 1.25, 0, { outline: false }),
      label('MEETING IN PROGRESS', 1.3, { color: '#fff', size: 40 }, 0, 1.25, 0.04),
      label('SYNERGY™', 0.9, { color: '#2d3036', size: 48 }, 0, 2.35, 0.04),
      label('SYNERGY™', 0.9, { color: '#2d3036', size: 48 }, 0, 2.35, -0.04, Math.PI),
    );
    // 掃過玻璃的反光條＋便利貼＋白板塗鴉
    const glint = R(box(0.12, 3.2, 0.005, 0xffffff, 0, 1.55, 0.04, { mat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }), outline: false, shadow: false }), 0, 0, 0.5);
    const gl2 = R(box(0.05, 3.2, 0.005, 0xffffff, 0.18, 1.55, 0.04, { mat: glint.material, outline: false, shadow: false }), 0, 0, 0.5);
    const gg = group(glint, gl2); g.add(gg);
    for (const [x, y, c] of [[0.62, 2.0, 0xffe14f], [0.5, 1.85, 0xff9ad0], [0.7, 1.75, 0x9de8ff]]) g.add(R(box(0.14, 0.14, 0.01, c, x, y, 0.045, NO), 0, 0, (x - 0.6) * 2));
    g.add(label('Q4: ↗↗↗', 0.6, { color: '#2a6fd6', size: 40 }, -0.45, 1.6, 0.045));
    g.userData.anim = t => { const k = (t * 0.18) % 1; gg.position.x = -1.4 + k * 2.8; gg.visible = k > 0.05 && k < 0.95; gg.scale.y = 0.85; };
    // 彈孔裂痕
    for (const [x, y] of [[-0.45, 1.85], [0.5, 0.75]]) {
      g.add(sphere(0.05, 0xffffff, x, y, 0.04, { seg: 6, outline: false }));
      for (let i = 0; i < 5; i++) { const a = i * 1.3 + x; g.add(R(box(0.24, 0.018, 0.012, 0xffffff, x + Math.cos(a) * 0.12, y + Math.sin(a) * 0.12, 0.04, NO), 0, 0, a)); }
    }
    return g;
  },

  // 太陽能板
  solar() {
    const g = group(
      box(0.9, 0.12, 0.6, 0x6b6f78, 0, 0.06, 0),
      cyl(0.07, 0.07, 0.7, 0x8b95a1, 0, 0.45, 0, { seg: 8 }),
    );
    const pan = group(
      box(1.85, 0.1, 1.2, 0xd8dde3, 0, 0, 0),
      box(1.75, 0.04, 1.1, 0x1d3f8f, 0, 0.05, 0, NO),
    );
    for (let i = 1; i < 5; i++) pan.add(box(0.025, 0.02, 1.08, 0x6ea8ff, -0.875 + i * 0.35, 0.08, 0, { mat: flat(0x6ea8ff), outline: false }));
    for (let i = 1; i < 3; i++) pan.add(box(1.73, 0.02, 0.025, 0x6ea8ff, 0, 0.08, -0.55 + i * 0.367, { mat: flat(0x6ea8ff), outline: false }));
    const glint = box(0.5, 0.01, 0.12, 0xffffff, -0.4, 0.09, -0.3, { mat: flat(0xffffff), outline: false });
    glint.rotation.y = 0.6; pan.add(glint);
    pan.position.set(0, 0.95, 0); pan.rotation.x = -0.5;
    g.add(pan, rod([0, 0.4, 0], [0, 0.85, -0.45], 0.04, 0x8b95a1));
    // 接線盒＋電纜
    g.add(box(0.2, 0.14, 0.1, 0x3a3a44, 0.22, 0.25, 0.32), tube([[0.22, 0.2, 0.37], [0.4, 0.06, 0.5], [0.55, 0.03, 0.3]], 0.025, 0x1b1226, { seg: 10 }));
    g.userData.anim = t => { glint.position.x = -0.8 + ((t * 0.35) % 1) * 1.6; pan.rotation.z = Math.sin(t * 0.25) * 0.12; };
    return g;
  },

  // 鬆餅屋卡座桌（紅色乙烯皮椅＋鬆餅＋糖漿）
  booth() {
    const g = group(
      box(0.95, 0.08, 0.7, 0xf2ead8, 0, 0.78, 0),
      box(0.98, 0.04, 0.73, 0x2f7d8a, 0, 0.74, 0),
      cyl(0.06, 0.06, 0.72, 0x6b6f78, 0, 0.38, 0, { seg: 8 }),
      box(0.5, 0.06, 0.4, 0x6b6f78, 0, 0.03, 0),
    );
    for (const s of [-1, 1]) {
      g.add(box(1.7, 0.42, 0.5, 0xd7263d, 0, 0.22, s * 0.68));
      g.add(box(1.7, 0.75, 0.18, 0xd7263d, 0, 0.75, s * 0.88));
      g.add(box(1.72, 0.08, 0.2, 0xffd23f, 0, 1.15, s * 0.88));
    }
    g.add(
      cyl(0.2, 0.2, 0.03, 0xffffff, -0.15, 0.84, 0.05, { seg: 14 }),
      box(0.28, 0.06, 0.28, 0xe0a030, -0.15, 0.88, 0.05, { r: 0.02 }),
      box(0.07, 0.05, 0.07, 0xfff2a0, -0.13, 0.93, 0.05),
      cyl(0.06, 0.07, 0.24, 0x7a3a10, 0.25, 0.94, -0.12, { seg: 8 }),
      cyl(0.03, 0.03, 0.06, 0xd7263d, 0.25, 1.09, -0.12, { seg: 6 }),
      cyl(0.07, 0.06, 0.12, 0xfafafa, 0.28, 0.88, 0.18, { seg: 10 }),
    );
    const steam = tube([[0, 0, 0], [0.04, 0.1, 0], [-0.03, 0.2, 0], [0.03, 0.3, 0]], 0.015, 0xffffff, { mat: flat(0xffffff, { transparent: true, opacity: 0.7 }), outline: false, seg: 8 });
    steam.position.set(0.28, 0.95, 0.18); g.add(steam);
    // 桌邊點歌機、餐巾架、番茄醬、座椅鈕扣
    const jl = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    g.add(box(0.26, 0.24, 0.16, 0xc8d0d8, 0.32, 0.94, -0.26), box(0.2, 0.14, 0.02, 0x2b2540, 0.32, 0.96, -0.175, { mat: jl, outline: false }),
      box(0.14, 0.12, 0.08, 0xc8d0d8, 0.0, 0.88, -0.27), box(0.12, 0.1, 0.02, 0xffffff, 0.0, 0.9, -0.225, NO),
      cyl(0.035, 0.04, 0.16, 0xd7263d, -0.42, 0.9, -0.22, { seg: 8 }));
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.add(sphere(0.025, 0xa81a2d, -0.6 + i * 0.4, 0.78, s * 0.785, { seg: 5, outline: false }));
    g.userData.anim = t => { steam.scale.y = 0.8 + Math.sin(t * 3) * 0.25; steam.rotation.y = t; jl.color.setHSL((t * 0.2) % 1, 0.9, 0.6); };
    return g;
  },

  // 社區修剪樹籬＋粉紅草坪紅鶴
  hedge() {
    const g = group(
      box(1.85, 0.95, 1.15, 0x2f9e44, 0, 0.5, 0, { r: 0.28 }),
      sphere(0.34, 0x46b85a, -0.55, 0.98, 0.05), sphere(0.38, 0x3aa84e, 0.05, 1.02, -0.1), sphere(0.32, 0x46b85a, 0.6, 0.96, 0.08),
    );
    const fl = group(
      cyl(0.015, 0.015, 0.5, 0x222222, 0, 0.25, 0, { seg: 5 }),
      S(sphere(0.16, 0xff5fa8, 0, 0.6, 0), 1.4, 0.9, 0.8),
      rod([0.15, 0.62, 0], [0.22, 0.95, 0], 0.035, 0xff5fa8),
      sphere(0.08, 0xff5fa8, 0.2, 0.99, 0),
      R(cone(0.03, 0.12, 0x222222, 0.29, 0.96, 0, { seg: 6 }), 0, 0, -2.2),
    );
    fl.position.set(0.55, 0, 0.75); fl.rotation.y = -0.6;
    g.add(fl);
    // 修剪痕與小花
    for (let i = 0; i < 7; i++) g.add(sphere(0.05, [0xffffff, 0xffe14f, 0xff9ad0][i % 3], -0.8 + i * 0.26, 0.6 + (i % 2) * 0.25, 0.58, { seg: 5, outline: false }));
    g.add(R(box(0.25, 0.3, 0.02, 0xffffff, -0.7, 0.32, 0.6), 0, 0, 0.1), label('KEEP\nOFF', 0.2, { color: '#2a6b2a', size: 40 }, -0.7, 0.32, 0.615));
    g.userData.anim = t => { fl.rotation.z = Math.sin(t * 1.7) * 0.05; fl.children[3].position.y = 0.99 + Math.max(0, Math.sin(t * 0.9)) ** 6 * -0.08; };
    return g;
  },

  // 社區信箱：集合式信箱＋路邊老信箱（紅旗）
  mailbox() {
    const g = group(
      box(0.3, 0.55, 0.3, 0x6b6f78, -0.3, 0.28, 0),
      box(0.95, 0.85, 0.5, 0xd8cdb0, -0.3, 0.95, 0),
      R(box(1.05, 0.08, 0.62, 0x6b4a2b, -0.3, 1.42, 0), 0.12),
    );
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.add(box(0.26, 0.2, 0.03, r === 1 && c === 2 ? 0xffd23f : 0xbfb393, -0.6 + c * 0.3, 0.72 + r * 0.25, 0.26, NO));
    g.add(
      box(0.1, 0.9, 0.1, 0x8a5a33, 0.55, 0.45, 0.2),
      R(cyl(0.2, 0.2, 0.6, 0x5c88c4, 0.55, 1.05, 0.2, { seg: 14 }), HALF),
      box(0.4, 0.2, 0.6, 0x5c88c4, 0.55, 0.95, 0.2, { r: 0.02 }),

      R(box(0.3, 0.02, 0.2, 0xffffff, 0.55, 1.05, 0.55), 0.6, 0.2),
      R(box(0.3, 0.02, 0.2, 0xfff3c0, 0.5, 1.0, 0.58), 0.9, -0.3),
    );
    const flagG = new THREE.Group(); flagG.position.set(0.77, 1.05, 0.15);
    flagG.add(box(0.04, 0.32, 0.04, 0xe23b2e, 0, 0.13, 0), box(0.04, 0.12, 0.16, 0xe23b2e, 0, 0.25, 0.08));
    g.add(flagG);
    g.add(label('HOA', 0.3, { color: '#ffffff', size: 48 }, 0.55, 1.07, 0.505), label('NO JUNK MAIL', 0.6, { color: '#6b4a2b', size: 40 }, -0.3, 0.5, 0.26));
    g.userData.anim = t => { flagG.rotation.z = Math.sin(t * 2.4) * 0.12; };
    return g;
  },

  // 烤肉醬鐵桶
  barrel() {
    const g = group(
      cyl(0.5, 0.5, 1.15, 0x9c1f12, 0, 0.58, 0, { seg: 16 }),
      torus(0.5, 0.04, 0x3a2a24, 0, 0.18, 0), torus(0.5, 0.04, 0x3a2a24, 0, 0.58, 0), torus(0.5, 0.04, 0x3a2a24, 0, 0.98, 0),
      cyl(0.47, 0.47, 0.04, 0x3a2a24, 0, 1.16, 0, { seg: 16 }),
      S(sphere(0.3, 0x5e1408, 0.1, 1.17, 0.05), 1, 0.25, 1),
      S(sphere(0.12, 0x5e1408, 0.32, 1.0, 0.32), 0.6, 1.6, 0.6),
      label('BBQ\nSAUCE', 0.55, { color: '#fff3d6', size: 56 }, 0, 0.58, 0.51),
      label('HOT', 0.4, { color: '#ffd23f', size: 56 }, 0.51, 0.75, 0, HALF),
      rod([-0.1, 1.1, -0.1], [-0.3, 1.65, -0.2], 0.035, 0xc89060),
      cyl(0.07, 0.07, 0.05, 0x3a2a24, -0.25, 1.18, -0.2, { seg: 8 }),
      S(sphere(0.06, 0x5e1408, 0.42, 0.42, 0.25, { seg: 6, outline: false }), 1, 1.8, 0.6),
    );
    g.children[1].rotation.x = g.children[2].rotation.x = g.children[3].rotation.x = HALF;
    // 沿桶身往下流的醬汁滴＋醬面冒泡
    const drip = S(sphere(0.07, 0x7a1a0a, 0.36, 1.0, 0.36, { seg: 8 }), 0.8, 1.4, 0.8);
    const pop = sphere(0.06, 0x8a2a14, 0.05, 1.2, 0.05, { seg: 8 });
    g.add(drip, pop);
    g.userData.anim = t => {
      const k = (t * 0.35) % 1; drip.position.y = 1.0 - k * 0.85; drip.scale.set(0.8, 1.2 + k * 0.6, 0.8); drip.visible = k < 0.92;
      const p = (t * 0.8) % 1; pop.scale.setScalar(0.4 + p * 0.9); pop.visible = p < 0.85;
    };
    return g;
  },

  // 墜毀的飛碟漢堡餐車（2×2 格，約 3 m 高、傾斜、冒煙）
  wreck(w, d) {
    const s = Math.min(w, d) / 2;
    const g = new THREE.Group();
    const body = new THREE.Group();
    body.add(
      box(3.1, 1.6, 1.75, 0xfff1d0, 0, 1.15, 0),
      box(3.14, 0.28, 1.79, 0xe8322d, 0, 0.62, 0),
      box(1.0, 1.15, 1.7, 0xfff1d0, 1.95, 0.9, 0),
      box(0.06, 0.55, 1.4, 0x2a3a55, 2.46, 1.15, 0, NO),
      box(1.6, 0.7, 0.05, 0x2a1a14, -0.25, 1.35, 0.88, NO),
      box(3.1, 0.3, 0.1, 0xff7a1a, 0, 0.35, 0),
    );
    for (let i = 0; i < 4; i++) body.add(R(box(0.42, 0.06, 0.5, i % 2 ? 0xffffff : 0xe8322d, -0.88 + i * 0.42, 1.78, 1.05, NO), 0.5));
    for (const [x, z] of [[-1.0, 0.85], [-1.0, -0.85], [1.8, -0.85]]) body.add(R(cyl(0.38, 0.38, 0.28, 0x222222, x, 0.38, z, { seg: 12 }), HALF));
    body.add(R(cyl(0.38, 0.38, 0.28, 0x222222, 2.7, 0.3, 1.4, { seg: 12 }), 0.3, 0, 1.2));
    body.add(label('UFO BURGER', 1.5, { color: '#e8322d', size: 56 }, -0.25, 1.82, 0.9, 0, -0.5));
    body.rotation.set(0.08, 0.15, -0.12);
    body.position.set(0, -0.05, 0.1);
    g.add(body);
    // 漢堡飛碟（斜插在車頂）
    const ufo = new THREE.Group();
    const seeds = [];
    ufo.add(
      cyl(1.35, 1.2, 0.32, 0xe0a24a, 0, -0.42, 0, { seg: 20 }),
      cyl(1.45, 1.45, 0.3, 0x5a2e1a, 0, -0.12, 0, { seg: 20 }),
      R(box(2.1, 0.07, 2.1, 0xffc21f, 0, 0.05, 0, { r: 0.02 }), 0, Math.PI / 4),
      torus(1.42, 0.12, 0x58c443, 0, 0.1, 0, { seg: 24 }),
      torus(1.62, 0.14, 0xb8c0c8, 0, -0.25, 0, { seg: 24 }),
      S(sphere(1.45, 0xe9a94c, 0, 0.15, 0, { seg: 20 }), 1, 0.6, 1),
      S(sphere(0.45, 0x9de8ff, 0, 0.98, 0, { transparent: true, opacity: 0.5, seg: 12, outline: false }), 1, 0.8, 1),
      sphere(0.16, 0x7dff5a, 0, 0.92, 0, { seg: 10 }),
    );
    ufo.children[3].rotation.x = ufo.children[4].rotation.x = HALF;
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, r = 0.5 + (i % 3) * 0.28; const sd = S(sphere(0.07, 0xfff7e0, Math.cos(a) * r, 0.86 - r * 0.28, Math.sin(a) * r, { seg: 6, outline: false }), 1.6, 0.6, 1); seeds.push(sd); ufo.add(sd); }
    const lights = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const l = sphere(0.09, 0, Math.cos(a) * 1.62, -0.25, Math.sin(a) * 1.62, { mat: flat(i % 2 ? 0xff4f9e : 0xb6ff3d), seg: 8, outline: false }); lights.push(l); ufo.add(l); }
    ufo.position.set(-0.3, 2.3, -0.1); ufo.rotation.set(0.25, 0, 0.42);
    g.add(ufo);
    // 碎片
    g.add(R(box(0.6, 0.06, 0.4, 0xb8c0c8, -1.6, 0.05, 1.2), 0, 0.6, 0.1), R(box(0.3, 0.3, 0.3, 0xe0a24a, 1.4, 0.15, -1.3, { r: 0.1 }), 0.3, 0.4, 0));
    // 煙
    const smoke = [];
    for (let i = 0; i < 6; i++) { const p = sphere(0.35, i % 2 ? 0x8a8590 : 0x5e5964, 0, 0, 0, { seg: 10 }); smoke.push(p); g.add(p); }
    g.scale.setScalar(s);
    g.userData.anim = t => {
      smoke.forEach((p, i) => { const k = (t * 0.32 + i / smoke.length) % 1; p.position.set(-0.9 + Math.sin(k * 4 + i * 2) * 0.35 + k * 1.6, 2.4 + k * 4.2, -0.2 + Math.cos(i * 2.5) * 0.4 + k * 0.6); p.scale.setScalar(0.25 + k * 1.1 - (k > 0.8 ? (k - 0.8) * 6 : 0)); });
      lights.forEach((l, i) => (l.visible = ((Math.floor(t * 6) + i) % 3) !== 0));
    };
    return g;
  },

  // 大腳怪卡車車頭（約 3.1 m）
  truckcab() {
    const g = new THREE.Group();
    for (const x of [-0.72, 0.72]) for (const z of [-0.62, 0.62]) {
      g.add(R(cyl(0.66, 0.66, 0.5, 0x1e1e24, x, 0.66, z, { seg: 16 }), HALF));
      g.add(R(cyl(0.3, 0.3, 0.52, 0xffd23f, x, 0.66, z + Math.sign(z) * 0.01, { seg: 8 }), HALF));
      g.add(rod([x * 0.6, 0.7, z * 0.5], [x * 0.6, 1.35, z * 0.5], 0.08, 0xe8322d));
    }
    g.add(
      box(1.6, 0.25, 1.0, 0x3a3a44, 0, 1.4, 0),
      box(1.75, 0.5, 1.2, 0x2fbf71, 0, 1.75, 0),
      box(0.95, 0.75, 1.15, 0x2fbf71, -0.25, 2.35, 0),
      box(0.04, 0.48, 0.95, 0x2a3a55, 0.23, 2.42, 0, NO),
      box(0.7, 0.45, 0.04, 0x2a3a55, -0.25, 2.42, 0.58, NO),
      box(0.7, 0.45, 0.04, 0x2a3a55, -0.25, 2.42, -0.58, NO),
      box(0.3, 0.3, 1.24, 0xb8c0c8, 0.9, 1.65, 0),
      box(0.8, 0.1, 0.9, 0x1e1e24, -0.25, 2.78, 0),
      cyl(0.06, 0.06, 1.0, 0xc8d0d8, -0.82, 2.4, 0.5, { seg: 8 }),
      cyl(0.06, 0.06, 1.0, 0xc8d0d8, -0.82, 2.4, -0.5, { seg: 8 }),
      label('MUD KING', 1.0, { color: '#ffd23f', stroke: '#1e1e24', size: 56 }, 0.15, 1.75, 0.61),
      label('MUD KING', 1.0, { color: '#ffd23f', stroke: '#1e1e24', size: 56 }, 0.15, 1.75, -0.61, Math.PI),
    );
    const bar = [];
    for (let i = 0; i < 4; i++) { const b = box(0.14, 0.1, 0.14, 0xffe680, -0.25, 2.88, -0.33 + i * 0.22, { mat: flat(0xfff2a0), outline: false }); bar.push(b); g.add(b); }
    // 引擎蓋上的毛茸茸大腳獸吉祥物
    g.add(sphere(0.18, 0x6b3f1f, 0.55, 2.12, 0), sphere(0.05, 0xffffff, 0.7, 2.16, 0.07, { seg: 6, outline: false }), sphere(0.05, 0xffffff, 0.7, 2.16, -0.07, { seg: 6, outline: false }));
    const puffs = [];
    for (let i = 0; i < 4; i++) { const p = sphere(0.1, 0x6a6a72, -0.82, 2.95, i % 2 ? 0.5 : -0.5, { transparent: true, opacity: 0.55, seg: 8, outline: false, shadow: false }); puffs.push(p); g.add(p); }
    // 泥巴噴濺、車牌
    for (let i = 0; i < 6; i++) g.add(S(sphere(0.07, 0x6b4a2b, -0.6 + i * 0.25, 1.5 + (i % 2) * 0.12, 0.62, { seg: 5, outline: false }), 1.3, 0.8, 0.3));
    g.add(box(0.04, 0.16, 0.36, 0xfff3c0, 0.98, 1.4, 0, NO), label('MUD 4X4', 0.32, { color: '#1e1e24', size: 40 }, 1.0, 1.4, 0, HALF));
    g.userData.anim = t => {
      bar.forEach((b, i) => (b.visible = Math.floor(t * 3 + i * 0.5) % 2 === 0));
      puffs.forEach((p, i) => { const k = (t * 0.7 + (i >> 1) * 0.5) % 1; p.position.y = 2.95 + k * 0.9; p.position.x = -0.82 - k * 0.3; p.scale.setScalar(0.6 + k * 1.6); p.visible = k < 0.9; });
    };
    return g;
  },

  // 摔角級金屬摺疊椅（站立、略歪）
  chair() {
    const g = group(
      box(0.46, 0.05, 0.42, 0x9aa3ad, 0, 0.47, 0.02),
      R(box(0.46, 0.3, 0.05, 0x9aa3ad, 0, 0.78, -0.22), -0.12),
      rod([-0.21, 0, 0.2], [-0.21, 0.95, -0.24], 0.025, 0x6b737c),
      rod([0.21, 0, 0.2], [0.21, 0.95, -0.24], 0.025, 0x6b737c),
      rod([-0.21, 0, -0.22], [-0.21, 0.46, 0.15], 0.025, 0x6b737c),
      rod([0.21, 0, -0.22], [0.21, 0.46, 0.15], 0.025, 0x6b737c),
      label('RING SIDE', 0.36, { color: '#e8322d', size: 40 }, 0, 0.8, -0.19, 0, -0.12),
      box(0.4, 0.012, 0.36, 0x7d858f, 0, 0.5, 0.02, NO),
      R(box(0.12, 0.03, 0.03, 0x6b737c, 0.12, 0.92, -0.255, NO), -0.12),
    );
    for (const [x, z] of [[-0.21, 0.2], [0.21, 0.2], [-0.21, -0.22], [0.21, -0.22]]) g.add(cyl(0.035, 0.035, 0.04, 0x1b1226, x, 0.02, z, { seg: 6, outline: false }));
    g.add(S(sphere(0.05, 0x5d636e, 0.1, 0.5, 0.15, { seg: 6, outline: false }), 1.6, 0.2, 1)); // 凹痕
    g.children[0].rotation.z = 0.04;
    return g;
  },

  // 瓦斯桶（丙烷鋼瓶）
  gascan() {
    const g = group(
      cyl(0.32, 0.32, 0.12, 0x5a5e66, 0, 0.06, 0, { seg: 14 }),
      capsule(0.32, 0.5, 0xe63946, 0, 0.6, 0, { seg: 14 }),
      cyl(0.18, 0.2, 0.18, 0xb8c0c8, 0, 1.0, 0, { seg: 10 }),
      cyl(0.05, 0.05, 0.12, 0xd4a020, 0, 1.12, 0, { seg: 6 }),
      R(cyl(0.08, 0.08, 0.03, 0x2b2540, 0, 1.18, 0, { seg: 8 }), 0, 0, 0),
      cyl(0.325, 0.325, 0.2, 0xffffff, 0, 0.62, 0, { seg: 14, outline: false }),
      label('PROPANE', 0.34, { color: '#e63946', size: 48 }, 0, 0.62, 0.345),
      label('FLAMMABLE', 0.34, { color: '#e63946', size: 40 }, 0.345, 0.62, 0, HALF),
      R(torus(0.11, 0.02, 0xd4a020, 0, 1.22, 0, { seg: 12 }), HALF),
      R(torus(0.2, 0.035, 0x8b95a1, 0, 1.05, 0, { seg: 14 }), HALF),
    );
    // 壓力錶（指針亂抖）
    const gauge = new THREE.Group(); gauge.position.set(0.13, 1.06, 0.13); gauge.rotation.y = Math.PI / 4;
    gauge.add(R(cyl(0.07, 0.07, 0.03, 0xffffff, 0, 0, 0, { seg: 12 }), HALF), R(cyl(0.075, 0.075, 0.025, 0x5d636e, 0, 0, -0.01, { seg: 12 }), HALF));
    const needle = box(0.01, 0.055, 0.01, 0xe63946, 0, 0.022, 0.02, NO); const np = new THREE.Group(); np.position.z = 0.0; np.add(needle); gauge.add(np);
    g.add(gauge);
    g.userData.anim = t => { np.rotation.z = -0.6 + Math.sin(t * 3.1) * 0.25 + Math.sin(t * 17) * 0.05; };
    return g;
  },

  // 自動販賣機
  vending() {
    const g = group(
      box(1.1, 1.8, 0.85, 0xff6b1a, 0, 0.9, 0),
      box(0.68, 1.2, 0.04, 0x1a1030, -0.14, 1.05, 0.43, { mat: flat(0x2a2246), outline: false }),
      box(0.7, 1.22, 0.02, 0xbff4ff, -0.14, 1.05, 0.56, { transparent: true, opacity: 0.25, outline: false, shadow: false }),
      box(0.26, 0.9, 0.06, 0x2b2540, 0.38, 1.15, 0.43),
      box(0.7, 0.18, 0.06, 0x16161c, -0.14, 0.25, 0.43),
      box(1.12, 0.22, 0.87, 0xffd23f, 0, 1.72, 0, { mat: flat(0xffe14f) }),
      label('ICE COLD', 0.9, { color: '#ff3b1a', size: 56 }, 0, 1.72, 0.445),
      label('FIZZ', 0.7, { color: '#fff', stroke: '#8a2a00', size: 64 }, 0.556, 1.0, 0, HALF, 0),
    );
    g.children[7].rotation.z = HALF;
    const cols = [0xe8322d, 0x2fbf71, 0x2f8cff, 0xffd23f];
    for (let r = 0; r < 3; r++) g.add(box(0.68, 0.03, 0.14, 0xb8c0c8, -0.14, 0.49 + r * 0.38, 0.49, NO));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.add(cyl(0.06, 0.06, 0.2, cols[(c + r) % 4], -0.4 + c * 0.17, 0.6 + r * 0.38, 0.5, { seg: 8, outline: false }));
    // 選擇鍵盤、投幣口、紙鈔口、退幣鈕、出貨口擋板、玻璃反光斜條
    const btnLit = new THREE.MeshBasicMaterial({ color: 0xff4f9e });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.add(box(0.08, 0.06, 0.03, 0xd8dde3, 0.34 + c * 0.1, 1.4 - r * 0.1, 0.47, r === 1 && c === 0 ? { mat: btnLit, outline: false } : NO));
    g.add(box(0.03, 0.1, 0.02, 0x16161c, 0.34, 0.98, 0.475, NO), box(0.14, 0.03, 0.02, 0x16161c, 0.39, 0.86, 0.475, NO), sphere(0.03, 0xe8322d, 0.44, 0.98, 0.475, { seg: 6, outline: false }));
    g.add(box(0.36, 0.06, 0.04, 0x16161c, 0.39, 1.62, 0.46, NO), label('$1.99', 0.18, { color: '#3dff7a', size: 40 }, 0.39, 1.62, 0.485));
    const flap = R(box(0.6, 0.14, 0.02, 0x3a3a44, -0.14, 0.3, 0.48, NO), -0.2);
    g.add(flap);
    for (const [x, w] of [[-0.3, 0.06], [-0.18, 0.025]]) g.add(R(box(w, 1.3, 0.005, 0xffffff, x, 1.05, 0.575, { mat: flat(0xffffff, { transparent: true, opacity: 0.35 }), outline: false, shadow: false }), 0, 0, -0.35));
    g.add(box(1.12, 0.06, 0.87, 0x2b2540, 0, 0.03, 0), label('NO REFUNDS', 0.5, { color: '#ffffff', size: 40 }, -0.14, 0.13, 0.445));
    // 內部燈管閃
    const inner = g.children[1];
    inner.material = new THREE.MeshBasicMaterial({ color: 0x2a2246 });
    g.userData.anim = t => {
      const off = Math.sin(t * 13) + Math.sin(t * 4.7) > 1.55;
      inner.material.color.set(off ? 0x120e20 : 0x2a2246);
      btnLit.color.set(Math.floor(t * 3) % 2 ? 0xff4f9e : 0x5a1a3a);
      flap.rotation.x = -0.2 - Math.max(0, Math.sin(t * 0.7)) ** 20 * 0.6;
    };
    return g;
  },

  // 性別揭曉派對炸藥箱：粉藍雙色木箱、金色緞帶、炸藥與氣球
  crate() {
    const g = group(
      box(0.66, 1.1, 1.3, 0xff7eb6, -0.33, 0.55, 0, { r: 0.05 }),
      box(0.66, 1.1, 1.3, 0x5ec8ff, 0.33, 0.55, 0, { r: 0.05 }),
      box(1.34, 0.14, 0.18, 0xffd23f, 0, 1.08, 0),
      box(0.18, 1.14, 1.34, 0xffd23f, 0, 0.55, 0, { r: 0.04 }),
      label('BOY? GIRL?', 1.15, { color: '#fff', stroke: '#2b2540', size: 64 }, 0, 0.62, 0.66),
      label('BOY? GIRL?', 1.15, { color: '#fff', stroke: '#2b2540', size: 64 }, 0.67, 0.62, 0, HALF),
      label('DO NOT\nSHAKE', 0.55, { color: '#2b2540', size: 48 }, 0, 0.28, 0.66),
      R(torus(0.14, 0.05, 0xffd23f, -0.15, 1.24, 0), 0, 0.6, 0.6),
      R(torus(0.14, 0.05, 0xffd23f, 0.15, 1.24, 0), 0, -0.6, -0.6),
    );
    for (let i = 0; i < 3; i++) g.add(R(cyl(0.08, 0.08, 0.6, 0xd62828, -0.35 + i * 0.12, 1.2, -0.35, { seg: 8 }), 0, 0, HALF));
    g.add(tube([[-0.45, 1.2, -0.35], [-0.65, 1.35, -0.3], [-0.6, 1.5, -0.2]], 0.015, 0x2b2540, { outline: false, seg: 8 }));
    const spark = sphere(0.07, 0, -0.6, 1.52, -0.2, { mat: flat(0xffe14f), seg: 8, outline: false });
    g.add(spark);
    const balloons = [];
    for (const [x, c, h] of [[-0.4, 0xff7eb6, 2.2], [0.4, 0x5ec8ff, 2.35], [0.05, 0xffffff, 2.0]]) {
      const b = new THREE.Group();
      b.add(rod([0, 1.12, 0], [0, h - 0.25, 0], 0.008, 0xffffff, { outline: false }), S(sphere(0.25, c, 0, h, 0, { seg: 14 }), 1, 1.15, 1), cone(0.05, 0.08, c, 0, h - 0.3, 0, { seg: 6, outline: false }));
      b.position.set(x, 0, 0.35);
      balloons.push(b); g.add(b);
    }
    balloons[2].add(label('?', 0.3, { color: '#2b2540', size: 72 }, 0, 2.0, 0.26));
    g.userData.anim = t => {
      spark.scale.setScalar(0.7 + Math.abs(Math.sin(t * 17)) * 0.8);
      balloons.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.06; b.rotation.x = Math.cos(t * 1.1 + i) * 0.05; });
    };
    return g;
  },

  // 自動旋轉草坪灑水器（快樂水改裝）：轉盤綁四支寶特瓶
  sprinkler() {
    const g = group(
      S(cyl(0.7, 0.75, 0.08, 0x58c443, 0, 0.04, 0, { seg: 18 }), 1, 1, 1),
      cyl(0.22, 0.28, 0.16, 0xffd23f, 0, 0.14, 0, { seg: 12 }),
      cyl(0.06, 0.06, 0.75, 0xb8c0c8, 0, 0.55, 0, { seg: 8 }),
      R(torus(0.36, 0.05, 0x2f9e44, 0.55, 0.1, 0.5), HALF),
    );
    const rot = new THREE.Group(); rot.position.y = 0.95;
    rot.add(cyl(0.12, 0.12, 0.14, 0xe8322d, 0, 0, 0, { seg: 10 }));
    const cols = [0x6b2a12, 0x58c443, 0xff8a1f, 0x9de8ff];
    const drops = [];
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.y = i * HALF;
      arm.add(
        rod([0, 0, 0], [0.32, 0, 0], 0.03, 0xb8c0c8),
        R(cyl(0.11, 0.11, 0.34, cols[i], 0.5, 0.06, 0, { seg: 10 }), 0, 0, HALF),
        R(cone(0.11, 0.14, cols[i], 0.74, 0.06, 0, { seg: 10 }), 0, 0, -HALF),
        R(cyl(0.04, 0.04, 0.05, 0xe8322d, 0.83, 0.06, 0, { seg: 6 }), 0, 0, HALF),
        R(box(0.18, 0.12, 0.005, 0xffffff, 0.5, 0.06, 0.112, NO), 0, 0, 0),
      );
      for (let j = 0; j < 3; j++) { const d = sphere(0.045, 0, 0.95 + j * 0.2, 0.06, 0, { mat: flat(0xc9e8ff), seg: 6, outline: false }); drops.push([d, j]); arm.add(d); }
      rot.add(arm);
    }
    g.add(rot);
    g.userData.anim = t => {
      rot.rotation.y = t * 2.6;
      drops.forEach(([d, j]) => { const k = (t * 1.6 + j / 3) % 1; d.position.x = 0.9 + k * 0.7; d.position.y = 0.06 + Math.sin(k * Math.PI) * 0.35 - k * 0.6; d.scale.setScalar(1 - k * 0.5); });
    };
    return g;
  },

  // 巨型促銷展示吊燈（懸掛：底部約 2.7 m，繩子到 y≈7）
  chandelier(w, d) {
    const s = Math.max(0.55, Math.min(w, d) / 2);
    const g = new THREE.Group();
    const pivot = new THREE.Group(); pivot.position.y = 7; g.add(pivot);
    const L = new THREE.Group(); L.position.y = -7; pivot.add(L);
    L.add(
      cyl(0.05, 0.05, 2.2, 0xc8a46a, 0, 5.9, 0, { seg: 6 }),
      cone(0.4, 0.35, 0xffc531, 0, 4.65, 0, { seg: 12 }),
      cyl(0.08, 0.08, 1.2, 0xffc531, 0, 4.0, 0, { seg: 8 }),
      R(torus(1.45 * s, 0.09, 0xffc531, 0, 3.45, 0, { seg: 28 }), HALF),
      R(torus(0.8 * s, 0.07, 0xffc531, 0, 3.95, 0, { seg: 20 }), HALF),
      sphere(0.24, 0xff4f9e, 0, 3.4, 0, { seg: 12 }),
    );
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; L.add(rod([0, 3.4, 0], [Math.cos(a) * 1.45 * s, 3.45, Math.sin(a) * 1.45 * s], 0.035, 0xffc531, { outline: false })); }
    // 燈泡：奇偶兩組合併成兩個網格，交替閃爍
    const bulbGeo = [[], []];
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r = 1.45 * s; const b = new THREE.SphereGeometry(0.12, 8, 6); b.translate(Math.cos(a) * r, 3.6, Math.sin(a) * r); bulbGeo[i % 2].push(b); }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.5, r = 0.8 * s; const b = new THREE.SphereGeometry(0.1, 8, 6); b.translate(Math.cos(a) * r, 4.08, Math.sin(a) * r); bulbGeo[i % 2].push(b); }
    const bulbs = bulbGeo.map((gs, i) => { const m = new THREE.Mesh(merge(gs), flat(i ? 0xfff2a0 : 0xffd23f)); L.add(m); return m; });
    // 環形促銷布條（文字貼圖繞一圈）
    const { tex } = textTexture('SALE ★ 50% OFF ★ ', { color: '#ffffff', bg: '#e8322d', size: 64 });
    const bt = tex.clone(); bt.wrapS = THREE.RepeatWrapping; bt.repeat.set(3, 1); bt.needsUpdate = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.47 * s, 1.47 * s, 0.42, 32, 1, true), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide }));
    band.position.y = 3.22; L.add(band);
    // 吊牌
    const signs = ['SALE', '50% OFF', 'BOGO', 'DEAL!'];
    const cards = [];
    signs.forEach((txt, i) => {
      const a = i * HALF + Math.PI / 4, r = 1.45 * s;
      const c = new THREE.Group(); c.position.set(Math.cos(a) * r, 3.42, Math.sin(a) * r); c.rotation.y = -a + HALF;
      c.add(rod([0, -0.2, 0], [0, -0.4, 0], 0.01, 0x2b2540, { outline: false }),
        box(0.8, 0.44, 0.04, i % 2 ? 0xff4f9e : 0xffd23f, 0, -0.62, 0),
        label(txt, 0.68, { color: i % 2 ? '#fff' : '#d0102a', size: 56 }, 0, -0.62, 0.025),
        label(txt, 0.68, { color: i % 2 ? '#fff' : '#d0102a', size: 56 }, 0, -0.62, -0.025, Math.PI));
      cards.push(c); L.add(c);
    });
    // 水晶墜
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2, r = 1.1 * s; L.add(R(cone(0.07, 0.3, 0, Math.cos(a) * r, 3.15, Math.sin(a) * r, { mat: flat(0xbff4ff), seg: 4, outline: false }), Math.PI)); }
    g.userData.anim = t => {
      pivot.rotation.z = Math.sin(t * 0.9) * 0.025; pivot.rotation.x = Math.sin(t * 0.7 + 1) * 0.02;
      const on = Math.floor(t * 3) % 2; bulbs[0].visible = !!on; bulbs[1].visible = !on;
      cards.forEach((c, i) => (c.rotation.z = Math.sin(t * 1.7 + i) * 0.08));
    };
    return g;
  },

  // 裝滿熱油的巨型兒童餐玩具球（懸掛：2×3 格，底部約 2.7 m）
  toyball(w, d) {
    const rx = Math.max(0.7, 0.75 * w), rz = Math.max(0.7, 0.75 * d), ry = Math.max(0.65, 0.65 * Math.min(w, d));
    const cy = 2.7 + ry;
    const g = new THREE.Group();
    const pivot = new THREE.Group(); pivot.position.y = 7; g.add(pivot);
    const L = new THREE.Group(); L.position.y = -7; pivot.add(L);
    // 熱油（下半球）＋油面
    const oilGeo = new THREE.SphereGeometry(0.94, 20, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
    const oil = part(oilGeo, 0xff8a00, { outline: false, emissive: 0x8a3000, emissiveIntensity: 0.5 });
    const surf = new THREE.Mesh(new THREE.CircleGeometry(0.93, 24), flat(0xffc21f)); surf.rotation.x = -HALF; surf.position.y = Math.cos(Math.PI * 0.45) * 0.94;
    const oilG = new THREE.Group(); oilG.add(oil, surf); S(oilG, rx, ry, rz); oilG.position.y = cy;
    // 外殼（上半透明、下半紅色條紋）
    const shell = part(new THREE.SphereGeometry(1, 24, 16), 0xbff4ff, { transparent: true, opacity: 0.3, outline: false });
    S(shell, rx, ry, rz); shell.position.y = cy;
    const seam = R(torus(1, 0.06, 0xe8322d, 0, cy, 0, { seg: 32 }), HALF); S(seam, rx, rz, 1);
    const band = R(torus(1, 0.04, 0xffd23f, 0, cy, 0, { seg: 32 }), 0, HALF, 0); S(band, rz, ry, 1);
    const cap = cyl(0.3, 0.42, 0.25, 0xe8322d, 0, cy + ry - 0.02, 0, { seg: 12 });
    const ring = R(torus(0.16, 0.05, 0x5d636e, 0, cy + ry + 0.25, 0), 0, 0, 0);
    L.add(oilG, shell, seam, band, cap, ring);
    const topY = cy + ry + 0.42;
    L.add(chain(0, 7.6, 0, 7.6 - topY + 0.05));
    L.add(label('HOT OIL!', 1.2, { color: '#ffffff', stroke: '#c0102a', size: 64 }, 0, cy + ry * 0.4, rz * 0.94, 0, -0.35));
    L.add(label('KIDS MEAL TOY', 1.2, { color: '#ffd23f', stroke: '#c0102a', size: 48 }, rx * 0.96, cy + ry * 0.2, 0, HALF, -0.2));
    // 油泡與玩具小人
    const bubbles = [];
    for (let i = 0; i < 6; i++) { const b = sphere(0.08, 0, 0, 0, 0, { mat: flat(0xfff2a0), seg: 6, outline: false }); bubbles.push(b); L.add(b); }
    const toy = group(sphere(0.2, 0xff4f9e, 0, 0, 0, { seg: 10 }), sphere(0.05, 0x111111, 0.07, 0.05, 0.17, { seg: 6, outline: false }), sphere(0.05, 0x111111, -0.07, 0.05, 0.17, { seg: 6, outline: false }));
    toy.position.set(0.2 * rx, cy - 0.05, 0.1 * rz); L.add(toy);
    g.userData.anim = t => {
      pivot.rotation.z = Math.sin(t * 0.8) * 0.03; pivot.rotation.x = Math.sin(t * 0.6 + 2) * 0.03;
      oilG.rotation.z = Math.sin(t * 1.6) * 0.06; oilG.rotation.x = Math.cos(t * 1.3) * 0.05;
      toy.rotation.y = t; toy.position.y = cy - 0.05 + Math.sin(t * 2) * 0.05;
      bubbles.forEach((b, i) => { const k = (t * 0.5 + i / 6) % 1, a = i * 2.1; b.position.set(Math.cos(a) * rx * 0.55, cy - ry * 0.8 + k * ry * 0.8, Math.sin(a) * rz * 0.55); b.scale.setScalar(0.5 + k); });
    };
    return g;
  },

  // 巨型肉錘開關閥：水泥台座、紅色大閥輪、拉桿、「肉錘」標牌
  valve() {
    const g = group(
      box(1.2, 0.75, 1.1, 0x8d8a85, 0, 0.38, 0),
      cyl(0.18, 0.18, 0.7, 0x6b737c, 0, 1.05, -0.15, { seg: 10 }),
      R(cyl(0.12, 0.12, 0.35, 0x6b737c, 0, 1.3, 0.0, { seg: 10 }), HALF),
      box(1.0, 0.28, 0.05, 0xffd23f, 0, 0.42, 0.56),
      label('肉錘', 0.6, { color: '#1b1226', size: 72 }, 0, 0.43, 0.59),
      label('PULL ▾', 0.45, { color: '#ffd23f', stroke: '#1b1226', size: 48 }, 0.6, 0.55, 0.4, HALF),
    );
    for (let i = 0; i < 6; i++) g.add(R(box(0.12, 0.3, 0.02, 0x1b1226, -0.45 + i * 0.18, 0.15, 0.56, NO), 0, 0, 0.6));
    const wheel = new THREE.Group(); wheel.position.set(0, 1.35, 0.22);
    wheel.add(torus(0.55, 0.08, 0xe8322d, 0, 0, 0, { seg: 24 }), cyl(0.13, 0.13, 0.14, 0xb81f1f, 0, 0, 0, { seg: 10 }));
    wheel.children[1].rotation.x = HALF;
    for (let i = 0; i < 4; i++) { const a = i * HALF; wheel.add(rod([0, 0, 0], [Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0], 0.045, 0xe8322d)); }
    for (let i = 0; i < 4; i++) { const a = i * HALF + Math.PI / 4; wheel.add(sphere(0.07, 0xffd23f, Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0, { seg: 8 })); }
    g.add(wheel);
    const lever = new THREE.Group(); lever.position.set(0.5, 0.78, 0.0);
    lever.add(box(0.2, 0.12, 0.3, 0x3a3a44, 0, 0, 0), rod([0, 0, 0], [0.15, 0.75, 0], 0.04, 0xb8c0c8), sphere(0.12, 0xe8322d, 0.15, 0.78, 0, { seg: 10 }));
    g.add(lever);
    g.userData.anim = t => { wheel.rotation.z = Math.sin(t * 0.5) * 0.15; lever.rotation.z = Math.sin(t * 0.9) * 0.04; };
    return g;
  },

  // 不死專利伺服器塔：黑色巨碑、閃爍 LED、專利金印、側面風扇
  server() {
    const g = group(
      box(1.4, 3.5, 1.2, 0x17181f, 0, 1.75, 0),
      box(1.46, 0.18, 1.26, 0x2fbf71, 0, 3.45, 0),
      box(1.46, 0.12, 1.26, 0x2fbf71, 0, 0.06, 0),
      box(1.2, 0.08, 1.0, 0x4af0ff, 0, 3.58, 0, { mat: flat(0x4af0ff), outline: false }),
      cyl(0.3, 0.3, 0.04, 0xffc531, 0, 2.85, 0.61, { seg: 16 }),
      label('PATENT\nPENDING\nFOREVER', 0.42, { color: '#5a3a00', size: 40 }, 0, 2.85, 0.64),
    );
    g.children[4].rotation.x = HALF;
    const leds = [[], [], []];
    const cols = [0x3dff7a, 0x4af0ff, 0xff4f9e];
    for (let r = 0; r < 6; r++) {
      const y = 0.45 + r * 0.36;
      g.add(box(1.2, 0.28, 0.05, 0x2a2d36, 0, y, 0.61, NO));
      for (let c = 0; c < 6; c++) { const b = new THREE.BoxGeometry(0.07, 0.07, 0.03); b.translate(-0.48 + c * 0.11, y + 0.04, 0.645); leds[(r * 5 + c * 7) % 3].push(b); }
      const vent = new THREE.BoxGeometry(0.4, 0.04, 0.03); vent.translate(0.3, y - 0.06, 0.64); leds[r % 3].push(vent);
    }
    // 側面同樣一排
    for (let r = 0; r < 8; r++) { const b = new THREE.BoxGeometry(0.03, 0.06, 0.08); b.translate(0.715, 0.5 + r * 0.32, 0.35); leds[r % 3].push(b); }
    const ledMeshes = leds.map((gs, i) => { const m = new THREE.Mesh(merge(gs), flat(cols[i])); g.add(m); return m; });
    // 風扇
    const fan = new THREE.Group(); fan.position.set(0.71, 2.6, -0.2); fan.rotation.z = -HALF;
    fan.add(R(torus(0.3, 0.04, 0x5d636e), HALF));
    for (let i = 0; i < 4; i++) { const bl = box(0.26, 0.02, 0.1, 0x8b95a1, 0, 0, 0, NO); bl.position.set(Math.cos(i * HALF) * 0.13, 0, Math.sin(i * HALF) * 0.13); bl.rotation.set(0.5, -i * HALF, 0); fan.add(bl); }
    g.add(fan);
    // 背後垂落的粗線
    g.add(tube([[-0.4, 2.8, -0.6], [-0.6, 1.6, -0.9], [-0.7, 0.1, -1.1], [-0.2, 0.06, -1.3]], 0.07, 0x2b2540, { seg: 18 }));
    g.add(tube([[0.3, 3.0, -0.6], [0.6, 1.8, -0.85], [0.5, 0.08, -1.0], [0.9, 0.06, -0.8]], 0.06, 0x2fbf71, { seg: 18 }));
    g.userData.anim = t => {
      ledMeshes.forEach((m, i) => (m.visible = Math.sin(t * (4 + i * 2.3) + i * 1.7) > -0.3));
      fan.children.forEach((c, i) => { if (i) { const a = t * 9 + (i - 1) * HALF; c.position.set(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13); c.rotation.set(0.5, -a, 0); } });
    };
    return g;
  },

  // 漏電電纜：木製線軸、黑色電纜、斷頭冒火花、小水窪
  cable() {
    const g = group(
      R(cyl(0.62, 0.62, 0.08, 0xb07a45, -0.32, 0.62, 0, { seg: 16 }), 0, 0, HALF),
      R(cyl(0.62, 0.62, 0.08, 0xb07a45, 0.32, 0.62, 0, { seg: 16 }), 0, 0, HALF),
      R(cyl(0.45, 0.45, 0.56, 0x22222a, 0, 0.62, 0, { seg: 16 }), 0, 0, HALF),
      R(cyl(0.12, 0.12, 0.8, 0x8a5a33, 0, 0.62, 0, { seg: 8 }), 0, 0, HALF),
      tube([[0.1, 1.05, 0.2], [0.3, 0.9, 0.6], [0.5, 0.15, 0.7], [0.75, 0.08, 0.45], [0.75, 0.1, 0.15]], 0.06, 0x22222a, { seg: 24 }),
      R(cone(0.07, 0.16, 0xd4801f, 0.75, 0.12, 0.05, { seg: 6 }), -HALF),
    );
    const pud = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), flat(0x9dff4a, { transparent: true, opacity: 0.55 }));
    pud.rotation.x = -HALF; pud.position.set(0.65, 0.025, 0.15); pud.renderOrder = 2; g.add(pud);
    // 黃色警告牌
    g.add(rod([-0.7, 0, 0.6], [-0.7, 0.9, 0.6], 0.025, 0x6b737c), box(0.45, 0.32, 0.03, 0xffd23f, -0.7, 0.9, 0.62), label('DANGER\nHIGH VOLT', 0.38, { color: '#1b1226', size: 40 }, -0.7, 0.9, 0.64));
    const arcs = [];
    const r = rng(7);
    for (let i = 0; i < 4; i++) {
      const pts = [[0, 0, 0]]; let p = [0, 0, 0];
      const dir = [Math.cos(i * 1.7) * 0.16, 0.14, Math.sin(i * 1.7) * 0.16];
      for (let k = 0; k < 4; k++) { p = [p[0] + dir[0] + (r() - 0.5) * 0.12, p[1] + dir[1] + (r() - 0.5) * 0.1, p[2] + dir[2] + (r() - 0.5) * 0.12]; pts.push(p); }
      const a = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)), false, 'catmullrom', 0), 10, 0.03, 4), flat(i % 2 ? 0xfff27a : 0xbff8ff));
      a.position.set(0.75, 0.1, 0.0); arcs.push(a); g.add(a);
    }
    const flash = group(sphere(0.12, 0, 0, 0, 0, { mat: flat(0xffffff), seg: 8, outline: false }));
    for (let i = 0; i < 4; i++) flash.add(R(box(0.6, 0.05, 0.05, 0, 0, 0, 0, { mat: flat(0xfff27a), outline: false, shadow: false }), i * 0.9, i * 0.8, i * 0.45));
    flash.position.set(0.75, 0.16, 0); g.add(flash);
    g.userData.anim = t => {
      const step = Math.floor(t * 14);
      arcs.forEach((a, i) => { a.visible = ((step * 7 + i * 3) % 5) < 2; a.rotation.y = step * 1.3 + i; });
      flash.scale.setScalar(((step * 3) % 4) === 0 ? 1.3 : 0.55); flash.rotation.set(step * 0.7, step * 1.1, 0);
    };
    return g;
  },

  // 傳奇鐵板神廚阿姨：薄荷色餐館制服、白圍裙、紙帽、舉著鍋鏟
  chef() {
    const SK = 0x9a6440, UNI = 0x2fb7a8;
    const g = group(
      box(0.18, 0.1, 0.3, 0x1b1226, -0.13, 0.05, 0.04), box(0.18, 0.1, 0.3, 0x1b1226, 0.13, 0.05, 0.04),
      cyl(0.065, 0.075, 0.5, SK, -0.13, 0.33, 0, { seg: 8 }), cyl(0.065, 0.075, 0.5, SK, 0.13, 0.33, 0, { seg: 8 }),
      cyl(0.34, 0.42, 0.55, UNI, 0, 0.82, 0, { seg: 14 }),
      S(sphere(0.36, UNI, 0, 1.12, 0, { seg: 14 }), 1, 0.85, 0.82),
      R(box(0.46, 0.62, 0.05, 0xffffff, 0, 0.86, 0.395, { r: 0.02 }), -0.14),
      box(0.2, 0.12, 0.02, 0xffd23f, -0.13, 1.18, 0.3, NO),
      label('DOT', 0.15, { color: '#1b1226', size: 40 }, -0.13, 1.18, 0.315),
      box(0.42, 0.04, 0.05, 0xffffff, 0, 1.12, 0.3, NO),
      cyl(0.09, 0.1, 0.12, SK, 0, 1.38, 0, { seg: 8 }),
      sphere(0.27, SK, 0, 1.58, 0.02, { seg: 16 }),
      sphere(0.28, 0x8c8c96, 0, 1.64, -0.06, { seg: 14 }),
      sphere(0.15, 0x8c8c96, 0, 1.72, -0.3, { seg: 10 }),
      // 紙帽
      R(cyl(0.17, 0.17, 0.5, 0xffffff, 0, 1.95, -0.04, { seg: 3 }), -HALF, 0, HALF),
      box(0.5, 0.06, 0.22, 0xe8322d, 0, 1.87, -0.04, NO),
      // 臉
      sphere(0.04, 0x1b1226, -0.09, 1.6, 0.26, { seg: 6, outline: false }), sphere(0.04, 0x1b1226, 0.09, 1.6, 0.26, { seg: 6, outline: false }),
      box(0.12, 0.025, 0.02, 0x7a1a1a, 0, 1.47, 0.27, NO),
      S(sphere(0.045, 0xff7f6a, -0.16, 1.52, 0.22, { seg: 6, outline: false }), 1, 0.6, 0.5), S(sphere(0.045, 0xff7f6a, 0.16, 1.52, 0.22, { seg: 6, outline: false }), 1, 0.6, 0.5),
      torus(0.05, 0.01, 0x1b1226, -0.09, 1.6, 0.27, { seg: 10, outline: false }), torus(0.05, 0.01, 0x1b1226, 0.09, 1.6, 0.27, { seg: 10, outline: false }),
      // 左手叉腰
      rod([-0.33, 1.22, 0], [-0.45, 0.98, 0.05], 0.065, UNI), rod([-0.45, 0.98, 0.05], [-0.3, 0.86, 0.12], 0.055, SK),
    );
    const arm = new THREE.Group(); arm.position.set(0.33, 1.24, 0);
    arm.add(rod([0, 0, 0], [0.18, 0.22, 0.08], 0.065, UNI), rod([0.18, 0.22, 0.08], [0.22, 0.48, 0.12], 0.055, SK), sphere(0.07, SK, 0.22, 0.5, 0.12, { seg: 8 }),
      rod([0.22, 0.5, 0.12], [0.24, 0.85, 0.14], 0.025, 0x1b1226), box(0.22, 0.28, 0.03, 0xd8dde3, 0.25, 1.0, 0.15, { r: 0.012 }));
    g.add(arm);
    g.userData.height = 2.1;
    g.userData.anim = t => { arm.rotation.z = Math.sin(t * 2.2) * 0.12; arm.rotation.x = -Math.abs(Math.sin(t * 2.2)) * 0.1; };
    return g;
  },

  // 第 7 關中央的巨型肉錘（頭 3×3 m，底部約 5 m，鐵鍊吊起）
  hammer() {
    const g = new THREE.Group();
    const pivot = new THREE.Group(); pivot.position.y = 14; g.add(pivot);
    const H = new THREE.Group(); H.position.y = -14; pivot.add(H);
    H.add(
      box(3.0, 1.4, 3.0, 0x8f959e, 0, 6.2, 0, { r: 0.12 }),
      box(3.08, 0.42, 3.08, 0xffd23f, 0, 6.2, 0, { r: 0.06 }),
      cyl(0.32, 0.38, 4.2, 0xa0652f, 0, 9.0, 0, { seg: 12 }),
      cyl(0.36, 0.36, 0.35, 0xe8322d, 0, 8.0, 0, { seg: 12 }),
      cyl(0.36, 0.36, 0.35, 0xe8322d, 0, 9.6, 0, { seg: 12 }),
      cyl(0.48, 0.48, 0.3, 0x4a4f58, 0, 7.05, 0, { seg: 12 }),
      R(torus(0.35, 0.09, 0x4a4f58, 0, 11.35, 0), 0, 0, 0),
      label('MEAT TENDERIZER', 2.6, { color: '#1b1226', size: 64 }, 0, 6.2, 1.55),
      label('MEAT TENDERIZER', 2.6, { color: '#1b1226', size: 64 }, 1.55, 6.2, 0, HALF),
    );
    // 錘面金字塔釘（尖端在 y≈5）
    const spikes = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const g2 = new THREE.ConeGeometry(0.62, 0.5, 4); g2.rotateY(Math.PI / 4); g2.rotateX(Math.PI); g2.translate(-1.0 + i * 1.0, 5.25, -1.0 + j * 1.0); spikes.push(g2);
    }
    H.add(part(merge(spikes), 0xb8c0c8));
    // 醬汁殘漬
    H.add(S(sphere(0.18, 0x8a1a0a, -0.9, 5.15, 0.4, { seg: 8 }), 1, 1.4, 1), S(sphere(0.14, 0x8a1a0a, 0.6, 5.1, -0.7, { seg: 8 }), 1, 1.6, 1), S(sphere(0.12, 0x8a1a0a, 0.2, 5.2, 0.95, { seg: 8 }), 1, 1.3, 1));
    // 鐵鍊：錘頭四角＋握柄頂
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) H.add(chainBetween([0, 11.5, 0], [x, 6.9, z], 0x5d636e, 1.2));
    H.add(chain(0, 16, 0, 16 - 11.5, 0x5d636e, 1.4));
    for (const [x, z] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) H.add(cyl(0.12, 0.12, 0.12, 0xffd23f, x, 6.95, z, { seg: 8 }));
    g.userData.anim = t => { pivot.rotation.z = Math.sin(t * 0.6) * 0.012; pivot.rotation.x = Math.sin(t * 0.45 + 1) * 0.01; };
    return g;
  },

  // 路邊小旗（羽毛旗）：「免運費」
  flag() {
    const g = group(
      cyl(0.28, 0.32, 0.1, 0x3a3a44, 0, 0.05, 0, { seg: 12 }),
      cyl(0.035, 0.035, 2.5, 0xd8dde3, 0, 1.3, 0, { seg: 6 }),
    );
    const ban = new THREE.Group(); ban.position.set(0, 0, 0);
    ban.add(box(0.55, 1.75, 0.03, 0xff6b1a, 0.3, 1.55, 0, { r: 0.01 }),
      box(0.55, 0.18, 0.035, 0xffd23f, 0.3, 0.75, 0, { r: 0.01 }),
      label('免\n運\n費', 0.38, { color: '#fff', stroke: '#8a2a00', size: 64 }, 0.3, 1.6, 0.02),
      label('免\n運\n費', 0.38, { color: '#fff', stroke: '#8a2a00', size: 64 }, 0.3, 1.6, -0.02, Math.PI));
    g.add(ban);
    g.userData.anim = t => { ban.rotation.y = Math.sin(t * 1.9) * 0.25; };
    return g;
  },
};

// 依 w×d 自動拉伸（只為 1×1 設計的道具）
const SIZED = new Set(['wreck', 'chandelier', 'toyball', 'hammer']);

export function buildProp(type, w = 1, d = 1) {
  const f = PB[type];
  let g = null;
  try { g = f ? f(w, d) : null; } catch (e) { console.warn('prop', type, e); g = null; }
  if (!g) g = group(box(1, 1, 1, 0xff00ff, 0, 0.5, 0));
  if (!SIZED.has(type) && (w !== 1 || d !== 1)) {
    const inner = new THREE.Group(); while (g.children.length) inner.add(g.children[0]);
    inner.scale.set(w, Math.min(w, d), d); g.add(inner);
  }
  g.userData.key = g.userData.type = type;
  if (g.userData.anim) g.userData.anim(0); // 建構當下擺好初始姿勢
  return g;
}

// ── 地表貼花 ─────────────────────────────────────────
// 近方形的不規則圓角輪廓（超橢圓＋波動），鋪滿 2×2 m 一格並略微溢出，讓相鄰格連成一池
function blobShape(r, seed, wob = 0.05, n = 5) {
  const pts = [], N = 48;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const se = Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), -1 / n);
    const k = 1 + wob * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 2.3) * 0.4);
    pts.push(new THREE.Vector2(c * se * r * k, s * se * r * k));
  }
  return new THREE.Shape(pts);
}
function flatGeo(shape) { const g = new THREE.ShapeGeometry(shape, 1); g.rotateX(-HALF); return g; }
function ellipse(rx, rz, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 16), o.mat || flat(color, o));
  m.rotation.x = -HALF; m.scale.set(rx, rz, 1); m.position.set(x, y, z); m.renderOrder = o.order ?? 3;
  return m;
}
function decal(geo, mat, y, order) {
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y; m.renderOrder = order; m.receiveShadow = true;
  return m;
}
// 標準水窪：深色外緣＋主色＋高光
function puddle(color, rim, o = {}) {
  const g = new THREE.Group();
  const seed = Math.random() * 10;
  g.add(decal(flatGeo(blobShape(1.13, seed, 0.035, 9)), toon(rim), 0.02, 1));
  g.add(decal(flatGeo(blobShape(1.08, seed + 1.3, 0.03, 9)), o.mat || toon(color, o.m || {}), 0.034, 2));
  if (o.inner) g.add(decal(flatGeo(blobShape(0.62, seed + 2.1, 0.12, 2.6)), toon(o.inner), 0.042, 3));
  const r = rng(Math.floor(seed * 1000));
  const hl = o.hl ?? 0xffffff;
  // 高光：全部合成一個網格（省 draw call）；hlMesh 可由各地表做緩慢漂移
  const hg = [];
  const ell = (rx, rz, x, z) => { const c = new THREE.CircleGeometry(1, 14); c.rotateX(-HALF); c.scale(rx, 1, rz); c.translate(x, 0, z); hg.push(c); };
  for (let i = 0; i < (o.nhl ?? 3); i++) {
    const x = (r() - 0.5) * 1.2, z = (r() - 0.5) * 1.2;
    ell(0.16 + r() * 0.12, 0.06 + r() * 0.04, x, z); ell(0.05, 0.05, x + 0.25, z - 0.04);
  }
  // 外緣乾掉的濺點
  const sp = [];
  for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = 1.08 + r() * 0.18, c = new THREE.CircleGeometry(0.05 + r() * 0.06, 8); c.rotateX(-HALF); c.translate(Math.cos(a) * d, 0, Math.sin(a) * d); sp.push(c); }
  g.add(decal(merge(sp), toon(rim), 0.021, 1));
  if (hg.length) { const hm = decal(merge(hg), flat(hl, { transparent: true, opacity: 0.75 }), 0.05, 3); hm.receiveShadow = false; g.add(hm); g.userData.hl = hm; }
  g.userData.rand = r;
  return g;
}
// 冒泡（球從液面鼓起再消失）；o.rise=true 改成往上飄的汽水氣泡。一組泡泡＝一個 InstancedMesh
let _bubGeo = null;
function bubbler(g, n, color, maxR, o = {}) {
  const r = g.userData.rand || Math.random;
  const geo = _bubGeo || (_bubGeo = new THREE.SphereGeometry(1, 8, 6));
  const m = new THREE.InstancedMesh(geo, toon(color), n);
  m.castShadow = false; m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 4;
  g.add(m);
  if (o.outline) { const ol = new THREE.InstancedMesh(geo, instOutline(), n); ol.instanceMatrix = m.instanceMatrix; ol.frustumCulled = false; ol.raycast = () => {}; g.add(ol); }
  const B = [];
  for (let i = 0; i < n; i++) B.push([(r() - 0.5) * 1.4, (r() - 0.5) * 1.4, r(), 0.5 + r() * 0.6]);
  const d = new THREE.Object3D();
  const f = t => {
    B.forEach(([x, z, ph, sp], i) => {
      const k = (t * sp * (o.rise ? 1.6 : 1) + ph) % 1;
      if (o.rise) { const s = maxR * (k < 0.9 ? 0.6 + k * 0.5 : (1 - k) * 10); d.position.set(x + Math.sin(k * 9 + ph * 6) * 0.04, 0.05 + k * 0.45, z); d.scale.setScalar(Math.max(0.001, s)); }
      else { const s = k < 0.85 ? maxR * (0.2 + k) : maxR * 1.2 * (1 - (k - 0.85) / 0.15) + 0.001; d.position.set(x, 0.04, z); d.scale.set(s, s * 0.6, s); }
      d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  };
  f(0);
  return f;
}

const SB = {
  soda() {
    const g = puddle(0xa8dcff, 0x5ea9e0, { inner: 0xd6f0ff });
    const pop = bubbler(g, 5, 0xffffff, 0.05);
    const fizz = bubbler(g, 8, 0xeaf8ff, 0.035, { rise: true });
    const hl = g.userData.hl;
    const bub = t => { pop(t); fizz(t); if (hl) hl.rotation.y = Math.sin(t * 0.6) * 0.06; };
    // 壓扁的紙杯＋吸管
    if (Math.random() < 0.4) g.add(R(cyl(0.16, 0.12, 0.34, 0xffffff, 0.45, 0.14, -0.4, { seg: 10 }), 0, 0.3, HALF), R(box(0.34, 0.08, 0.02, 0xe8322d, 0.45, 0.14, -0.27, NO), 0, 0.3, 0),
      rod([0.25, 0.1, -0.35], [-0.05, 0.08, -0.15], 0.025, 0xff4f9e, { outline: false }));
    g.userData.anim = bub;
    return g;
  },
  grease() {
    const g = puddle(0xe8b64a, 0xa06a14, { inner: 0xf6d27a, hl: 0xfff6c8 });
    // 漂浮的薯條
    const r = g.userData.rand;
    const fries = [];
    for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) { const f = box(0.42, 0.07, 0.07, 0xffd23f, (r() - 0.5) * 1.2, 0.07, (r() - 0.5) * 1.2, { r: 0.02, shadow: false }); f.rotation.y = r() * 3; fries.push(f); g.add(f); }
    // 彩虹油膜
    const sheen = [ellipse(0.3, 0.14, 0xff9de0, -0.2, 0.046, 0.3, { transparent: true, opacity: 0.35 }), ellipse(0.25, 0.1, 0x9dfff0, 0.25, 0.046, -0.3, { transparent: true, opacity: 0.35 }), ellipse(0.2, 0.12, 0xfff29d, 0.1, 0.047, 0.05, { transparent: true, opacity: 0.3 })];
    g.add(...sheen);
    const fy = fries.map(f => f.rotation.y);
    g.userData.anim = t => {
      fries.forEach((f, i) => { f.position.y = 0.07 + Math.sin(t * 1.5 + i) * 0.012; f.rotation.y = fy[i] + Math.sin(t * 0.3 + i) * 0.25; });
      // 彩虹油膜慢慢漂移伸縮
      sheen.forEach((e, i) => { e.position.x = [-0.2, 0.25, 0.1][i] + Math.sin(t * 0.4 + i * 2) * 0.12; e.position.z = [0.3, -0.3, 0.05][i] + Math.cos(t * 0.33 + i) * 0.1; e.rotation.z = t * 0.2 + i; });
    };
    return g;
  },
  energy() {
    const g = puddle(0x9dff4a, 0x4aa81a, { inner: 0xcfff8a, hl: 0xf4ffe0 });
    const pop = bubbler(g, 5, 0xeaffc0, 0.06);
    // 一閃一閃的小電星
    const r = g.userData.rand, stars = [];
    for (let i = 0; i < 3; i++) {
      const s = group(box(0.22, 0.012, 0.03, 0, 0, 0, 0, { mat: flat(0xffffff), outline: false, shadow: false }), box(0.03, 0.012, 0.22, 0, 0, 0, 0, { mat: flat(0xffffff), outline: false, shadow: false }));
      s.position.set((r() - 0.5) * 1.3, 0.06, (r() - 0.5) * 1.3); s.userData.ph = r() * 6; stars.push(s); g.add(s);
    }
    const bub = t => { pop(t); stars.forEach(s => { const k = Math.max(0, Math.sin(t * 2.3 + s.userData.ph)) ** 6; s.scale.setScalar(0.05 + k); s.rotation.y = t + s.userData.ph; }); };
    // 翻倒的能量飲罐（銀罐橘帶）
    if (Math.random() < 0.4) g.add(R(cyl(0.11, 0.11, 0.36, 0xd8dde3, -0.45, 0.12, 0.42, { seg: 10 }), 0, 0.8, HALF),
      R(cyl(0.112, 0.112, 0.14, 0xff6b1a, -0.45, 0.12, 0.42, { seg: 10, outline: false }), 0, 0.8, HALF));
    g.userData.anim = bub;
    return g;
  },
  cheese() {
    const g = puddle(0xffb41f, 0xc0700a, { inner: 0xffd36a, hl: 0xfff2b0 });
    const r = g.userData.rand;
    for (let i = 0; i < 4; i++) g.add(ellipse(0.1 + r() * 0.08, 0.1 + r() * 0.06, 0xc0700a, (r() - 0.5) * 1.3, 0.047, (r() - 0.5) * 1.3, { order: 3 }));
    for (let i = 0; i < 5; i++) g.add(ellipse(0.05, 0.05, 0x6fbf3a, (r() - 0.5) * 1.5, 0.048, (r() - 0.5) * 1.5, { order: 4 }));
    g.userData.anim = bubbler(g, 5, 0xffe08a, 0.08, { outline: true });
    return g;
  },
  slime() {
    const g = puddle(0x5ef05a, 0x1f9a2a, { inner: 0x9dff8a, hl: 0xe8ffe0 });
    g.userData.anim = bubbler(g, 6, 0x8aff7a, 0.09, { outline: true });
    return g;
  },
  sludge() {
    const g = puddle(0x3a7cff, 0x1a3a9a, { inner: 0x6aa2ff, hl: 0xd8e8ff });
    const bub = bubbler(g, 5, 0x6aa2ff, 0.08, { outline: true });
    // 漂浮的衛生紙
    const tp = R(box(0.28, 0.02, 0.14, 0xffffff, 0.35, 0.06, 0.3, { shadow: false }), 0, 0.5, 0);
    if (Math.random() < 0.5) g.add(tp);
    // 臭氣線
    const stink = [];
    for (let i = 0; i < 2; i++) { const s = tube([[0, 0, 0], [0.06, 0.12, 0], [-0.05, 0.24, 0], [0.05, 0.36, 0]], 0.02, 0x9ad94a, { mat: flat(0x9ad94a), outline: false, seg: 10 }); s.position.set(-0.4 + i * 0.7, 0.1, -0.2 + i * 0.3); stink.push(s); g.add(s); }
    g.userData.anim = t => { bub(t); stink.forEach((s, i) => { const k = (t * 0.5 + i * 0.5) % 1; s.position.y = 0.05 + k * 0.5; s.scale.setScalar(Math.sin(k * Math.PI) + 0.01); }); tp.rotation.y = 0.5 + Math.sin(t * 0.7) * 0.2; };
    return g;
  },
  mud() {
    const g = puddle(0x8a6038, 0x5a3a1c, { inner: 0x6e4a28, nhl: 1, hl: 0xc9a27a });
    // 輪胎痕
    const tg = [];
    for (const x of [-0.35, 0.35]) for (let i = 0; i < 5; i++) { const b = new THREE.BoxGeometry(0.3, 0.02, 0.1); b.rotateY(0.15); b.translate(x, 0.05, -0.8 + i * 0.4); tg.push(b); }
    const tm = new THREE.Mesh(merge(tg), toon(0x4a2e14)); tm.renderOrder = 4; g.add(tm);
    const r = g.userData.rand;
    for (let i = 0; i < 4; i++) { const m = S(sphere(0.12 + r() * 0.08, 0x7a5230, (r() - 0.5) * 1.5, 0.03, (r() - 0.5) * 1.5, { seg: 8 }), 1, 0.4, 1); m.castShadow = false; g.add(m); }
    g.children.forEach(c => { if (c.renderOrder === 0 && c.isMesh) c.renderOrder = 4; });
    return g;
  },
  // 膽固醇地獄火海：橘紅焦痕＋跳動火焰
  fire() {
    const g = puddle(0xff6a1f, 0x8a2008, { mat: flat(0xff6a1f), inner: 0xffc23a, nhl: 0 });
    g.children[2].material = flat(0xffc23a);
    const r = g.userData.rand;
    const flames = [];
    const spots = [[-0.45, -0.4], [0.5, -0.3], [-0.1, 0.5], [0.55, 0.6]].slice(0, 3 + (r() < 0.5 ? 1 : 0));
    spots.forEach(([x, z], i) => {
      const f = new THREE.Group(); f.position.set(x + (r() - 0.5) * 0.2, 0.03, z + (r() - 0.5) * 0.2);
      const h = 0.6 + r() * 0.45;
      f.add(part(flameGeo(0.3, h), 0, { mat: flat(0xff4a12) }),
        P(part(flameGeo(0.2, h * 0.72), 0, { mat: flat(0xffb21f), outline: false }), 0.02, 0.01, 0.1),
        P(part(flameGeo(0.1, h * 0.42), 0, { mat: flat(0xfff2a0), outline: false }), 0.03, 0.02, 0.2));
      f.children.forEach(c => (c.castShadow = false));
      f.userData.ph = r() * 6; f.userData.h = h; flames.push(f); g.add(f);
    });
    // 火星：單一 InstancedMesh
    const EM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 5, 4), flat(0xffe14f), 6); EM.frustumCulled = false; EM.raycast = () => {}; EM.castShadow = false; g.add(EM);
    const ed = new THREE.Object3D();
    const embers = [];
    for (let i = 0; i < 6; i++) embers.push({ userData: { ph: r(), x: (r() - 0.5) * 1.4, z: (r() - 0.5) * 1.4 }, position: ed.position, scale: ed.scale, i });
    const glow = ellipse(1.15, 1.15, 0xffb21f, 0, 0.044, 0, { transparent: true, opacity: 0.35, order: 3 });
    g.add(glow);
    g.userData.anim = t => {
      glow.scale.setScalar(1.0 + Math.sin(t * 7) * 0.05 + Math.sin(t * 13) * 0.03);
      flames.forEach(f => { const p = f.userData.ph; f.scale.set(1 + Math.sin(t * 11 + p) * 0.1, 1 + Math.sin(t * 9 + p) * 0.22 + Math.sin(t * 23 + p) * 0.06, 1 + Math.cos(t * 10 + p) * 0.1); f.rotation.y = t * 1.5 + p; });
      embers.forEach(e => { const k = (t * 0.6 + e.userData.ph) % 1; e.position.set(e.userData.x + Math.sin(k * 9) * 0.08, 0.1 + k * 1.4, e.userData.z); e.scale.setScalar(Math.max(0.001, 1 - k)); ed.updateMatrix(); EM.setMatrixAt(e.i, ed.matrix); });
      EM.instanceMatrix.needsUpdate = true;
    };
    return g;
  },
  // 咖啡因高壓電網：深色水面＋跳動電弧
  shock() {
    const g = puddle(0x1e5a8a, 0x0e2a48, { inner: 0x2f8cc8, hl: 0x9ff4ff });
    const r = g.userData.rand;
    // 地面電網線
    for (let i = 0; i < 3; i++) g.add(R(box(1.7, 0.01, 0.025, 0x4af0ff, 0, 0.048, -0.6 + i * 0.6, { mat: flat(0x4af0ff), outline: false, shadow: false }), 0, 0.15 * (i - 1), 0));
    const arcs = [];
    for (let i = 0; i < 5; i++) {
      const a0 = r() * Math.PI * 2, a1 = a0 + 1.5 + r() * 2;
      const A = [Math.cos(a0) * 0.75, 0.05, Math.sin(a0) * 0.75], B = [Math.cos(a1) * 0.75, 0.05, Math.sin(a1) * 0.75];
      const pts = [];
      for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push(new THREE.Vector3(A[0] + (B[0] - A[0]) * u + (k % 6 ? (r() - 0.5) * 0.3 : 0), 0.05 + Math.sin(u * Math.PI) * (0.35 + r() * 0.4) + (k % 6 ? (r() - 0.5) * 0.12 : 0), A[2] + (B[2] - A[2]) * u + (k % 6 ? (r() - 0.5) * 0.3 : 0))); }
      const c = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
      const core = new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.022, 4), flat(0xf0ffff));
      const glow = new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.07, 5), flat(0x4af0ff, { transparent: true, opacity: 0.45 }));
      const arc = group(core, glow); arcs.push(arc); g.add(arc);
    }
    const flash = ellipse(1.05, 1.05, 0xbff8ff, 0, 0.049, 0, { transparent: true, opacity: 0.4, order: 4 });
    g.add(flash);
    g.userData.anim = t => {
      const step = Math.floor(t * 12);
      arcs.forEach((a, i) => { a.visible = ((step + i * 3) % 5) < 2; a.rotation.y = ((step * 7 + i * 5) % 8) * Math.PI / 4; });
      flash.visible = (step % 7) === 0;
    };
    return g;
  },
  // 生化毒氣沼澤：黃綠水面＋蓬鬆半透明毒雲
  toxic() {
    const g = puddle(0xa8d020, 0x5a7a10, { inner: 0xd0f04a, hl: 0xf4ffc0 });
    const r = g.userData.rand;
    const puffs = [];
    const cloudMat = toon(0xc4e85a, { transparent: true, opacity: 0.5 });
    const darkMat = toon(0x8ab830, { transparent: true, opacity: 0.45 });
    for (let i = 0; i < 6; i++) {
      const rad = 0.3 + r() * 0.28;
      const p = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), i % 3 ? cloudMat : darkMat);
      p.userData = { x: (r() - 0.5) * 1.1, z: (r() - 0.5) * 1.1, y: 0.25 + r() * 0.55, rad, ph: r() * 6 };
      p.renderOrder = 5; puffs.push(p); g.add(p);
    }
    const sk = textPlane('☣', 0.5, { color: '#2b3a00', size: 72 });
    sk.rotation.x = -HALF; sk.position.y = 0.05; sk.renderOrder = 4; g.add(sk);
    g.userData.anim = t => puffs.forEach(p => { const u = p.userData; const s = u.rad * (1 + Math.sin(t * 1.2 + u.ph) * 0.12); p.scale.set(s, s * 0.82, s); p.position.set(u.x + Math.sin(t * 0.4 + u.ph) * 0.1, u.y + Math.sin(t * 0.8 + u.ph) * 0.08, u.z + Math.cos(t * 0.35 + u.ph) * 0.1); });
    return g;
  },
  // 沸騰甜辣烤肉醬池（熔岩）
  lava() {
    const g = puddle(0x8a1a0a, 0x3a0804, { inner: 0xb8300e, hl: 0xff9a6a, nhl: 2 });
    g.children[1].material = toon(0x8a1a0a, { emissive: 0x3a0600, emissiveIntensity: 0.6 });
    g.children[2].material = toon(0xc2381a, { emissive: 0x5a1000, emissiveIntensity: 0.7 });
    const bub = bubbler(g, 7, 0xa8280e, 0.14, { outline: true });
    // 肋排骨頭
    const bone = group(capsule(0.05, 0.5, 0xfff1d0, 0, 0, 0, { seg: 6 }), sphere(0.08, 0xfff1d0, 0, 0.32, 0, { seg: 8 }), sphere(0.08, 0xfff1d0, 0.06, 0.3, 0, { seg: 8 }));
    bone.position.set(0.4, 0.12, -0.35); bone.rotation.set(0.3, 0, -0.9); if (Math.random() < 0.35) g.add(bone);
    const steam = [];
    for (let i = 0; i < 3; i++) { const s = sphere(0.14, 0xf2e8e0, 0, 0, 0, { transparent: true, opacity: 0.45, outline: false, seg: 8, shadow: false }); s.userData.ph = i / 3; s.userData.x = -0.4 + i * 0.4; steam.push(s); g.add(s); }
    g.userData.anim = t => { bub(t); steam.forEach(s => { const k = (t * 0.4 + s.userData.ph) % 1; s.position.set(s.userData.x + Math.sin(k * 6) * 0.1, 0.2 + k * 1.2, Math.sin(s.userData.x * 5) * 0.3); s.scale.setScalar(0.5 + k * 1.3); s.visible = k < 0.9; }); };
    return g;
  },
  // 彈出式假關閉 [X]：地上一顆粉紅大按鈕，外圈脈動光暈
  trap() {
    const g = new THREE.Group();
    const glowM = new THREE.MeshBasicMaterial({ color: 0xff2a6a, transparent: true, opacity: 0.35, depthWrite: false });
    const glow = new THREE.Mesh(flatGeo(blobShape(0.95, 0, 0, 4)), glowM); glow.position.y = 0.025; glow.renderOrder = 2;
    g.add(glow);
    const btn = box(1.15, 0.12, 1.15, 0xff2a6a, 0, 0.08, 0, { r: 0.04, shadow: false, receive: true });
    const lip = box(1.25, 0.05, 1.25, 0xb8104a, 0, 0.035, 0, { r: 0.02, shadow: false });
    const x1 = R(box(0.85, 0.06, 0.16, 0xffffff, 0, 0.15, 0, { r: 0.03, outline: false, shadow: false }), 0, Math.PI / 4, 0);
    const x2 = R(box(0.85, 0.06, 0.16, 0xffffff, 0, 0.15, 0, { r: 0.03, outline: false, shadow: false }), 0, -Math.PI / 4, 0);
    // 方括號 [ ]
    const br = [];
    for (const s of [-1, 1]) {
      br.push(box(0.08, 0.04, 0.95, 0xffffff, s * 0.82, 0.07, 0, { mat: flat(0xffffff), outline: false, shadow: false }));
      br.push(box(0.16, 0.04, 0.08, 0xffffff, s * 0.74, 0.07, 0.44, { mat: flat(0xffffff), outline: false, shadow: false }));
      br.push(box(0.16, 0.04, 0.08, 0xffffff, s * 0.74, 0.07, -0.44, { mat: flat(0xffffff), outline: false, shadow: false }));
    }
    const lab = textPlane('CLOSE AD', 0.7, { color: '#ffffff', stroke: '#b8104a', size: 48 });
    lab.rotation.x = -HALF; lab.position.set(0, 0.06, 0.82); lab.renderOrder = 4;
    g.add(lip, btn, x1, x2, ...br, lab);
    g.userData.anim = t => {
      const k = (Math.sin(t * 3) + 1) / 2;
      glowM.opacity = 0.2 + k * 0.35; glow.scale.setScalar(1 + k * 0.08);
      const press = Math.max(0, Math.sin(t * 1.4)) ** 8 * 0.04;
      btn.position.y = 0.08 - press; x1.position.y = x2.position.y = 0.15 - press;
    };
    return g;
  },
};

export function buildSurface(type) {
  const f = SB[type];
  let g = null;
  try { g = f ? f() : null; } catch (e) { console.warn('surface', type, e); g = null; }
  if (!g) { g = new THREE.Group(); g.add(decal(flatGeo(blobShape(1.0, 0)), flat(0xff00ff), 0.03, 2)); }
  g.userData.key = g.userData.type = type;
  if (g.userData.anim) g.userData.anim(0);
  return g;
}
