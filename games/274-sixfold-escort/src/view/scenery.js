// 六器鏢行 — 三張地圖的場景建模：青萍渡（河渡市集）、赤沙驛（荒漠驛站與烽燧）、偃師遺墟（上古機關城）
//
// 每張地圖回傳 { group, npcs, beaconViews, portals, colliders, update }。
// 靜態物件全部丟進一個 Kit，依材質合併成十來個 mesh；會動的（船、旗、火）另外做。
// 玩法沒有碰撞，可走範圍是 |x|,|z| ≤ 25.5：大建築放在範圍外或邊緣，範圍內只放走過去也不突兀的低矮物件。
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, uv, float, vec3, sin, time, smoothstep, mx_noise_float, positionLocal, mix, color } from 'three/tsl';
import { Kit, T, rng, roofGeo, roofRidges, textTexture, pennantTexture, decalMaterial, gearShape, MAT } from './kit.js';
import { lumpGeo } from './creatures.js';
import { makeWaterMaterial, groundHeight } from './shaders.js';
import { Batch } from './assets.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ── 共用小物件 ──
function flipGeo(g) {
  const ng = g.index ? g.toNonIndexed() : g.clone();
  const p = ng.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) {
    for (let j = 0; j < 3; j++) { const t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t; }
  }
  ng.computeVertexNormals();
  return ng;
}

// 中式木構建築（面向 +z，長邊沿 x）。opts：w 面寬、d 進深、h 簷高、rise 屋頂高、base 台基高、front：'shop'|'doors'|'open'|'wall'
function building(k, M, { w = 8, d = 5, h = 3.2, rise = 1.6, base = 0.45, front = 'doors', wall = 0xd9d0bb, pillar = 0x6e2a1c, roof = 0x3a3c3f, frame = 0x3b2a1e, curl = 0.45, bays = 0, seed = 1 } = {}) {
  const b = new Kit(seed);
  b.box('stone', 0x77736a, w + 0.7, base, d + 0.7, T(0, base / 2, 0));
  b.box('stone', 0x8a857a, w + 0.8, 0.08, d + 0.8, T(0, base, 0));
  const nb = bays || Math.max(2, Math.round(w / 2.4));
  const top = base + h;
  // 柱
  for (let i = 0; i <= nb; i++) {
    const x = -w / 2 + (i * w) / nb;
    for (const z of [d / 2, -d / 2]) {
      b.cyl('wood', pillar, 0.13, 0.15, h, 10, T(x, base + h / 2, z));
      b.cyl('stone', 0x8a857a, 0.2, 0.22, 0.14, 10, T(x, base + 0.07, z)); // 柱礎
      // 斗栱（簡化：兩層出挑的木塊）
      b.box('wood', frame, 0.34, 0.14, 0.34, T(x, top + 0.07, z));
      b.box('wood', frame, 0.56, 0.1, 0.22, T(x, top + 0.19, z));
    }
  }
  // 額枋
  for (const z of [d / 2, -d / 2]) {
    b.box('wood', pillar, w + 0.2, 0.26, 0.2, T(0, top - 0.13, z));
    b.box('wood', 0x2f4a46, w + 0.1, 0.12, 0.22, T(0, top - 0.32, z)); // 一條青綠彩畫帶
  }
  for (const x of [w / 2, -w / 2]) b.box('wood', pillar, 0.2, 0.26, d + 0.2, T(x, top - 0.13, 0));
  // 牆：後牆與山牆白灰＋木框
  const wallH = h - 0.45;
  b.box('stone', wall, w, wallH, 0.12, T(0, base + wallH / 2, -d / 2 + 0.02));
  for (const sx of [-1, 1]) b.box('stone', wall, 0.12, wallH, d, T(sx * (w / 2 - 0.02), base + wallH / 2, 0));
  for (const sx of [-1, 1]) b.box('wood', frame, 0.1, 0.12, d, T(sx * (w / 2), base + 0.3, 0));
  // 正面
  for (let i = 0; i < nb; i++) {
    const x0 = -w / 2 + (i * w) / nb, x1 = -w / 2 + ((i + 1) * w) / nb;
    const cx = (x0 + x1) / 2, bw = x1 - x0 - 0.26;
    const z = d / 2 - 0.06;
    if (front === 'open') continue;
    if (front === 'wall' || (front === 'shop' && i % 2 === 1 && nb > 2)) {
      b.box('stone', wall, bw, wallH * 0.45, 0.1, T(cx, base + wallH * 0.225, z));
      lattice(b, cx, base + wallH * 0.45 + 0.05, z + 0.04, bw * 0.9, wallH * 0.5, frame);
    } else if (front === 'doors' || front === 'shop') {
      // 格扇門：上格心、下裙板
      const n = front === 'shop' ? 3 : 4;
      for (let j = 0; j < n; j++) {
        const dw = bw / n;
        const dx = x0 + 0.13 + dw * (j + 0.5);
        b.box('woodDark', 0x3a2418, dw - 0.03, wallH * 0.35, 0.06, T(dx, base + wallH * 0.175, z));
        lattice(b, dx, base + wallH * 0.37, z + 0.02, dw - 0.06, wallH * 0.6, frame, 3);
      }
    }
  }
  // 屋頂：瓦面、瓦壟、正脊、底面椽
  const roofY = top + 0.28;
  const rg = roofGeo(w + 0.4, d + 0.4, rise, { curl, overhang: 0.75 });
  b.add('stone', rg, roof, T(0, roofY, 0), 0.03);
  b.add('woodDark', flipGeo(rg), 0x2a1e16, T(0, roofY - 0.1, 0), 0.02);
  for (const rr of roofRidges(w + 0.4, d + 0.4, rise, { curl, overhang: 0.75, step: 0.36 })) b.add('stone', rr, 0x2c2e30, T(0, roofY, 0), 0.04);
  b.box('stone', 0x2a2b2d, w + 1.0, 0.28, 0.3, T(0, roofY + rise + 0.08, 0));
  for (const sx of [-1, 1]) {
    b.box('stone', 0x2a2b2d, 0.3, 0.5, 0.3, T(sx * (w / 2 + 0.55), roofY + rise + 0.25, 0, 0, 0, sx * 0.2)); // 鴟吻（簡化）
    b.cone('stone', 0x2a2b2d, 0.12, 0.4, 4, T(sx * (w / 2 + 0.68), roofY + rise + 0.55, 0, 0, 0, sx * -0.5));
  }
  k.merge(b, M);
}

// 窗格（直欞＋橫欞）
function lattice(k, cx, y0, z, w, h, color, cols = 4) {
  k.box('woodDark', color, w, 0.05, 0.05, T(cx, y0, z));
  k.box('woodDark', color, w, 0.05, 0.05, T(cx, y0 + h, z));
  k.box('woodDark', color, 0.05, h, 0.05, T(cx - w / 2, y0 + h / 2, z));
  k.box('woodDark', color, 0.05, h, 0.05, T(cx + w / 2, y0 + h / 2, z));
  for (let i = 1; i < cols; i++) k.box('woodDark', color, 0.025, h, 0.03, T(cx - w / 2 + (i * w) / cols, y0 + h / 2, z));
  for (let j = 1; j < 5; j++) k.box('woodDark', color, w, 0.025, 0.03, T(cx, y0 + (j * h) / 5, z));
  k.box('paper', 0x6a5a40, w, h, 0.01, T(cx, y0 + h / 2, z - 0.03)); // 窗紙（室內透出暖光）
}

function lanternPost(k, x, z, h = 2.6, rot = 0) {
  k.box('wood', 0x3d2a1c, 0.14, h, 0.14, T(x, h / 2, z));
  k.box('stone', 0x7a756a, 0.4, 0.2, 0.4, T(x, 0.1, z));
  const ax = Math.sin(rot) * 0.45, az = Math.cos(rot) * 0.45;
  k.box('wood', 0x3d2a1c, 0.08, 0.08, 0.6, T(x + ax / 2, h - 0.12, z + az / 2, 0, rot, 0));
  hangingLantern(k, x + ax, h - 0.55, z + az);
}

function hangingLantern(k, x, y, z, s = 1, col = 0xe0512e) {
  k.cyl('wood', 0x2a1c14, 0.012, 0.012, 0.22 * s, 4, T(x, y + 0.4 * s, z));
  k.cyl('woodDark', 0x1d1814, 0.1 * s, 0.13 * s, 0.05 * s, 10, T(x, y + 0.28 * s, z));
  k.sphere('paper', col, 0.21 * s, 14, 10, T(x, y, z, 0, 0, 0, 1, 1.25, 1));
  k.cyl('woodDark', 0x1d1814, 0.13 * s, 0.1 * s, 0.05 * s, 10, T(x, y - 0.28 * s, z));
  k.cyl('cloth', 0xc0392b, 0.03 * s, 0.05 * s, 0.22 * s, 6, T(x, y - 0.42 * s, z));
}

function crate(k, x, y, z, s = 0.7, ry = 0, color = 0x8a6a44) {
  k.box('wood', color, s, s, s, T(x, y + s / 2, z, 0, ry, 0), 0.12);
  for (const dy of [0.08, s - 0.08]) k.box('wood', 0x5a4028, s + 0.02, 0.07, s + 0.02, T(x, y + dy, z, 0, ry, 0));
}
function sack(k, x, y, z, s = 1, ry = 0) {
  k.sphere('cloth', 0xc2ad84, 0.32 * s, 10, 8, T(x, y + 0.24 * s, z, 0, ry, 0.1, 1, 0.75, 0.7), 0.1);
  k.cyl('cloth', 0xa8946c, 0.08 * s, 0.12 * s, 0.14 * s, 8, T(x, y + 0.5 * s, z));
}
function jar(k, x, y, z, s = 1, col = 0x5a3a24) {
  k.lathe('stone', col, [[0, 0], [0.16, 0.02], [0.22, 0.18], [0.2, 0.36], [0.11, 0.44], [0.12, 0.5], [0, 0.5]].map(([r, h]) => [r * s, h * s]), 12, T(x, y, z), 0.1);
}

// 柳樹：粗短的樹幹＋細長下垂的枝條
function willow(k, x, z, s = 1, seed = 1) {
  const R = rng(seed);
  const trunkH = 3.2 * s;
  k.tag = [x, trunkH * 0.85, z, 3.0 * s]; // 包圍球：擋鏡頭時整棵溶掉（kit.js seeThrough）
  k.add('canopyWood', new THREE.CylinderGeometry(0.22 * s, 0.38 * s, trunkH, 9), 0x4a3a2a, T(x, trunkH / 2, z, (R() - 0.5) * 0.12, 0, (R() - 0.5) * 0.12));
  for (let i = 0; i < 4; i++) {
    const a = R() * Math.PI * 2;
    k.rod('canopyWood', 0x4a3a2a, [x, trunkH * 0.85, z], [x + Math.cos(a) * 1.5 * s, trunkH + 0.9 * s, z + Math.sin(a) * 1.5 * s], 0.09 * s, 6);
  }
  // 樹冠團
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2, r = R() * 1.3 * s;
    k.add('canopy', lumpGeo(1.1 * s, 1, 0.3, seed * 10 + i), i % 2 ? 0x6f8a3a : 0x5e7a34, T(x + Math.cos(a) * r, trunkH + 0.9 * s + R() * 0.6, z + Math.sin(a) * r, 0, 0, 0, 1.2, 0.65, 1.2));
  }
  // 垂枝：細長的葉帶
  const strand = new THREE.PlaneGeometry(0.07 * s, 1, 1, 4);
  for (let i = 0; i < 130; i++) {
    const a = R() * Math.PI * 2, r = (0.8 + R() * 1.6) * s;
    const len = (1.6 + R() * 2.0) * s;
    const top = trunkH + 0.6 * s + R() * 0.9 * s;
    const sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
    k.add('canopy', strand, [0x9ab055, 0x86a04a, 0x7a9440, 0xa8b860][Math.floor(R() * 4)], T(sx, top - len / 2, sz, 0, -a + Math.PI / 2, (R() - 0.5) * 0.1, 1, len, 1), 0.12);
  }
  k.tag = null;
}

// 一叢蘆葦（三角形葉片＋蘆花穗）
function reeds(k, x, z, n = 24, r = 1.2, seed = 1, h = 1.8) {
  const R = rng(seed);
  const pos = [], col = [];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r;
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    const hh = h * (0.6 + R() * 0.6);
    const lean = (R() - 0.5) * 0.5, lean2 = (R() - 0.5) * 0.5;
    const w = 0.05;
    const ang = R() * Math.PI;
    const ox = Math.cos(ang) * w, oz = Math.sin(ang) * w;
    const tx = px + lean, tz = pz + lean2;
    pos.push(px - ox, 0, pz - oz, px + ox, 0, pz + oz, tx, hh, tz);
    const g = 0.75 + R() * 0.35;
    const base = [0.32 * g, 0.36 * g, 0.18 * g], tip = [0.62 * g, 0.6 * g, 0.36 * g];
    col.push(...base, ...base, ...tip);
    if (R() > 0.55) {
      // 蘆花穗
      const py = hh * 0.92;
      pos.push(tx - 0.04, py - 0.25, tz, tx + 0.04, py - 0.25, tz, tx + lean * 0.1, py + 0.12, tz);
      col.push(0.75, 0.68, 0.55, 0.75, 0.68, 0.55, 0.85, 0.8, 0.7);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  k.add('reed', g, 0xffffff, null, 0);
}

// 烏篷船（長軸沿 x）：船身放樣＋竹篷
function boatKit(len = 6, w = 1.5, seed = 1, ferry = false) {
  const k = new Kit(seed);
  const n = 14, m = 7;
  const pos = [];
  const pt = (i, j) => {
    const u = i / n; // 船頭→船尾
    const v = j / m; // 左舷→底→右舷
    const x = (u - 0.5) * len;
    const taper = Math.pow(Math.sin(u * Math.PI), 0.55);
    const ang = (v - 0.5) * Math.PI;
    const sheer = 0.55 + Math.pow(Math.abs(u - 0.5) * 2, 2.5) * 0.45;
    const y = -Math.cos(ang) * 0.55 + sheer;
    const z = Math.sin(ang) * (w / 2) * taper;
    return [x, y, z];
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hull.computeVertexNormals();
  k.add('woodDark', hull, 0x3a2a1c, null, 0.04);
  k.add('woodDark', flipGeo(hull), 0x5a4430, null, 0.04);
  // 船舷邊（上緣木條）
  const rim = [];
  for (let i = 0; i <= n; i++) rim.push(new THREE.Vector3(...pt(i, 0)));
  k.add('wood', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim), 20, 0.05, 4), 0x6a4a30);
  const rim2 = [];
  for (let i = 0; i <= n; i++) rim2.push(new THREE.Vector3(...pt(i, m)));
  k.add('wood', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim2), 20, 0.05, 4), 0x6a4a30);
  // 甲板：跟著船身在 y = 0.3 的內寬收窄（船頭船尾起翹，船底比甲板高的那兩段就不鋪），不從船舷穿出去
  {
    const DY = 0.3, half = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const c = (0.55 + Math.pow(Math.abs(u - 0.5) * 2, 2.5) * 0.45 - DY) / 0.55;
      if (c >= 0.995) continue;
      half.push([(u - 0.5) * len, Math.sqrt(1 - c * c) * (w / 2) * Math.pow(Math.sin(u * Math.PI), 0.55) * 0.94]);
    }
    const sh = new THREE.Shape();
    half.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    for (let i = half.length - 1; i >= 0; i--) sh.lineTo(half[i][0], -half[i][1]);
    const dg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false });
    dg.rotateX(Math.PI / 2);
    k.add('wood', dg, 0x7a5a3a, T(0, DY + 0.025, 0));
  }
  // 竹篷：一段段半圓殼（黑篷）
  const segs = ferry ? 2 : 3;
  for (let i = 0; i < segs; i++) {
    const x = (i - (segs - 1) / 2) * 0.95 - (ferry ? 0.4 : 0);
    const g = new THREE.CylinderGeometry(w * 0.47, w * 0.47, 0.9, 14, 1, true, 0, Math.PI);
    k.add('cloth', g, i === 1 ? 0x1f1d1a : 0x2a2622, T(x, 0.36, 0, 0, 0, Math.PI / 2, 1, 1, 1), 0.04);
    for (const dx of [-0.45, 0.45]) k.torus('wood', 0x5a4a2a, w * 0.47, 0.025, 4, 12, Math.PI, T(x + dx, 0.36, 0, 0, Math.PI / 2, 0));
  }
  // 竹篙、櫓
  k.rod('wood', 0x9a8a5a, [-len * 0.3, 0.45, w * 0.3], [len * 0.45, 0.62, w * 0.36], 0.03, 5);
  k.rod('wood', 0x6a4a30, [len * 0.42, 0.75, 0], [len * 0.62, 0.2, 0.1], 0.04, 5);
  if (ferry) {
    // 渡船：船尾掛一盞燈、船頭插小旗竿
    hangingLantern(k, -len * 0.4, 1.25, 0, 0.8);
    k.rod('wood', 0x3d2a1c, [-len * 0.4, 0.4, 0], [-len * 0.4, 1.7, 0], 0.03, 5);
  }
  return k;
}

// 鏢旗（三角旗＋旗桿），回傳 mesh（旗面會隨風擺）
const pennantCache = new Map();
function pennantMesh(char, len = 1.4, opts = {}) {
  const key = char + JSON.stringify(opts);
  if (!pennantCache.has(key)) pennantCache.set(key, decalMaterial(pennantTexture(char, opts), { wave: 0.18 }));
  const g = new THREE.PlaneGeometry(len, len * 0.62, 10, 2).translate(len / 2, 0, 0);
  const m = new THREE.Mesh(g, pennantCache.get(key));
  m.castShadow = true;
  return m;
}
function flagpole(k, group, x, z, h, char, len = 1.6, ry = 0, opts) {
  k.cyl('wood', 0x3d2a1c, 0.06, 0.09, h, 8, T(x, h / 2, z));
  k.cone('bronze', 0xb08d48, 0.07, 0.25, 8, T(x, h + 0.12, z));
  k.cyl('stone', 0x6e6a60, 0.3, 0.36, 0.3, 10, T(x, 0.15, z));
  const p = pennantMesh(char, len, opts);
  p.position.set(x + 0.05, h - len * 0.38, z);
  p.rotation.y = ry;
  group.add(p);
}

// 四柱三間三樓牌坊（沿 x 展開、正面朝 ±z，原點在中間開間的地面中心）
// 橫樑一律收在柱與柱之間，不伸出邊柱；三片屋頂各自獨立，中樓高、次樓低；柱腳夾杆石。
// stone=true 是石牌坊（方柱、不上漆）。回傳 { cols }：四根柱的 x，給碰撞盒用。
function paifang(k, { stone = false } = {}) {
  const inner = 1.1, outer = 3.2;
  const cols = [-outer, -inner, inner, outer];
  const colMat = stone ? 'stone' : 'wood';
  const colCol = stone ? 0x8f897c : 0x7e2c1d;     // 石：青石灰；木：棗紅漆
  const beamCol = stone ? 0x847e72 : 0x2f5650;    // 木：額枋漆青綠
  const beamCol2 = stone ? 0x7a7469 : 0x3b6a5f;
  const plateCol = stone ? 0x8a8478 : 0x6a2a1c;
  const tileCol = 0x5a5e5c;                        // 中灰青瓦，不用近黑
  const bracketCol = stone ? 0x7d776c : 0x2f5650;
  const hInner = 4.55, hOuter = 3.75;
  // 柱與夾杆石
  for (const x of cols) {
    const h = Math.abs(x) < 2 ? hInner : hOuter;
    if (stone) k.box(colMat, colCol, 0.34, h, 0.34, T(x, h / 2, 0));
    else k.cyl(colMat, colCol, 0.16, 0.18, h, 12, T(x, h / 2, 0));
    k.box('stone', 0x8a857a, 0.62, 0.16, 0.86, T(x, 0.08, 0));
    for (const sz of [-1, 1]) {
      k.box('stone', 0x7f7a6f, 0.46, 1.1, 0.16, T(x, 0.71, sz * 0.27));
      k.box('stone', 0x8a857a, 0.4, 0.1, 0.14, T(x, 1.3, sz * 0.27)); // 立石頂收一道
    }
    k.torus('iron', 0x2a2724, stone ? 0.21 : 0.19, 0.025, 4, 16, Math.PI * 2, T(x, 0.98, 0, Math.PI / 2, 0, 0)); // 鐵箍
  }
  // 一樓（一個開間）的額枋、花板、平板枋、斗栱、屋頂
  const bay = (x0, x1, yTop, roofLen, rise, sets) => {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    k.box(colMat, beamCol, w, 0.3, 0.26, T(cx, yTop - 0.15, 0));                 // 大額枋
    k.box(colMat, beamCol2, w, 0.2, 0.22, T(cx, yTop - 0.82, 0));                // 小額枋
    k.box(colMat, plateCol, w, 0.37, 0.08, T(cx, yTop - 0.485, 0));              // 花板
    k.box(colMat, plateCol, w + 0.1, 0.08, 0.46, T(cx, yTop + 0.04, 0));         // 平板枋（仍在柱距內）
    for (let i = 0; i < sets; i++) {
      const x = x0 + 0.18 + ((w - 0.36) * (i + 0.5)) / sets;
      k.box(colMat, bracketCol, 0.12, 0.09, 0.12, T(x, yTop + 0.125, 0));
      k.box(colMat, bracketCol, 0.18, 0.09, 0.3, T(x, yTop + 0.215, 0));
      k.box(colMat, bracketCol, 0.24, 0.09, 0.46, T(x, yTop + 0.305, 0));
    }
    const ry = yTop + 0.42;
    const opt = { curl: 0.28, overhang: 0.32 };
    const rg = roofGeo(roofLen, 0.7, rise, opt);
    k.add('stone', rg, tileCol, T(cx, ry, 0), 0.03);
    k.add('woodDark', flipGeo(rg), stone ? 0x3a3832 : 0x2a1e16, T(cx, ry - 0.06, 0));
    for (const rr of roofRidges(roofLen, 0.7, rise, { ...opt, step: 0.2 })) k.add('stone', rr, 0x4a4e4c, T(cx, ry, 0), 0.03);
    // 正脊＋兩端鴟吻（小剪影：立板＋回捲的尾）
    const L = roofLen / 2 + 0.1;
    k.box('stone', 0x4a4e4c, roofLen + 0.2, 0.14, 0.16, T(cx, ry + rise + 0.05, 0));
    for (const sx of [-1, 1]) {
      k.box('stone', 0x464a48, 0.16, 0.24, 0.18, T(cx + sx * L, ry + rise + 0.2, 0));
      k.box('stone', 0x464a48, 0.08, 0.2, 0.14, T(cx + sx * (L - 0.07), ry + rise + 0.36, 0, 0, 0, sx * 0.55)); // 吻尾向內捲
    }
    return ry;
  };
  bay(-inner, inner, hInner - 0.2, 2.5, 0.5, 5);
  for (const sx of [-1, 1]) {
    const a = sx * inner, b = sx * outer;
    bay(Math.min(a, b), Math.max(a, b), hOuter - 0.2, 1.75, 0.4, 4);
  }
  return { cols, signY: hInner - 0.2 - 0.485 };
}

// 傳送點：地上一圈黃銅羅盤環＋插一面寫目的地的鏢旗。
// style 'stele'（青萍渡、赤沙驛）：不發光，環邊立一塊刻目的地字的石界碑；
// style 'crack'（往偃師遺墟的地脈口、遺墟裡）：環內幾道冷綠的地縫，不用整片發光圓盤。
function portalMarker(k, group, x, z, char, style = 'stele') {
  k.torus('bronze', 0xb08d48, 1.7, 0.06, 6, 48, Math.PI * 2, T(x, 0.06, z, Math.PI / 2, 0, 0));
  k.torus('bronze', 0x8a6a34, 1.25, 0.035, 6, 40, Math.PI * 2, T(x, 0.05, z, Math.PI / 2, 0, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const L = i % 4 === 0 ? 0.36 : 0.18;
    k.box('bronze', 0xb08d48, 0.05, 0.03, L, T(x + Math.sin(a) * (1.48 - L / 2 + 0.1), 0.05, z + Math.cos(a) * (1.48 - L / 2 + 0.1), 0, a, 0));
  }
  if (style === 'crack') {
    // 地縫：五道從環心往外裂的細縫，縫底冷綠
    const R = rng(Math.round(x * 31 + z * 7) + 5);
    for (let i = 0; i < 5; i++) {
      let a = (i / 5) * Math.PI * 2 + R() * 0.6, px = x, pz = z;
      for (let s = 0; s < 3; s++) {
        const len = 0.35 + R() * 0.3;
        a += (R() - 0.5) * 0.9;
        const nx = px + Math.sin(a) * len, nz = pz + Math.cos(a) * len;
        const ry = Math.atan2(nx - px, nz - pz);
        k.box('stone', 0x2a2c28, 0.16 - s * 0.03, 0.03, len + 0.04, T((px + nx) / 2, 0.025, (pz + nz) / 2, 0, ry, 0));
        k.box('glow', 0x2fae7c, 0.06 - s * 0.012, 0.035, len, T((px + nx) / 2, 0.03, (pz + nz) / 2, 0, ry, 0));
        px = nx; pz = nz;
      }
    }
  } else {
    // 石界碑：碑座、碑身、碑帽，正面刻目的地的字
    const bx = x - 1.95, bz = z - 0.5;
    k.box('stone', 0x77736a, 0.8, 0.22, 0.5, T(bx, 0.11, bz));
    k.box('stone', 0x8d877a, 0.56, 1.35, 0.2, T(bx, 0.895, bz));
    k.box('stone', 0x6e695e, 0.68, 0.12, 0.3, T(bx, 1.63, bz));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.0), decalMaterial(textTexture(char, { w: 128, h: 300, bg: '#8d877a', fg: '#3a2a1c', border: '#6e695e', vertical: true, size: 0.78 }), { alphaTest: 0 }));
    face.position.set(bx, 0.95, bz + 0.105);
    group.add(face);
  }
  flagpole(k, group, x + 1.95, z - 0.6, 3.0, char, 1.0, 0);
}

// 火焰材質（烽火、鍛爐）
let flameMat = null;
function getFlameMat() {
  if (flameMat) return flameMat;
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const y = positionLocal.y;
  const n = mx_noise_float(vec3(positionLocal.x.mul(4), y.mul(3).sub(time.mul(4.5)), positionLocal.z.mul(4)));
  m.colorNode = mix(color(0xffb14a), color(0xe8400e), smoothstep(float(0.0), float(0.9), y)).mul(1.15);
  m.opacityNode = float(1).sub(smoothstep(float(0.1), float(1.0), y)).mul(n.mul(0.5).add(0.5)).mul(0.75);
  flameMat = m;
  return m;
}

// ════════════════════════════════════════════
// 青萍渡
// ════════════════════════════════════════════
function buildQingping({ stalls, playerStall }) {
  const group = new THREE.Group();
  const k = new Kit(11);
  const npcs = [];
  const colliders = [];
  const box = (x0, y0, z0, x1, y1, z1, soft = false) => { const b = new THREE.Box3(V3(x0, y0, z0), V3(x1, y1, z1)); b.soft = soft; colliders.push(b); return b; };
  const hFor = (c) => (Math.abs(c) < 2 ? 5.4 : 4.6); // 牌坊柱連屋頂的高度
  const fadeGroups = [];
  const mb = new Batch('qingping-models'); // 匯入模型（assets.js）：同一件擺幾次都只算一個 draw call

  // ── 北：順安鏢局（門樓、院牆、正廳、兩面大鏢旗） ──
  // 門樓
  {
    const g = new Kit(5);
    const gx = 0, gz = 21.6;
    for (const sx of [-1, 1]) {
      g.box('stone', 0xd9d0bb, 2.4, 3.4, 1.2, T(sx * 2.9, 1.7, 0));
      g.box('stone', 0x77736a, 2.5, 0.5, 1.3, T(sx * 2.9, 0.25, 0));
      g.cyl('wood', 0x7a2a1c, 0.17, 0.19, 3.8, 10, T(sx * 1.6, 1.9, 0.62));
      g.cyl('stone', 0x8a857a, 0.26, 0.28, 0.18, 10, T(sx * 1.6, 0.09, 0.62));
      // 抱鼓石
      g.box('stone', 0x8f8a80, 0.32, 0.5, 0.7, T(sx * 1.25, 0.25, 0.95));
      g.cyl('stone', 0x8f8a80, 0.35, 0.35, 0.3, 14, T(sx * 1.25, 0.72, 0.95, 0, 0, Math.PI / 2));
    }
    g.box('wood', 0x7a2a1c, 3.5, 0.3, 0.3, T(0, 3.65, 0.62));
    g.box('wood', 0x2f4a46, 3.4, 0.18, 0.32, T(0, 3.38, 0.62));
    // 大門（兩扇朱漆門＋門釘）
    for (const sx of [-1, 1]) {
      g.box('woodDark', 0x6a1e16, 1.42, 3.0, 0.1, T(sx * 0.73, 1.55, -0.1));
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) g.sphere('bronze', 0xc9a050, 0.035, 6, 4, T(sx * (0.35 + c * 0.35), 0.6 + r * 0.45, -0.03));
      g.torus('bronze', 0xc9a050, 0.08, 0.015, 5, 12, Math.PI * 2, T(sx * 0.18, 1.6, -0.02));
    }
    g.box('stone', 0x77736a, 3.6, 0.2, 1.8, T(0, 0.1, 0.3));
    for (let i = 0; i < 3; i++) g.box('stone', 0x86817a, 3.4 - i * 0.2, 0.12, 0.4, T(0, 0.06 + i * 0.12, 1.5 - i * 0.3)); // 台階
    // 屋頂
    const rg = roofGeo(8.4, 2.2, 1.3, { curl: 0.6, overhang: 0.7 });
    g.add('stone', rg, 0x34373a, T(0, 3.95, 0.1));
    g.add('woodDark', flipGeo(rg), 0x2a1e16, T(0, 3.85, 0.1));
    for (const rr of roofRidges(8.4, 2.2, 1.3, { curl: 0.6, overhang: 0.7, step: 0.34 })) g.add('stone', rr, 0x2a2c2e, T(0, 3.95, 0.1));
    g.box('stone', 0x262729, 9.2, 0.3, 0.32, T(0, 5.32, 0.1));
    for (const sx of [-1, 1]) g.cone('stone', 0x262729, 0.18, 0.55, 4, T(sx * 4.7, 5.6, 0.1, 0, 0, sx * -0.5));
    // 門樓兩側掛燈籠
    for (const sx of [-1, 1]) hangingLantern(g, sx * 2.1, 3.0, 1.1, 1.15);
    // 門樓在 g 裡以 +z 為正面建模；轉半圈讓台階、門柱、燈籠和匾額朝向南邊的街（−z）
    // 門樓單獨成一組：預設追尾鏡頭在主角北邊，主角站到門前時鏡頭落在院子上空、整座門樓擋在中間，
    // 這時整座點狀溶掉（fadeGroups，scene.js 每幀判斷），鏡頭不爬高、不拉近
    const gk = new Kit(6);
    gk.merge(g, T(gx, 0, gz, 0, Math.PI, 0));
    const gateBox = box(-4.8, 0, gz - 2.0, 4.8, 5.8, gz + 1.9, true); // 包到屋簷
    // 匾額「順安鏢局」（朝街）
    // 掛在門楣兩道枋子前面、屋簷下（舊位置 y 4.25 埋在屋頂裡看不到）
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), decalMaterial(textTexture('順安鏢局', { w: 640, h: 175, bg: '#1d1814', fg: '#d9b35a' }), { alphaTest: 0 }));
    plaque.position.set(gx, 3.5, gz - 0.86);
    plaque.rotation.y = Math.PI;
    group.add(plaque);
    gk.box('wood', 0xb08d48, 2.4, 0.76, 0.06, T(gx, 3.5, gz - 0.82));
    const gate = gk.build({ name: 'agency-gate', see: true });
    group.add(gate);
    fadeGroups.push({ box: gateBox, objs: [gate, plaque] });
  }
  // 院牆
  for (const [x0, x1] of [[-16, -4.1], [4.1, 16]]) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    k.box('stone', 0xd5ccb6, w, 2.6, 0.5, T(cx, 1.3, 21.8));
    k.box('stone', 0x77736a, w + 0.1, 0.4, 0.6, T(cx, 0.2, 21.8));
    k.box('stone', 0x34373a, w + 0.2, 0.18, 0.9, T(cx, 2.7, 21.8));
    // 牆頂瓦脊：四稜錐先在幾何上轉 45°（稜邊對齊 x、z 軸）再沿 x 拉長。T() 是先縮放後旋轉，
    // 把 45° 放進 T() 會把拉長的稜錐斜轉出牆外，在街上變成一道 6 m 長的暗色斜楔。
    k.add('stone', new THREE.CylinderGeometry(0.01, 0.48, 0.32, 4, 1).rotateY(Math.PI / 4), 0x2c2e30, T(cx, 2.95, 21.8, 0, 0, 0, w * 1.42, 1, 1));
    box(x0, 0, 21.4, x1, 3, 22.2, true);
  }
  for (const sx of [-1, 1]) {
    k.box('stone', 0xd5ccb6, 0.5, 2.6, 12, T(sx * 16, 1.3, 27.8));
    k.box('stone', 0x34373a, 0.9, 0.18, 12.2, T(sx * 16, 2.7, 27.8));
  }
  // 院內正廳與廂房（屋頂露出牆頭）
  // 正廳：匯入的歇山大殿（qp_storehouse，17.5×6.5×9.2 m，台基 0.6 m），轉半圈朝門樓。
  // 主角站在門前時鏡頭就在正廳屋頂上方，跟門樓一樣整棟溶掉
  {
    const hb = new Batch('agency-hall');
    hb.add('qp_storehouse', 0, 0, 28.9, Math.PI);
    const hall = hb.build();
    group.add(hall);
    fadeGroups.push({ box: new THREE.Box3(V3(-9, 0, 24.1), V3(9, 6.8, 33.6)), objs: [hall] });
  }
  // 兩側廂房：匯入的歇山小屋（bk_house，7.4×5.2×6.6 m，正面 +Z），轉 ±90° 正面朝院子、縮 0.89 塞進原廂房的位置（占地 5.9×6.6、高 4.6）。
  // 兩棟同一批次（一個 draw call），鏡頭穿過任一棟就整批溶掉（fadeGroups 的 boxes）
  // 院子走不進去（MAP_BLOCKERS），這幾棟只在鏡頭擋到時溶掉（soft），鏡頭不爬高
  box(-9, 0, 24.1, 9, 6.8, 33.6, true);
  {
    const wb = new Batch('agency-wings');
    const boxes = [-1, 1].map((sx) => wb.add('bk_house', sx * 12.6, 0, 27.4, sx * -Math.PI / 2, 0.89));
    if (boxes.every(Boolean)) {
      const wings = wb.build();
      group.add(wings);
      for (const b of boxes) { b.soft = true; colliders.push(b); }
      fadeGroups.push({ boxes, objs: [wings] });
    }
  }
  // 兩根大鏢旗
  flagpole(k, group, -5.2, 20.6, 7.5, '鏢', 2.6, 0);
  flagpole(k, group, 5.2, 20.6, 7.5, '安', 2.6, 0);
  // 門前一輛待發的鏢車：車上兩只樟木鏢箱，箱上一只漆盒
  mb.add('escort_cart', -8.6, 0, 17.6, 0.35);
  mb.add('camphor_chest', -8.7, 0.98, 17.65, 0.35, 0.82);
  mb.add('camphor_chest', -8.45, 1.39, 17.55, 0.25, 0.7);
  mb.add('barrel', -11.2, 0, 18.6, 0.4, 0.95);
  mb.add('bucket', -10.5, 0, 19.3, 1.2);
  // 門前右側一只落地的掐絲琺瑯三足香爐（bk_censer），在祁鏢頭與東邊大鏢旗之間，不擋縮圖鏡頭裡的主角
  mb.add('bk_censer', 3.8, 0, 19.9, Math.PI + 0.2, 1, { shadow: true });
  // 祁鏢頭與帳房阿檀（門前一張小帳桌）
  npcs.push({ id: 'npc-chief', name: '祁鏢頭', sub: '順安鏢局總鏢頭', kind: 'npc', look: { preset: 'chief', gender: 'Male', hair: 0, height: 1.03 }, x: 2.4, z: 19.2, rotY: 0.25, anim: 'idle' });
  npcs.push({ id: 'npc-clerk', name: '阿檀', sub: '帳房', kind: 'npc', look: { preset: 'clerk', gender: 'Male', hair: 1, height: 0.97 }, x: -2.9, z: 19.6, rotY: -0.2, anim: 'idle' });
  k.box('woodDark', 0x2a1e16, 1.2, 0.08, 0.6, T(-2.9, 0.8, 18.9));
  for (const [dx, dz] of [[-0.5, -0.24], [0.5, -0.24], [-0.5, 0.24], [0.5, 0.24]]) k.box('woodDark', 0x2a1e16, 0.06, 0.8, 0.06, T(-2.9 + dx, 0.4, 18.9 + dz));
  k.box('cloth', 0xe8dcc2, 0.5, 0.02, 0.35, T(-3.05, 0.85, 18.9)); // 鏢單
  k.box('woodDark', 0x1d1814, 0.24, 0.06, 0.14, T(-2.55, 0.87, 18.95)); // 算盤
  for (let i = 0; i < 5; i++) k.sphere('wood', 0x8a5a34, 0.018, 6, 4, T(-2.63 + i * 0.04, 0.91, 18.95));

  // ── 西：貨棧兩棟（面向東） ──
  building(k, T(-22.5, 0, -3.5, 0, Math.PI / 2, 0), { w: 10, d: 6, h: 3.6, rise: 1.8, front: 'shop', wall: 0xcfc4ad, seed: 31 });
  box(-26, 0, -9, -18.6, 6.5, 2);
  building(k, T(-22.5, 0, 9, 0, Math.PI / 2, 0), { w: 8, d: 6, h: 3.2, rise: 1.6, front: 'doors', wall: 0xd6ccb4, seed: 32 });
  box(-26, 0, 4.5, -18.6, 6, 13.5);
  // 貨棧門口的貨堆、板車
  {
    const R = rng(91);
    for (let i = 0; i < 9; i++) crate(k, -17.6 - R() * 1.2, 0, -7 + i * 0.85 + R() * 0.2, 0.62 + R() * 0.2, R() * 0.4, R() > 0.5 ? 0x8a6a44 : 0x7a5c3c);
    for (let i = 0; i < 4; i++) crate(k, -17.9, 0.7, -6.6 + i * 1.3, 0.6, R() * 0.3);
    for (let i = 0; i < 7; i++) sack(k, -17.2 - R(), 0, 1.0 + i * 0.6, 1, R() * 3);
    // 板車
    k.box('wood', 0x6a4a30, 2.4, 0.08, 1.2, T(-15.8, 0.7, 4.2, 0, 0.3, 0));
    for (const sz of [-1, 1]) k.torus('wood', 0x4a3420, 0.45, 0.06, 6, 16, Math.PI * 2, T(-15.6 + sz * 0.1, 0.45, 4.2 + sz * 0.62, 0, 0.3, 0));
    k.rod('wood', 0x6a4a30, [-14.7, 0.68, 3.85], [-13.0, 0.25, 3.3], 0.04);
    k.rod('wood', 0x6a4a30, [-14.5, 0.68, 4.45], [-12.8, 0.25, 3.9], 0.04);
    for (let i = 0; i < 3; i++) sack(k, -16.2 + i * 0.5, 0.74, 4.2 + (i % 2) * 0.3, 0.9, i);
  }

  // ── 東：茶棚、練功場、東門牌坊 ──
  {
    const g = new Kit(41);
    // 茶棚：四柱布頂、方桌長凳。布頂往前後兩緣垂（柱位那裡只剩 2.53 m），柱高 2.5 收在布底下，柱頭不從布面穿出
    for (const [x, z] of [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]]) g.box('wood', 0x5a4028, 0.14, 2.5, 0.14, T(x, 1.25, z));
    const canvas = new THREE.PlaneGeometry(6, 4.4, 6, 4);
    const cp = canvas.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, -Math.abs(cp.getY(i)) * 0.18 + Math.sin(cp.getX(i) * 1.2) * 0.04);
    canvas.computeVertexNormals();
    g.add('cloth', canvas, 0xcabf9c, T(0, 2.85, 0, -Math.PI / 2, 0, 0));
    g.box('wood', 0x4a3420, 6.1, 0.1, 0.1, T(0, 2.75, 0));
    for (const [x, z] of [[-1.4, -0.6], [1.3, 0.7]]) {
      g.box('wood', 0x7a5a3a, 1.0, 0.07, 1.0, T(x, 0.78, z));
      for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) g.box('wood', 0x5a4028, 0.06, 0.76, 0.06, T(x + dx, 0.38, z + dz));
    }
    // 爐灶與水缸（灶上的蒸籠、缸蓋上的鐵瓢是匯入模型，見下）
    g.box('stone', 0x6a6258, 0.9, 0.8, 0.7, T(2.2, 0.4, -1.4));
    g.lathe('stone', 0x4a3a2c, [[0, 0], [0.32, 0], [0.4, 0.4], [0.38, 0.7], [0, 0.7]], 14, T(-2.3, 0, 1.4));
    k.merge(g, T(18.8, 0, -7.5, 0, -Math.PI / 2, 0));
    // 桌上的茶碗、陶壺，棚簷掛兩盞紅燈籠（茶棚在 g 裡建模後繞 y 轉 −90°：local (x, z) → world (18.8 − z, −7.5 + x)；
    // 舊版寫成 −7.5 − x，桌上的碗壺、灶上的東西都落到鏡像的位置，懸在半空）
    const tw = (lx, lz) => [18.8 - lz, -7.5 + lx];
    for (const [lx, lz] of [[-1.4, -0.6], [1.3, 0.7]]) {
      const [wx, wz] = tw(lx, lz);
      mb.add('g_bottle_clay', wx + 0.15, 0.815, wz - 0.2, 0.4, 1, { shadow: false });
      mb.add('g_bowl', wx - 0.2, 0.815, wz + 0.05, 0, 1, { shadow: false });
      mb.add('g_bowl', wx - 0.05, 0.815, wz + 0.25, 0, 1, { shadow: false });
    }
    for (const lx of [-1.2, 1.2]) { const [wx, wz] = tw(lx, 2.05); mb.add('lantern_red', wx, 1.85, wz, -Math.PI / 2, 0.9, { shadow: false }); }
    // 每張桌子兩把舊漆圈椅（bk_chair，取代原本的長凳），隔桌對坐：棚內 +z 側的椅子朝世界 +x、−z 側朝 −x
    for (const [lx, lz] of [[-1.4, -0.6], [1.3, 0.7]]) {
      for (const sz of [-1, 1]) {
        const [wx, wz] = tw(lx + sz * 0.08, lz + sz * 0.78);
        mb.add('bk_chair', wx, 0, wz, sz > 0 ? Math.PI / 2 : -Math.PI / 2, 1, { shadow: true });
      }
    }
    // 灶上一套竹蒸籠（籠屜＋擱在旁邊的籠蓋，取代原本程式建模的鐵鍋）、水缸蓋上一只鐵瓢
    { const [wx, wz] = tw(2.2, -1.4); mb.add('bk_steamer', wx, 0.8, wz, 0, 0.9, { shadow: false }); }
    { const [wx, wz] = tw(-2.3, 1.4); mb.add('bk_scoop', wx, 0.7, wz, 0.6, 1, { shadow: false }); }
    // 茶字幌
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.5), decalMaterial(textTexture('茶', { w: 128, h: 320, bg: '#e8dcc2', fg: '#7a2318', border: '#3a2a1c', vertical: true, size: 0.75 }), { alphaTest: 0 }));
    sign.position.set(15.9, 2.2, -10.1);
    sign.rotation.y = -0.3;
    group.add(sign);
    k.rod('wood', 0x3d2a1c, [15.9, 0, -10.2], [15.9, 3.3, -10.2], 0.05);
  }
  // 練功場：兵器架、矮籬
  {
    const g = new Kit(43);
    g.box('wood', 0x4a3420, 2.6, 0.12, 0.12, T(0, 1.6, 0));
    g.box('wood', 0x4a3420, 2.6, 0.12, 0.12, T(0, 0.4, 0));
    for (const sx of [-1, 1]) g.box('wood', 0x4a3420, 0.12, 1.9, 0.5, T(sx * 1.3, 0.95, 0));
    for (let i = 0; i < 6; i++) {
      const x = -1.0 + i * 0.4;
      g.rod('wood', 0x8a6a40, [x, 0.25, 0.08], [x + 0.05, 2.3 + (i % 2) * 0.3, -0.05], 0.025);
      if (i % 2 === 0) g.cone('iron', 0xb9c2c9, 0.04, 0.3, 4, T(x + 0.05, 2.45, -0.05));
      else g.box('iron', 0xb9c2c9, 0.06, 0.45, 0.02, T(x + 0.05, 2.75, -0.05));
    }
    k.merge(g, T(19.6, 0, 8.2, 0, -Math.PI / 2, 0));
    // 籬笆
    for (let i = 0; i < 9; i++) {
      const z = 2.5 + i * 1.2;
      k.box('wood', 0x6a4a30, 0.08, 1.0, 0.08, T(21.2, 0.5, z));
      if (i < 8) for (const y of [0.35, 0.8]) k.box('wood', 0x7a5a3a, 0.05, 0.06, 1.2, T(21.2, y, z + 0.6));
    }
  }
  // 東門石牌坊（往偃師遺墟）：四柱三間三樓，沿 z 展開
  {
    const g = new Kit(45);
    const pf = paifang(g, { stone: true });
    k.merge(g, T(24.6, 0, 0, 0, -Math.PI / 2, 0));
    for (const c of pf.cols) box(24.3, 0, -c - 0.32, 24.9, hFor(c), -c + 0.32);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.36), decalMaterial(textTexture('往偃師遺墟', { w: 640, h: 136, bg: '#2a2620', fg: '#d8c9a0', border: '#8a8478' }), { alphaTest: 0 }));
    sign.position.set(24.6 - 0.06, pf.signY, 0);
    sign.rotation.y = -Math.PI / 2;
    group.add(sign);
  }

  // ── 市集：攤位 ──
  // 坐姿動作（Sitting_Idle_Loop）把骨盆往背後帶約 0.34 m：坐著的攤主往前挪 SIT_FWD，骨盆才落在小凳（vz + SEAT_FWD）上，
  // 位置在貨架前緣（−0.675）與櫃台背板（0）之間，不會坐到攤子後柱外面、被晾網或貨架蓋住身體
  const SIT_FWD = 0.61, SEAT_FWD = 0.27;
  const STALL_STYLE = {
    '河西貨郎': { canopy: 0x3a5274, goods: 'cloth', look: { preset: 'vendor', gender: 'Male', hair: 1 }, anim: 'sit' },
    '說書人老周': { canopy: 0x9a7444, goods: 'books', look: { preset: 'clerk', gender: 'Male', hair: 1, beard: true, hairColor: 0x9a958e }, anim: 'sit' },
    '柳三娘': { canopy: 0x5f7f96, goods: 'herbs', look: { preset: 'herbalist', gender: 'Female', hair: 1 }, anim: 'idle', sub: '渡口藥舖' },
    '遺墟拾荒人': { canopy: 0x6f7a5a, goods: 'scrap', look: { preset: 'vendor', gender: 'Male', hair: 2, palette: 'pine' }, anim: 'idle' },
    '白鷺洲漁娘': { canopy: 0xa8483a, goods: 'fish', look: { preset: 'vendor', gender: 'Female', hair: 0, palette: 'moon' }, anim: 'sit' },
    '石老鐵': { canopy: 0x4a3a2c, goods: 'forge', look: { preset: 'smith', gender: 'Male', hair: 1, build: 1.08 }, anim: 'idle', sub: '鍛爐師傅' },
  };
  const all = playerStall ? [playerStall, ...stalls] : stalls;
  all.forEach((st, si) => {
    const isHero = !!st.isConsigned;
    const S = isHero ? { canopy: 0xb08d48, goods: 'hero', look: { preset: 'clerk', gender: 'Female', hair: 0, palette: 'indigo' }, anim: 'idle' } : (STALL_STYLE[st.owner] || { canopy: 0x6a5a40, goods: 'cloth', look: { preset: 'vendor', gender: 'Male', hair: 0 }, anim: 'idle' });
    const g = new Kit(100 + si);
    stallKit(g, S, isHero, (id, lx, ly, lz, ry = 0, sc = 1, o) => mb.add(id, st.x + lx, ly, st.z + lz, ry, sc, { shadow: false, ...o }));
    k.merge(g, T(st.x, 0, st.z));
    const sit = S.anim === 'sit';
    const vz = st.z - (S.goods === 'forge' ? 1.0 : 0.82);
    if (sit) k.box('wood', 0x5a4330, 0.42, 0.44, 0.3, T(st.x + 0.35, 0.22, vz + SEAT_FWD));
    npcs.push({
      id: isHero ? 'stall-hero' : st.id,
      name: isHero ? '渡口行會' : st.owner,
      sub: isHero ? '代看寄攤' : (S.sub || '攤主'),
      kind: 'vendor',
      look: S.look,
      x: st.x + (sit ? 0.35 : 0.3),
      z: sit ? vz + SIT_FWD : vz,
      rotY: Math.PI,
      anim: S.anim,
    });
  });

  // 菜攤（裝飾攤，不在行會清單）：石鼓村菜農
  {
    const sx = -13.6, sz = -3.2;
    const g = new Kit(140);
    stallKit(g, { canopy: 0x5a7a44, goods: 'veg' }, false, (id, lx, ly, lz, ry = 0, sc = 1, o) => mb.add(id, sx + lx, ly, sz + lz, ry, sc, { shadow: false, ...o }));
    k.merge(g, T(sx, 0, sz));
    k.box('wood', 0x5a4330, 0.42, 0.44, 0.3, T(sx + 0.35, 0.22, sz - 0.82 + SEAT_FWD));
    npcs.push({ id: 'npc-veg', name: '石鼓村菜農', sub: '菜攤', kind: 'npc', look: { preset: 'vendor', gender: 'Female', hair: 2, palette: 'ochre' }, x: sx + 0.35, z: sz - 0.82 + SIT_FWD, rotY: Math.PI, anim: 'sit' });
  }

  // ── 市集上空：沿街兩側（順著鏡頭方向）拉繩掛燈籠，不橫過主角頭頂 ──
  for (const sx of [-1, 1]) {
    const x = sx * 7.0, z0 = -7.2, z1 = 5.2, top = 4.15;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const z = z0 + t * (z1 - z0);
      const y = top - Math.sin(t * Math.PI) * 0.32;
      pts.push(new THREE.Vector3(x, y, z));
      if (i % 2 === 1 && i < 16) hangingLantern(k, x, y - 0.42, z, 0.62, i % 4 === 1 ? 0xe0512e : 0xd8a03a);
    }
    k.add('cloth', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.015, 3), 0x2a1e16);
    for (const z of [z0, z1]) k.rod('wood', 0x3d2a1c, [x, 0, z], [x, top + 0.1, z], 0.06);
  }
  // 廣場中央的石刻羅盤（嵌銅線，與地面齊平）
  {
    const cx = 0, cz = -0.4;
    k.cyl('stone', 0x8d877a, 3.1, 3.1, 0.03, 48, T(cx, 0.012, cz));
    k.torus('bronze', 0xb08d48, 2.95, 0.04, 4, 64, Math.PI * 2, T(cx, 0.03, cz, Math.PI / 2, 0, 0));
    k.torus('bronze', 0x8a6a34, 2.2, 0.025, 4, 64, Math.PI * 2, T(cx, 0.03, cz, Math.PI / 2, 0, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.box('bronze', 0xb08d48, 0.06, 0.02, i % 2 ? 0.5 : 1.0, T(cx + Math.sin(a) * (i % 2 ? 2.55 : 2.0), 0.03, cz + Math.cos(a) * (i % 2 ? 2.55 : 2.0), 0, a, 0));
    }
    k.cyl('stone', 0x6e695e, 0.7, 0.7, 0.04, 24, T(cx, 0.02, cz));
  }
  // 攤位邊的桶、籮筐
  {
    const R = rng(55);
    const kinds = ['barrel', 'tub', 'jar_wine', 'barrel', 'tub', 'jar_wine', 'barrel', 'crate'];
    [[-11.6, -1.2], [-7.2, 3.9], [11.7, 0.4], [7.3, -5.2], [-3.6, -9.6], [3.5, -10.2], [-11.8, 4.6], [11.6, 4.4]].forEach(([x, z], i) => {
      mb.add(kinds[i], x, 0, z, R() * 6, 0.85 + R() * 0.2);
      if (R() > 0.4) sack(k, x + 0.55, 0, z + 0.2, 0.8, R() * 3);
    });
  }

  // ── 街景：燈籠柱、水井、石凳 ──
  for (const z of [16]) for (const sx of [-1, 1]) lanternPost(k, sx * 3.5, z + (sx > 0 ? 0.5 : 0), 2.7, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
  for (const z of [6.5, -9.5]) for (const sx of [-1, 1]) lanternPost(k, sx * 13.4, z, 2.7, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
  {
    // 水井
    const wx = -6.5, wz = 11;
    k.cyl('stone', 0x7a756a, 0.75, 0.8, 0.7, 14, T(wx, 0.35, wz));
    k.cyl('stone', 0x1a2022, 0.6, 0.6, 0.02, 14, T(wx, 0.62, wz));
    for (const sx of [-1, 1]) k.box('wood', 0x4a3420, 0.12, 1.6, 0.12, T(wx + sx * 0.85, 0.8, wz));
    k.cyl('wood', 0x6a4a30, 0.12, 0.12, 1.8, 8, T(wx, 1.45, wz, 0, 0, Math.PI / 2));
    k.lathe('wood', 0x6a4a30, [[0, 0], [0.16, 0], [0.18, 0.25], [0, 0.25]], 10, T(wx + 0.4, 0.75, wz + 0.1));
    // 石凳
    for (const [x, z, r] of [[6.5, 12, 0.2], [-11.5, -10.5, 0.1], [11.5, -10.8, -0.1]]) {
      k.box('stone', 0x8a857a, 1.5, 0.12, 0.45, T(x, 0.45, z, 0, r, 0));
      for (const dx of [-0.55, 0.55]) k.box('stone', 0x77736a, 0.18, 0.42, 0.4, T(x + dx * Math.cos(r), 0.21, z - dx * Math.sin(r), 0, r, 0));
    }
  }

  // ── 南：河灘、柳樹、蘆葦、木棧道、碼頭、牌坊 ──
  for (const [x, z, s, sd] of [[-13.5, -12.8, 1.0, 1], [-20, -16.5, 1.15, 2], [-24, -21.5, 1.0, 3], [13.5, -13, 1.05, 4], [20, -16, 1.1, 5], [24.5, -21.2, 0.95, 6], [-12.5, 14.5, 0.95, 7], [12.5, 14.5, 1.0, 8], [-9.5, -21.6, 0.85, 9], [10, -21.8, 0.9, 10]]) willow(k, x, z, s, sd);
  {
    const R = rng(301);
    // 蘆葦：河灘邊與淺水
    for (let i = 0; i < 26; i++) {
      const x = -26 + R() * 52;
      if (Math.abs(x) < 3.5) continue;
      const z = -19 - R() * 4.5;
      if ((Math.abs(x + 8) < 2 && Math.abs(z + 15.5) < 2) || (Math.abs(x - 0.5) < 2.2 && Math.abs(z + 20) < 2)) continue;
      reeds(k, x, z, 30, 0.9 + R() * 0.6, 400 + i, 1.4 + R() * 0.8);
    }
    for (let i = 0; i < 30; i++) {
      const x = -60 + R() * 120;
      if (Math.abs(x) < 4) continue;
      reeds(k, x, -26.5 - R() * 3, 40, 1.4, 500 + i, 2.0);
    }
    // 河灘上的卵石
    for (let i = 0; i < 40; i++) {
      const x = -26 + R() * 52, z = -13 - R() * 11;
      k.add('stone', lumpGeo(0.12 + R() * 0.22, 0, 0.3, i), R() > 0.5 ? 0x7a756c : 0x8f897e, T(x, 0.02, z, 0, R() * 3, 0, 1, 0.5, 1));
    }
  }
  // 木棧道（沿岸）
  {
    const z0 = -22.8, z1 = -25.9;
    for (let x = -26; x < 26; x += 0.36) k.box('wood', 0x7a5c3c, 0.34, 0.08, z0 - z1, T(x, 0.08, (z0 + z1) / 2), 0.15);
    for (let x = -26; x <= 26; x += 3) for (const z of [z0 + 0.1, z1]) k.cyl('wood', 0x4a3420, 0.12, 0.12, 1.6, 8, T(x, -0.6, z));
    k.box('wood', 0x5a4028, 52, 0.12, 0.14, T(0, 0.04, z0 + 0.05));
    // 拴船樁
    for (const x of [-12, -6, 6, 12, 18]) {
      k.cyl('wood', 0x3d2a1c, 0.12, 0.14, 0.75, 10, T(x, 0.45, z1 + 0.25));
      k.torus('cloth', 0xb59a6a, 0.15, 0.03, 5, 12, Math.PI * 2, T(x, 0.6, z1 + 0.25, Math.PI / 2, 0, 0));
    }
    // 碼頭：匯入的木棧橋（qp_pier，3.1×7.5×19 m，含水下木樁；橋面在模型 y 3.6）伸進河裡，橋面對齊沿岸木棧道
    mb.add('qp_pier', 0, 0.12 - 3.6, z1 - 9.5, Math.PI);
    // 渡口木牌坊「青萍渡」：四柱三間三樓，匾額嵌在中間大小額枋之間
    const g = new Kit(51);
    const pf = paifang(g);
    for (const sx of [-1, 1]) hangingLantern(g, sx * 2.15, 2.35, 0, 0.8);
    k.merge(g, T(0, 0, -21.6));
    for (const c of pf.cols) box(c - 0.32, 0, -21.95, c + 0.32, hFor(c), -21.25);
    // 匾額：木框＋托座
    const sz = -21.6 + 0.07;
    k.box('woodDark', 0x2a1e16, 1.62, 0.46, 0.05, T(0, pf.signY, sz - 0.02));
    for (const sx of [-1, 1]) k.box('wood', 0x6a4a2a, 0.08, 0.12, 0.12, T(sx * 0.62, pf.signY - 0.27, sz));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), decalMaterial(textTexture('青萍渡', { w: 600, h: 144 }), { alphaTest: 0 }));
    sign.position.set(0, pf.signY, sz + 0.02);
    group.add(sign);
  }
  // 河面
  const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 100).rotateX(-Math.PI / 2), makeWaterMaterial({ deep: 0x1f3a3a, shallow: 0x4a6255 }));
  water.position.set(0, -0.3, -74.2);
  water.receiveShadow = true;
  group.add(water);
  // 船：會隨水起伏
  const boats = [];
  for (const [x, z, ry, len, ferry, seed] of [[-8.5, -28.6, 0.08, 6, false, 1], [-15.5, -30.4, -0.15, 5.4, false, 2], [9.5, -29, 0.12, 6.2, false, 3], [17, -34, -0.08, 5.6, false, 4], [5.4, -33.5, Math.PI / 2 + 0.03, 7, true, 5]]) {
    const b = boatKit(len, ferry ? 1.8 : 1.5, seed, ferry).build({ shadow: false });
    b.position.set(x, -0.42, z);
    b.rotation.y = ry;
    group.add(b);
    boats.push({ b, x, z, ry, ph: seed * 1.7 });
  }
  // 對岸：遠山、遠樹、一座塔
  {
    const R = rng(777);
    for (let i = 0; i < 14; i++) {
      const x = -110 + i * 17 + R() * 6;
      k.add('leaf', lumpGeo(14 + R() * 10, 1, 0.25, 900 + i), R() > 0.5 ? 0x4c5e48 : 0x56664e, T(x, -4, -98 - R() * 18, 0, 0, 0, 1.6, 0.55 + R() * 0.3, 1));
    }
    for (let i = 0; i < 40; i++) {
      const x = -90 + R() * 180;
      k.add('leaf', lumpGeo(1.6 + R() * 1.4, 0, 0.3, 950 + i), 0x4d6340, T(x, 1.2, -66 - R() * 10, 0, 0, 0, 1, 1.4, 1));
    }
    // 遠景：匯入的大聖塔掃描（bk_pagoda，七層八角，24 m）取代原本程式建模的五層塔；對岸的重簷寺閣（bk_temple）。
    // 都在霧裡、不投影；台基壓進對岸起伏的地面（取占地四角最低的地面高度再往下 0.2）
    const sink = (x, z, r) => Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => groundHeight(1001, x + a * r, z + b * r))) - 0.2;
    mb.add('bk_pagoda', -34, sink(-34, -84, 2.8), -84, 0.4, 1, { shadow: false });
    mb.add('bk_temple', 26, sink(26, -92, 6), -92, -0.25, 1, { shadow: false });
  }
  // 北側遠景：民居屋頂
  for (const [x, z, w, ry] of [[-24, 22, 8, 0.1], [24, 22, 8, -0.1], [31, 10, 8, -Math.PI / 2]]) {
    building(k, T(x, 0, z, 0, ry, 0), { w, d: 5, h: 3.0, rise: 1.5, front: 'wall', seed: Math.round(x * 3 + z) });
  }
  box(27, 0, -1, 34, 6, 14);
  // 東：渡口茶樓（qp_teahouse，兩層、帶白粉牆小院），面朝西邊的街；西：河神小廟（qp_smallhall）
  mb.add('qp_teahouse', 31.4, 0, -8.6, -Math.PI / 2, 1, { shadow: false }); // 在陰影範圍邊上，不投影省 draw call
  box(25.2, 0, -15.3, 37.6, 8.6, -1.9);
  // 茶樓南邊、河岸上一座兩層吊腳樓（bk_stilthouse，架空木柱、挑廊），面朝西邊的渡口；在可走範圍外。
  // 盒子是模型外框、離走帶東緣只有一兩公尺：做硬盒的話主角貼著河岸東南角、鏡頭朝東時會被夾到 3.5 m，
  // 所以跟廂房一樣標 soft、整棟溶解（自成一個批次，烘焙件本來就是獨立材質，不多 draw call）
  {
    const sbt = new Batch('qingping-stilthouse');
    const sb = sbt.add('bk_stilthouse', 31, 0, -20, -Math.PI / 2, 1, { shadow: false });
    if (sb) {
      const stilt = sbt.build();
      group.add(stilt);
      const b = box(sb.min.x, 0, sb.min.z, sb.max.x, sb.max.y, sb.max.z, true);
      fadeGroups.push({ box: b, objs: [stilt] });
    }
  }
  mb.add('qp_smallhall', -30.2, 0, 4.6, Math.PI / 2, 1, { shadow: false });
  box(-32.9, 0, 1.9, -27.5, 5, 7.3);
  // 西：沿岸木棧道盡頭接一座石拱橋（qp_bridge），跨過河灣往西
  mb.add('qp_bridge', -34.2, -0.36, -24.35, 0, 1, { shadow: false });
  // 河灘上的石塊、漂來的枯木
  mb.add('rock_b04', -22.6, -0.25, -19.2, 0.8, 0.55);
  mb.add('rock_b03', 22.8, -0.2, -18.6, 2.2, 0.6);
  mb.add('log_dead', 7.6, 0, -21.2, 0.25, 0.8);

  // 傳送點：南往赤沙驛（渡口）、東往偃師遺墟
  const portals = [
    { x: 0, z: -23, label: '渡口・往赤沙驛', top: 1.4 },
    { x: 22, z: 0, label: '東門・往偃師遺墟', top: 1.4 },
  ];
  portalMarker(k, group, 0, -23.6, '沙', 'stele');
  portalMarker(k, group, 22, 0, '墟', 'stele');

  group.add(k.build({ name: 'qingping', see: true }));
  group.add(mb.build());
  return {
    group, npcs, colliders, portals, beaconViews: [], fadeGroups,
    update(dt, t) {
      for (const B of boats) {
        B.b.position.y = -0.42 + Math.sin(t * 1.1 + B.ph) * 0.05;
        B.b.rotation.z = Math.sin(t * 0.9 + B.ph) * 0.025;
        B.b.rotation.x = Math.sin(t * 0.7 + B.ph * 2) * 0.015;
      }
    },
  };
}

// 攤位（面向 +z，客人站在 z+1.4）：布篷、四柱、櫃台、貨架與各家的貨。
// put(id, lx, ly, lz, ry, s, opts)：在攤位座標擺一件匯入模型（goods／props，assets.js 的 Batch）；貨品略放大 1.3～1.5 倍，追尾鏡頭下才認得出來
function stallKit(k, S, isHero, put = () => {}) {
  const cw = 2.6, cd = 2.0;
  if (S.goods !== 'forge') {
    for (const [x, z, h] of [[-cw / 2, -cd / 2, 2.6], [cw / 2, -cd / 2, 2.6], [-cw / 2, cd / 2, 2.2], [cw / 2, cd / 2, 2.2]]) k.box('wood', 0x4a3420, 0.09, h, 0.09, T(x, h / 2, z));
    const canopy = new THREE.PlaneGeometry(cw + 0.5, cd + 0.6, 4, 3);
    const p = canopy.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / (cw + 0.5)) * Math.PI * 4) * 0.03 - Math.abs(p.getX(i)) * 0.02);
    canopy.computeVertexNormals();
    k.add('cloth', canopy, S.canopy, T(0, 2.42, 0, -Math.PI / 2 + 0.2, 0, 0), 0.03);
    // 篷布的白邊與兩道條紋
    for (const dx of [-0.55, 0.55]) k.add('cloth', new THREE.PlaneGeometry(0.16, cd + 0.6), 0xe8dcc2, T(dx, 2.425, 0, -Math.PI / 2 + 0.2, 0, 0), 0.02);
    // 布篷垂邊
    k.add('cloth', new THREE.PlaneGeometry(cw + 0.5, 0.28), S.canopy, T(0, 2.06, cd / 2 + 0.36, -0.12, 0, 0), 0.03);
    hangingLantern(k, cw / 2 - 0.1, 1.75, cd / 2 + 0.25, 0.7);
  }
  // 櫃台
  const counter = (w = 2.2, h = 0.85, d = 0.6, z = 0.3) => {
    k.box('wood', 0x6a4a30, w, 0.07, d, T(0, h, z));
    k.box('wood', 0x5a3e28, w - 0.06, h - 0.07, 0.05, T(0, (h - 0.07) / 2, z + d / 2 - 0.03));
    for (const sx of [-1, 1]) k.box('wood', 0x4a3420, 0.07, h, d, T(sx * (w / 2 - 0.035), h / 2, z));
  };
  const shelf = (z = -0.85) => {
    for (const sx of [-1, 1]) k.box('wood', 0x4a3420, 0.06, 1.8, 0.35, T(sx * 1.0, 0.9, z));
    for (const y of [0.5, 1.05, 1.6]) k.box('wood', 0x6a4a30, 2.0, 0.05, 0.35, T(0, y, z));
  };
  const R = rng(S.canopy);
  if (S.goods === 'cloth') {
    counter(); shelf();
    for (let i = 0; i < 5; i++) k.cyl('cloth', [0x2c3e57, 0x9a6a36, 0xb23a24, 0x2f4a3c, 0xe8dcc2][i], 0.11, 0.11, 0.55, 10, T(-0.8 + i * 0.4, 0.99, 0.3, 0, 0, Math.PI / 2));
    for (let i = 0; i < 4; i++) crate(k, -0.7 + i * 0.45, 1.08, -0.85, 0.3, R());
    for (let i = 0; i < 3; i++) put('jar_wine', -0.6 + i * 0.6, 0.525, -0.85, R() * 6, 0.5);
    // 百鍊烏鋼錠
    for (let i = 0; i < 4; i++) k.box('iron', 0x3a3c40, 0.28, 0.08, 0.12, T(0.3 + (i % 2) * 0.3, 1.66 + Math.floor(i / 2) * 0.09, -0.85));
  } else if (S.goods === 'books') {
    counter(2.0, 0.75);
    for (let i = 0; i < 6; i++) k.box('cloth', [0x2c3e57, 0x8a3a2a, 0x4a5a3a][i % 3], 0.22, 0.05, 0.3, T(-0.7 + (i % 3) * 0.3, 0.8 + Math.floor(i / 3) * 0.06, 0.25, 0, R() * 0.3, 0));
    for (let i = 0; i < 3; i++) k.cyl('cloth', 0xe8dcc2, 0.04, 0.04, 0.5, 8, T(0.4 + i * 0.15, 0.82, 0.3, 0, 0.3, Math.PI / 2));
    k.box('woodDark', 0x2a1e16, 0.35, 0.12, 0.1, T(0.75, 0.84, 0.15)); // 醒木
    put('lacquer_box', 0.72, 0.785, 0.4, 0.3, 0.7);
    put('vase_blue', 0.75, 1.625, -0.9, 0, 0.9);
    k.cyl('cloth', 0xe8dcc2, 0.22, 0.22, 0.01, 12, T(-0.9, 0.82, 0.2, 0.3, 0, 0, 1, 1, 1)); // 摺扇（簡化）
    shelf(-0.9);
    for (let i = 0; i < 10; i++) k.box('cloth', [0x2c3e57, 0x8a3a2a, 0x4a5a3a, 0xc2ad84][i % 4], 0.08, 0.32, 0.25, T(-0.85 + i * 0.12, 0.7 + (i > 5 ? 0.55 : 0), -0.9));
  } else if (S.goods === 'herbs') {
    counter();
    // 百子櫃
    k.box('woodDark', 0x4a2e1e, 2.0, 1.8, 0.4, T(0, 0.9, -0.85));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      k.box('wood', 0x7a5232, 0.28, 0.28, 0.02, T(-0.82 + c * 0.33, 0.3 + r * 0.33, -0.64));
      k.sphere('bronze', 0xb08d48, 0.018, 6, 4, T(-0.82 + c * 0.33, 0.3 + r * 0.33, -0.62));
    }
    for (let i = 0; i < 4; i++) k.cyl('wood', 0xa48b62, 0.18, 0.15, 0.08, 14, T(-0.75 + i * 0.5, 0.92, 0.3)); // 藥篩
    for (let i = 0; i < 2; i++) k.sphere('leaf', [0x6a7a3a, 0x9a6a3a][i], 0.13, 8, 6, T(-0.75 + i * 0.5, 0.98, 0.3, 0, 0, 0, 1, 0.35, 1));
    for (let i = 0; i < 4; i++) put('g_mushroom', 0.25 + (i % 2) * 0.09 - 0.04, 0.965, 0.26 + (i >> 1) * 0.09, i * 1.7, 1.5);
    for (let i = 0; i < 3; i++) put('g_garlic_bulb', 0.72 + (i - 1) * 0.08, 0.965, 0.3 + (i % 2) * 0.05, i, 1.5);
    put('pot_herb', 1.5, 0, 0.55, -0.4, 0.8, { shadow: true });
    put('basket_lid', -1.5, 0, 0.5, 0.6, 1.1);
    k.box('iron', 0x2a2a2a, 0.3, 0.06, 0.12, T(0.9, 0.9, 0.45)); // 戥子
    // 藥葫蘆掛串
    for (let i = 0; i < 3; i++) k.lathe('wood', 0xc8a050, [[0, 0], [0.09, 0.03], [0.1, 0.1], [0.05, 0.16], [0.07, 0.22], [0.03, 0.29], [0, 0.29]], 10, T(-1.0 + i * 0.25, 1.65, 0.95));
  } else if (S.goods === 'scrap') {
    counter(); shelf();
    for (let i = 0; i < 5; i++) {
      const sh = gearShape(0.14 + R() * 0.08, 0.11 + R() * 0.05, 8 + Math.floor(R() * 6), { hole: 0.03 });
      k.extrude('bronze', R() > 0.5 ? 0x8a6a3c : 0x5a7a64, sh, 0.03, T(-0.8 + i * 0.4, 0.95, 0.3, -Math.PI / 2 + 0.3, 0, R()));
    }
    for (let i = 0; i < 3; i++) k.rod('bronze', 0x7a6040, [-0.9 + i * 0.6, 1.08, -0.85], [-0.6 + i * 0.6, 1.25, -0.85], 0.03);
    k.sphere('glow', 0x5af0b0, 0.07, 10, 8, T(0.5, 1.68, -0.85)); // 機樞核心
    k.cyl('bronze', 0x8a6a3c, 0.1, 0.1, 0.12, 10, T(0.5, 1.6, -0.85));
    for (let i = 0; i < 3; i++) k.lathe('stone', 0x8fb8a0, [[0, 0], [0.05, 0], [0.06, 0.12], [0.02, 0.16], [0.025, 0.2], [0, 0.2]], 8, T(-0.4 + i * 0.15, 1.6, -0.85)); // 養玉露瓶
  } else if (S.goods === 'fish') {
    counter(2.2, 0.7);
    // 一只木盆盛兩尾虹鱒、案上一尾鱸魚，砧板上幾尾沙丁，攤前地上一只扁籮擺吳郭魚
    put('tub', -0.72, 0.735, 0.3, 0.3, 0.85);
    put('g_rainbowTrout', -0.76, 0.86, 0.3, 1.2, 1.2);
    put('g_rainbowTrout', -0.66, 0.89, 0.28, 2.1, 1.2);
    put('g_stripedBass', 0.02, 0.735, 0.3, Math.PI / 2 + 0.12, 1.15);
    put('g_cuttingBoard', 0.66, 0.735, 0.3, 0.1, 1.2);
    for (let i = 0; i < 3; i++) put('g_spottedSardine', 0.56 + i * 0.1, 0.752, 0.3, 0.15 - i * 0.1, 1.25);
    put('basket_flat', -0.6, 0, 0.95, 0.2, 1.6);
    put('g_blueTilapia', -0.6, 0.06, 0.95, Math.PI / 2 + 0.3, 0.9);
    // 晾著的漁網
    k.add('cloth', new THREE.PlaneGeometry(1.8, 1.4, 6, 6), 0x9c8f72, T(0, 1.2, -1.07), 0.05); // 掛在後柱外側、色淺一點，跟坐在前面的攤主分得開
    for (let i = 0; i < 4; i++) k.sphere('cloth', 0xc9ad7a, 0.04, 6, 4, T(-0.8 + i * 0.55, 0.52, -1.07));
    // 淬紋石
    for (let i = 0; i < 4; i++) k.add('stone', lumpGeo(0.06, 0, 0.3, i), [0xb23a24, 0x2c5e80, 0xb23a24, 0x2c5e80][i], T(0.5 + i * 0.12, 0.75, 0.42));
  } else if (S.goods === 'forge') {
    // 鍛爐棚：磚砌爐、風箱、鐵砧、刀架；棚頂木瓦
    for (const [x, z] of [[-1.5, -1.3], [1.5, -1.3], [-1.5, 0.9], [1.5, 0.9]]) k.box('wood', 0x3d2a1c, 0.14, 2.8, 0.14, T(x, 1.4, z));
    const rg = roofGeo(3.2, 2.4, 0.7, { curl: 0.25, overhang: 0.4 });
    k.add('stone', rg, 0x3a3c3f, T(0, 2.85, -0.2));
    k.add('woodDark', flipGeo(rg), 0x2a1e16, T(0, 2.78, -0.2));
    k.box('stone', 0x6a4a3a, 1.2, 1.0, 1.0, T(-0.7, 0.5, -1.0));
    k.box('stone', 0x5a3e30, 0.8, 1.6, 0.6, T(-0.7, 1.3, -1.3));
    k.box('paper', 0xff7a2a, 0.6, 0.18, 0.5, T(-0.7, 1.05, -0.86));
    k.box('woodDark', 0x2a1a12, 0.5, 0.3, 0.8, T(-1.5, 0.5, -0.9)); // 風箱
    k.lathe('iron', 0x2c2c2e, [[0, 0], [0.22, 0], [0.18, 0.15], [0.14, 0.45], [0.3, 0.5], [0.34, 0.62], [0, 0.62]], 10, T(0.5, 0, 0.2)); // 鐵砧座
    // 砧體是匯入的鐵砧（bk_anvil，0.78×0.36×0.41 m，取代原本的方塊＋錐形砧角），坐在程式建模的砧座上；砧面高約 0.975
    put('bk_anvil', 0.5, 0.62, 0.2, 0, 1, { shadow: true });
    k.rod('wood', 0x6a4a30, [0.3, 0.99, 0.32], [0.1, 0.93, 0.62], 0.025); // 火鉗擱在砧面上、柄往外斜
    k.box('iron', 0x3a3a3c, 0.12, 0.08, 0.08, T(0.32, 1.01, 0.3));
    put('bucket', 1.1, 0, -0.6, 0.4, 1.1, { shadow: true }); // 淬火桶
    put('hammer', 0.62, 0.99, 0.24, 0.5, 1.3, { rx: Math.PI / 2 });
    put('barrel', -1.45, 0, 0.55, 0.8, 0.8, { shadow: true });
    for (let i = 0; i < 5; i++) {
      k.box('iron', 0xb9c2c9, 0.05, 0.8, 0.012, T(0.6 + i * 0.18, 1.6, -1.25, 0, 0, 0.05));
      k.box('woodDark', 0x2a1e16, 0.04, 0.22, 0.03, T(0.6 + i * 0.18, 1.12, -1.25));
    }
    k.box('wood', 0x4a3420, 1.1, 0.06, 0.12, T(0.95, 2.0, -1.25));
  } else if (S.goods === 'veg') {
    // 菜攤：三只扁籮裝茄子苦瓜、桃梨橘、青江菜黃瓜；案頭擺南瓜、地瓜
    counter();
    const veg = [
      [['g_eggplant', 0], ['g_eggplant', 0.6], ['g_bitterMelon', 1.4], ['g_bitterMelon', 2.0]],
      [['g_tangerine', 0], ['g_peach', 1], ['g_tangerine', 2], ['g_pear', 3], ['g_peach', 4]],
      [['g_bocChoy', 0.2], ['g_bocChoy', 2.6], ['g_cucumber', 1.4], ['g_cucumber', 1.9]],
    ];
    veg.forEach((list, b) => {
      const bx = -0.72 + b * 0.62;
      put('basket_flat', bx, 0.885, 0.3, b * 0.4, 1.45);
      list.forEach(([id, a], i) => put(id, bx + Math.cos(a * 2.1 + i) * 0.13, 0.91 + (i > 2 ? 0.04 : 0), 0.3 + Math.sin(a * 2.1 + i) * 0.08, a, 1.4));
    });
    put('g_squash', 0.95, 0.885, 0.5, 0, 1.6);
    put('g_sweetPotato', 0.98, 0.885, 0.15, 0.7, 1.5);
    put('g_sweetPotato', 0.86, 0.885, 0.1, 2.1, 1.5);
    put('basket_lid', 1.45, 0, 0.6, -0.5, 1.2);
    put('crate', -1.5, 0, 0.5, 0.2, 0.9, { shadow: true });
  }
  if (isHero) {
    // 寄攤：一方草蓆、兩只箱、一塊木牌
    k.box('cloth', 0xb5985a, 2.2, 0.04, 1.6, T(0, 0.02, 0));
    put('camphor_chest', -0.35, 0.04, -0.25, 0.1, 0.9, { shadow: true });
    put('lacquer_box', 0.35, 0.04, -0.2, 0.4, 0.9);
    k.box('wood', 0x7a5a3a, 0.6, 0.4, 0.04, T(0.7, 0.6, 0.4, -0.2, 0, 0));
    k.rod('wood', 0x4a3420, [0.7, 0, 0.45], [0.7, 0.6, 0.42], 0.025);
  }
}

// ════════════════════════════════════════════
// 赤沙驛
// ════════════════════════════════════════════
const EARTH = 0xa8804e, EARTH_DK = 0x8a6440;

function rammedWall(k, x0, z0, x1, z1, h = 3.4, t = 1.0, crenel = true) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const ry = Math.atan2(dx, dz);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // 夯土分層：每一版一層，版與版之間有一點錯位
  const layers = Math.round(h / 0.45);
  for (let i = 0; i < layers; i++) {
    const y = i * (h / layers);
    k.add('earth', new THREE.BoxGeometry(t - i * 0.03, h / layers + 0.01, len, 1, 1, Math.max(1, Math.round(len / 3))), i % 2 ? EARTH : 0xb08a58, T(cx, y + h / layers / 2, cz, 0, ry, 0), 0.03);
  }
  if (crenel) {
    for (let s = 0.8; s < len - 0.5; s += 1.6) {
      const px = x0 + (dx / len) * s, pz = z0 + (dz / len) * s;
      k.box('earth', 0xb08a58, t * 0.6, 0.55, 0.8, T(px, h + 0.27, pz, 0, ry, 0), 0.05);
    }
  }
}

function beaconTower(k, x, z, seed) {
  // 夯土台（收分）、木梯、頂上柴堆與火盆、一根小旗竿
  const H = 2.8;
  k.add('earth', new THREE.CylinderGeometry(1.15, 1.55, H, 4, 6), EARTH, T(x, H / 2, z, 0, Math.PI / 4, 0), 0.03);
  k.add('earth', new THREE.CylinderGeometry(1.25, 1.2, 0.3, 4, 1), EARTH_DK, T(x, H + 0.1, z, 0, Math.PI / 4, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    k.box('earth', 0xb08a58, 0.35, 0.35, 0.35, T(x + Math.cos(a) * 0.9, H + 0.4, z + Math.sin(a) * 0.9));
  }
  // 梯
  for (const sx of [-1, 1]) k.rod('wood', 0x5a4028, [x + sx * 0.3, 0, z + 1.9], [x + sx * 0.3, H + 0.3, z + 1.05], 0.04);
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    k.box('wood', 0x6a4a30, 0.65, 0.04, 0.05, T(x, t * (H + 0.3), z + 1.9 - t * 0.85));
  }
  // 柴堆（井字疊）
  const R = rng(seed);
  for (let i = 0; i < 6; i++) {
    const y = H + 0.3 + i * 0.12;
    for (const o of [-0.25, 0.25]) {
      if (i % 2) k.cyl('wood', 0x5a4028, 0.06, 0.06, 0.95, 6, T(x + o, y, z, Math.PI / 2, 0, 0));
      else k.cyl('wood', 0x4a3420, 0.06, 0.06, 0.95, 6, T(x, y, z + o, 0, 0, Math.PI / 2));
    }
  }
  for (let i = 0; i < 9; i++) k.rod('wood', 0x7a6040, [x + (R() - 0.5) * 0.3, H + 0.4, z + (R() - 0.5) * 0.3], [x + (R() - 0.5) * 0.9, H + 1.3 + R() * 0.3, z + (R() - 0.5) * 0.9], 0.03, 4);
  // 狼糞烽煙的煙道（土坯小圈）
  k.cyl('earth', EARTH_DK, 0.35, 0.4, 0.3, 10, T(x + 0.75, H + 0.4, z - 0.7), 0.03, true);
  return H;
}

function camelThorn(k, x, z, s, seed) {
  const R = rng(seed);
  const pos = [], col = [];
  const n = 26 + Math.floor(R() * 14);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, el = 0.25 + R() * 1.0;
    const L = (0.3 + R() * 0.4) * s;
    const ex = x + Math.cos(a) * Math.cos(el) * L, ey = Math.sin(el) * L, ez = z + Math.sin(a) * Math.cos(el) * L;
    if (i % 3 === 0) k.rod('wood', R() > 0.5 ? 0x6a5a3a : 0x7a6a40, [x, 0, z], [ex, ey, ez], 0.01 * s, 3);
    // 細碎的灰綠小葉與刺
    for (let j = 0; j < 3; j++) {
      const t = 0.4 + j * 0.25;
      const px = x + (ex - x) * t, py = ey * t, pz = z + (ez - z) * t;
      const w = 0.06 * s;
      const b = R() * Math.PI;
      pos.push(px, py, pz, px + Math.cos(b) * w, py + 0.03 * s, pz + Math.sin(b) * w, px + Math.cos(b + 1.2) * w * 0.6, py + 0.07 * s, pz + Math.sin(b + 1.2) * w * 0.6);
      const g = 0.8 + R() * 0.3;
      const cc = R() > 0.85 ? [0.62 * g, 0.3 * g, 0.42 * g] : [0.42 * g, 0.48 * g, 0.28 * g];
      col.push(...cc, ...cc, ...cc);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  k.add('reed', geo, 0xffffff, null, 0);
}

// 風蝕岩（雅丹）：上大下小、橫向紋層
function yardang(k, x, z, sx, sy, sz, ry, seed) {
  const g = lumpGeo(1, 3, 0.18, seed, { flatTop: 0.55 });
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const lo = new THREE.Color(0x8a5a36), hi = new THREE.Color(0xd09a64), pale = new THREE.Color(0xe0b88a);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i);
    // 底部被風掏空、往上收（雅丹的蘑菇頸）
    const narrow = y < -0.1 ? 0.7 + (y + 1) * 0.33 : (y > 0.4 ? 1 - (y - 0.4) * 0.25 : 1);
    const wob = 1 + Math.sin(y * 14 + seed) * 0.03;
    p.setX(i, p.getX(i) * narrow * wob);
    p.setZ(i, p.getZ(i) * narrow * wob);
    y = p.getY(i);
    const band = Math.sin(y * 16 + Math.sin(p.getX(i) * 1.5) * 0.8) > 0.2 ? 1 : 0;
    c.copy(lo).lerp(hi, 0.35 + (y + 1) * 0.3).lerp(pale, band * 0.35);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  k.add('earth', g, 0xffffff, T(x, sy * 0.55, z, 0, ry, 0, sx, sy, sz), 0);
  // 腳下的沙裙
  k.add('earth', lumpGeo(1, 2, 0.15, seed + 3), 0xc89a66, T(x, 0, z, 0, ry, 0, sx * 1.25, sy * 0.12, sz * 1.25), 0.02);
}

function buildChisha({ beacons }) {
  const group = new THREE.Group();
  const k = new Kit(61);
  const npcs = [];
  const colliders = [];
  const box = (x0, y0, z0, x1, y1, z1, soft = false) => { const b = new THREE.Box3(V3(x0, y0, z0), V3(x1, y1, z1)); b.soft = soft; colliders.push(b); return b; };

  // ── 西：驛站（夯土牆圍出的大院），門朝東開在 x = −26.6 ──
  const X0 = -42, X1 = -26.6, Z0 = 4, Z1 = 28;
  rammedWall(k, X1, Z0, X1, 13.6);
  rammedWall(k, X1, 18.4, X1, Z1);
  rammedWall(k, X0, Z0, X1, Z0);
  rammedWall(k, X0, Z1, X1, Z1);
  rammedWall(k, X0, Z0, X0, Z1);
  box(X1 - 1, 0, Z0, X1 + 0.6, 4, 12.2);
  box(X1 - 1, 0, 19.8, X1 + 0.6, 4, Z1);
  // 門樓：匯入的石砌門樓（qp_gate，7.7×6.5×3.9 m，風化的黃石牆、木構翹簷），轉 90° 朝東
  const mb = new Batch('chisha-models');
  mb.add('qp_gate', X1, 0, 16, Math.PI / 2);
  box(X1 - 2.1, 0, 12.0, X1 + 2.1, 6.6, 20.0);
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.5), decalMaterial(textTexture('赤沙驛', { w: 520, h: 152 }), { alphaTest: 0 }));
    sign.position.set(X1 + 2.08, 3.72, 16);
    sign.rotation.y = Math.PI / 2;
    group.add(sign);
  }
  {
    // 兩扇門板上原本的門神貼紙壓縮後只剩米色框裡一塊鋸齒深色（還有幾處破洞），蓋一對朱紅斗方「平」「安」。
    // 北扇（z 大）往裡開約 26°，南扇關著（x = −26.41）；位置與大小是從正面鏡頭打射線量的。兩張共用一張圖、合成一個 mesh
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 320;
    const c = cv.getContext('2d');
    ['平', '安'].forEach((ch, i) => {
      const x0 = i * 256;
      c.fillStyle = '#8c2a1c'; c.fillRect(x0, 0, 256, 320);
      c.strokeStyle = '#d6b46a'; c.lineWidth = 6; c.strokeRect(x0 + 14, 14, 228, 292);
      c.lineWidth = 2; c.strokeRect(x0 + 26, 26, 204, 268);
      c.fillStyle = '#e6c67c'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '900 168px "Songti TC","STSong","Noto Serif TC",serif';
      c.fillText(ch, x0 + 128, 166);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const leaf = (u0, w, h, x, y, z, ry) => {
      const g = new THREE.PlaneGeometry(w, h);
      const uvA = g.attributes.uv;
      for (let i = 0; i < uvA.count; i++) uvA.setX(i, u0 + uvA.getX(i) * 0.5);
      g.rotateY(ry);
      g.translate(x + Math.sin(ry) * 0.014, y, z + Math.cos(ry) * 0.014);
      return g;
    };
    const posters = new THREE.Mesh(mergeGeometries([
      leaf(0, 0.84, 1.08, -26.743, 2.155, 16.75, Math.PI / 2 + 0.452),
      leaf(0.5, 0.86, 1.06, -26.409, 2.17, 15.477, Math.PI / 2),
    ]), decalMaterial(tex, { alphaTest: 0 }));
    group.add(posters);
  }
  // 院內：平頂土屋、馬棚、角樓
  for (const [x, z, w, d, h] of [[-36, 22, 9, 5, 3.6], [-37, 9.5, 7, 4.5, 3.2]]) {
    k.add('earth', new THREE.BoxGeometry(w, h, d, 2, 3, 2), EARTH, T(x, h / 2, z), 0.04);
    k.box('earth', EARTH_DK, w + 0.4, 0.3, d + 0.4, T(x, h + 0.15, z));
    for (let i = 0; i < Math.floor(w / 1.2); i++) k.cyl('wood', 0x4a3420, 0.07, 0.07, 0.6, 6, T(x - w / 2 + 0.6 + i * 1.2, h - 0.3, z + d / 2 + 0.25, Math.PI / 2, 0, 0)); // 椽頭
    k.box('woodDark', 0x3a2418, 1.0, 2.0, 0.08, T(x + 1, 1.0, z + d / 2 + 0.02));
  }
  {
    // 角樓（高）
    const x = -39.5, z = 25.5;
    k.add('earth', new THREE.CylinderGeometry(1.8, 2.3, 8, 4, 8), EARTH, T(x, 4, z, 0, Math.PI / 4, 0), 0.04);
    for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) k.box('wood', 0x4a3420, 0.15, 2.2, 0.15, T(x + dx, 9.1, z + dz));
    const rg = roofGeo(3.2, 3.2, 1.1, { curl: 0.35, overhang: 0.4 });
    k.add('stone', rg, 0x5a4a3a, T(x, 10.2, z));
    k.add('woodDark', flipGeo(rg), 0x2a1e16, T(x, 10.12, z));
  }
  // 驛門外的駝隊貨物、拴馬樁、驛道里程碑
  {
    const R = rng(71);
    for (let i = 0; i < 6; i++) crate(k, -24.5 + R() * 1.5, 0, 9 + i * 0.9, 0.6 + R() * 0.2, R(), 0x8a6a44);
    for (let i = 0; i < 6; i++) sack(k, -23.8 - R(), 0, 21 + i * 0.6, 1.1, R() * 3);
    for (const z of [11, 21.5]) {
      k.cyl('wood', 0x4a3420, 0.1, 0.12, 1.4, 8, T(-22, 0.7, z));
      k.box('wood', 0x4a3420, 0.1, 0.1, 1.6, T(-22, 1.2, z));
    }
    for (const [x, z, r] of [[-24.2, 8.2, 0.3], [-23.4, 7.6, 1.9], [-24.6, 21.2, 0.8]]) mb.add('barrel', x, 0, z, r, 0.9);
    // 驛門外的歇腳處：火塘、一截枯木當凳，條桌上一籃胡餅（饢）、陶壺、粗碗
    mb.add('firepit', -20.4, 0.02, 20.6, 0.4, 1.1);
    mb.add('log_dead', -19.0, 0, 22.3, 0.35, 0.55);
    k.box('wood', 0x6a4a30, 1.5, 0.07, 0.6, T(-22.3, 0.76, 18.6, 0, 0.15, 0));
    for (const [dx, dz] of [[-0.65, -0.24], [0.65, -0.24], [-0.65, 0.24], [0.65, 0.24]]) k.box('wood', 0x4a3420, 0.06, 0.74, 0.06, T(-22.3 + dx, 0.37, 18.6 + dz, 0, 0.15, 0));
    mb.add('basket_flat', -22.7, 0.795, 18.6, 0.2, 1.5, { shadow: false });
    for (let i = 0; i < 4; i++) mb.add('g_tandyrNan', -22.7 + (i % 2) * 0.05 - 0.02, 0.81 + i * 0.045, 18.6 + (i >> 1) * 0.04, i * 1.3, 1.25, { shadow: false });
    mb.add('g_tandyrNan', -22.15, 0.795, 18.75, 0.5, 1.25, { shadow: false });
    mb.add('g_bottle_clay', -21.8, 0.795, 18.45, 0, 1.3, { shadow: false });
    for (const [dx, dz] of [[-0.05, -0.15], [0.18, -0.05]]) mb.add('g_bowl', -22.0 + dx, 0.795, 18.6 + dz, 0, 1.2, { shadow: false });
    // 里程碑
    k.box('stone', 0x8a7f6e, 0.6, 1.8, 0.3, T(-18.5, 0.9, 13.2, 0, 0.3, 0));
    k.box('stone', 0x7a6f5e, 0.9, 0.3, 0.6, T(-18.5, 0.15, 13.2, 0, 0.3, 0));
  }
  // ── 三座烽燧 ──
  const beaconViews = [];
  const flames = [];
  for (const b of beacons) {
    const H = beaconTower(k, b.x, b.z, b.id.length * 13 + Math.round(b.x));
    const fire = new THREE.Group();
    fire.position.set(b.x, H + 0.35, b.z);
    const fm = getFlameMat();
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.5 - i * 0.06, 10, 8).scale(1, 2.4 - i * 0.3, 1).translate(0, 0.6, 0), fm);
      f.position.set((i % 2 - 0.5) * 0.25, 0, (i > 1 ? 0.2 : -0.2));
      fire.add(f);
      flames.push(f);
    }
    const light = new THREE.PointLight(0xff8a3a, 0, 16, 1.6);
    light.position.y = 1.2;
    fire.add(light);
    fire.visible = false;
    group.add(fire);
    // 假烽燧被揭穿：冒一縷濕煙
    const smoke = new THREE.Group();
    smoke.position.set(b.x, H + 0.6, b.z);
    const smat = new MeshBasicNodeMaterial({ color: 0xb8aea2, transparent: true, opacity: 0.22, depthWrite: false });
    const puffs = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), smat);
      smoke.add(p);
      puffs.push(p);
    }
    smoke.visible = false;
    group.add(smoke);
    const view = {
      id: b.id, name: b.name, x: b.x, z: b.z, top: H + 1.4, state: '',
      fire, light, smoke, puffs,
      sync(world) {
        const st = world.beacons.find((s) => s.id === b.id) || b;
        const bs = world.getBeaconState?.();
        const lit = st.revealed && st.isTrue;
        const igniting = bs && bs.beaconId === b.id;
        this.fire.visible = lit || !!igniting;
        this.fire.scale.setScalar(lit ? 1 : 0.35 + (1 - Math.max(0, bs?.rem ?? 0) / 2.5) * 0.4);
        this.light.intensity = lit ? 40 : (igniting ? 10 : 0);
        this.smoke.visible = st.revealed && !st.isTrue;
        this.state = lit ? `守驛人 ${st.owner}` : (st.revealed ? '濕柴・點不燃' : (igniting ? '點火中' : '未點燃'));
      },
    };
    beaconViews.push(view);
  }
  // ── 風蝕岩（多在可走範圍外） ──
  {
    const R = rng(81);
    const spots = [[-31, -14], [-36, -2], [-30, -30], [-14, -34], [3, -38], [18, -33], [31, -26], [36, -10], [33, 6], [34, 22], [22, 34], [4, 38], [-16, 36], [19.5, 15.5], [-21, -19.5], [21.5, -20.5]];
    // 換成匯入掃描的幾處：南邊正對出生鏡頭的雅丹土台、兩根孤柱、兩段砂岩崖；場內三處小土丘換成大石
    const SCAN = {
      '3,-38': ['rock_mesa', 1.0, Math.PI / 2], '-14,-34': ['rock_mesa', 0.62, 0.5], '-30,-30': ['rock_pillar', 1.1, 0.3], '31,-26': ['rock_pillar', 0.9, 2.1],
      '36,-10': ['rock_cliff', 1.7, -Math.PI / 2], '-36,-2': ['rock_cliff', 1.9, Math.PI / 2 + 0.2],
      '19.5,15.5': ['rock_b03', 1.5, 0.6], '-21,-19.5': ['rock_b04', 1.4, 2.0], '21.5,-20.5': ['rock_b03', 1.3, 4.1],
    };
    spots.forEach(([x, z], i) => {
      const inside = Math.abs(x) < 26 && Math.abs(z) < 26;
      const s = inside ? 1.4 + R() * 0.6 : 3 + R() * 3.5;
      const sx = s * (1.2 + R() * 0.6), sy = s * (0.9 + R() * 0.7), sz = s * (0.8 + R() * 0.5), ry = R() * 3;
      const scan = SCAN[`${x},${z}`];
      if (scan) {
        // 掃描底下帶一圈地皮與零碎浮片：沉進沙裡
        const [id, sc, rr] = scan;
        const y = inside ? -0.15 : groundHeight(1002, x, z) - 0.9 * sc;
        const b = mb.add(id, x, y, z, rr, sc);
        if (!inside && b) box(b.min.x + 1, 0, b.min.z + 1, b.max.x - 1, b.max.y, b.max.z - 1);
      } else {
        yardang(k, x, z, sx, sy, sz, ry, 200 + i);
        if (!inside) box(x - s, 0, z - s, x + s, s * 2, z + s);
      }
    });
    // 地上碎石
    for (let i = 0; i < 60; i++) {
      const x = -30 + R() * 60, z = -30 + R() * 60;
      k.add('earth', lumpGeo(0.1 + R() * 0.25, 0, 0.35, 300 + i), 0x8a6440, T(x, 0.03, z, 0, R() * 3, 0, 1, 0.55, 1));
    }
    // 駱駝刺
    for (let i = 0; i < 70; i++) {
      const x = -26 + R() * 52, z = -26 + R() * 52;
      if (Math.hypot(x, z - 12) < 3) continue;
      camelThorn(k, x, z, 0.7 + R() * 0.8, 600 + i);
    }
    // 胡楊枯木
    // 胡楊枯木（匯入的枯樹 tree_dead，8 m 縮到 5～6.5 m）：擋在鏡頭與主角之間時整棵溶掉，跟青萍渡的柳樹一樣
    for (const [x, z, s, r] of [[-17, -6, 0.7, 0.4], [15, 19, 0.8, 2.2], [24, 4, 0.65, 4.0], [-12, 22, 0.75, 5.3]]) mb.add('tree_dead', x, -0.1, z, r, s, { whole: true });
  }
  // ── 地脈裂口（往偃師遺墟）：一道冷綠光的地縫、兩根傾倒的石柱 ──
  {
    for (const sz of [-1, 1]) {
      k.box('stone', 0x6a6458, 0.9, 3.6, 0.9, T(25.2, 1.6, -8 + sz * 2.6, 0, 0.1, sz * 0.12));
    }
    k.box('stone', 0x5a554a, 0.9, 0.7, 5.8, T(25.1, 3.5, -8, 0.05, 0, 0.1));
    for (let i = 0; i < 7; i++) k.box('glow', 0x4fe6a8, 0.18, 0.04, 0.9, T(23.4 + Math.sin(i) * 0.5, 0.03, -10.6 + i * 0.75, 0, Math.sin(i * 2) * 0.6, 0));
  }
  const portals = [
    { x: -16, z: 16, label: '驛道・返青萍渡', top: 3.4 },
    { x: 23, z: -8, label: '地脈・往偃師遺墟', top: 3.4 },
  ];
  portalMarker(k, group, -16, 16, '渡', 'stele');
  portalMarker(k, group, 23, -8, '墟', 'crack');
  // 驛道上的駝隊頭領（NPC，驛站門口）
  npcs.push({ id: 'npc-station', name: '驛丞老宋', sub: '赤沙驛', kind: 'npc', look: { preset: 'chief', gender: 'Male', hair: 1, height: 0.98 }, x: -23.2, z: 15, rotY: -Math.PI / 2 - 0.4, anim: 'idle' });

  group.add(k.build({ name: 'chisha', see: true }));
  group.add(mb.build());
  let acc = 0;
  return {
    group, npcs, colliders, portals, beaconViews,
    update(dt, t) {
      acc += dt;
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        f.scale.set(1 + Math.sin(t * 13 + i) * 0.1, 1 + Math.sin(t * 9.3 + i * 2) * 0.18, 1 + Math.cos(t * 11 + i) * 0.1);
        f.rotation.y = t * (0.6 + i * 0.2);
      }
      for (const b of beaconViews) {
        if (!b.smoke.visible) continue;
        b.puffs.forEach((p, i) => {
          const ph = (t * 0.25 + i / b.puffs.length) % 1;
          p.position.set(Math.sin(ph * 4 + i) * 0.3 + ph * 0.8, ph * 3.2, Math.cos(ph * 3 + i) * 0.2);
          p.scale.setScalar(0.5 + ph * 1.4);
        });
      }
      void acc;
    },
  };
}

// ════════════════════════════════════════════
// 偃師遺墟
// ════════════════════════════════════════════
function bigGear(k, x, y, z, r, teeth, rx, ry, rz, seed, color = 0x7a6a44) {
  const sh = gearShape(r, r * 0.88, teeth, { hole: r * 0.12, spokes: 6, rim: 0.2 });
  const m = T(x, y, z, rx, ry, rz);
  k.extrude('bronze', color, sh, r * 0.12, m, 0.05, r * 0.01);
  // 銅綠斑：輪緣上一圈不規則塊
  const R = rng(seed);
  for (let i = 0; i < 18; i++) {
    const a = R() * Math.PI * 2, rr = r * (0.82 + R() * 0.06);
    const local = new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.065);
    local.applyMatrix4(m);
    k.add('stone', lumpGeo(r * 0.05, 0, 0.4, seed + i), 0x4e7a64, T(local.x, local.y, local.z, rx, ry, rz, 1, 1, 0.3));
  }
  // 輪轂
  k.cyl('bronze', 0x6a5a3a, r * 0.2, r * 0.2, r * 0.22, 16, m.clone().multiply(T(0, 0, 0, Math.PI / 2, 0, 0)));
}

function cliff(k, x, z, w, h, d, ry, seed) {
  const g = lumpGeo(1, 2, 0.28, seed);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const band = Math.sin(y * 7 + p.getX(i) * 1.3) * 0.5 + 0.5;
    const c = new THREE.Color(0x2c2e2c).lerp(new THREE.Color(0x4a4a44), band * 0.7 + (y + 1) * 0.1);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  k.add('stone', g, 0xffffff, T(x, h * 0.45, z, 0, ry, 0, w, h, d), 0);
}

function buildRuins() {
  const group = new THREE.Group();
  const k = new Kit(91);
  const colliders = [];
  const fadeGroups = [];
  const box = (x0, y0, z0, x1, y1, z1, soft = false) => { const b = new THREE.Box3(V3(x0, y0, z0), V3(x1, y1, z1)); b.soft = soft; colliders.push(b); return b; };
  const R = rng(93);

  // ── 北（−z）：機關城牆與大圓門 ──
  const WZ = -28;
  for (let course = 0; course < 9; course++) {
    const y = course * 0.9;
    const off = course % 2 ? 0.9 : 0;
    for (let x = -34 + off; x < 34; x += 1.8) {
      if (Math.hypot(x, y + 0.45 - 4.2) < 5.4 && course < 9) continue; // 圓門洞
      const w = 1.76, h = 0.86;
      k.box('stone', R() > 0.5 ? 0x5a5c56 : 0x4e504a, w, h, 2.2 + R() * 0.2, T(x + 0.9, y + 0.45, WZ + (R() - 0.5) * 0.1), 0.05);
    }
  }
  box(-34, 0, WZ - 1.2, 34, 8.5, WZ + 1.2);
  // 牆頂垛口與銅飾帶
  for (let x = -33; x < 34; x += 2.4) k.box('stone', 0x585a54, 1.2, 0.9, 1.6, T(x, 8.5, WZ + 0.3));
  k.box('bronze', 0x7a6440, 68, 0.3, 0.1, T(0, 7.6, WZ + 1.15));
  // 圓門：齒輪門扇（半開），門框是生了綠鏽的銅環
  bigGear(k, 0, 4.2, WZ + 0.5, 5.0, 36, 0, 0, 0.2, 31, 0x86704a);
  k.torus('bronze', 0x4f6c5a, 5.45, 0.14, 6, 64, Math.PI * 2, T(0, 4.2, WZ + 1.15)); // 門框：生銅綠鏽，不發光
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box('bronze', 0x6a5a3a, 0.5, 0.9, 0.5, T(Math.cos(a) * 5.7, 4.2 + Math.sin(a) * 5.7, WZ + 1.2, 0, 0, a));
  }
  // 牆上嵌的齒輪與連桿
  for (const [x, y, r] of [[-15, 4.5, 2.2], [-22, 3, 1.4], [14, 5, 2.6], [23, 3.4, 1.6], [-9, 6.5, 1.0], [9, 2.2, 1.1]]) bigGear(k, x, y, WZ + 1.2, r, Math.round(r * 9), 0, 0, R(), 40 + x, 0x7a6640);
  k.box('bronze', 0x6a5838, 7.5, 0.3, 0.3, T(-18.5, 3.9, WZ + 1.45, 0, 0, 0.21));
  k.box('bronze', 0x6a5838, 9.5, 0.3, 0.3, T(18.5, 4.2, WZ + 1.45, 0, 0, -0.17));

  // ── 匯入的石刻與青銅器：城牆上嵌一塊佛龕浮雕與一面盤龍石盤，圓門兩側一對石獅、一對武士石像 ──
  const mb = new Batch('ruins-models');
  mb.add('relief_buddhas', -5.6, 2.2, WZ + 1.36, 0, 1.4);
  // 佛龕浮雕西側再嵌一塊人物故事石雕板（bk_relief，1.33×0.91 m，放大 1.4 倍），底緣與佛龕齊平
  mb.add('bk_relief', -10.0, 2.2, WZ + 1.36, 0, 1.4);
  mb.add('dragon_disc', 6.4, 5.0, WZ + 1.42, 0, 1.0);
  for (const sx of [-1, 1]) {
    mb.add('lion_stone', sx * 4.4, 0, -24.9, sx * -0.12, 1.0);
    mb.add('general_statue', sx * 8.6, 0, -24.6, sx * -0.2, 1.15, { whole: true });
  }
  // 兩側崖腳：一隻有翼石獸、一隻蹲在東邊；場中兩座石台上擺方鼎、圓鼎，出生點旁一只博山爐
  mb.add('beast_winged', -22.4, 0, -5.6, Math.PI / 2 - 0.3, 1.2, { whole: true });
  mb.add('beast_winged', 22.6, 0, -9.4, -Math.PI / 2 + 0.25, 1.2, { whole: true });
  for (const [x, z, id, r] of [[-12.5, -17, 'fangding', 0.3], [12.5, -17, 'ding_bronze', -0.4]]) {
    k.box('stone', 0x5a5c56, 1.6, 0.5, 1.6, T(x, 0.25, z, 0, r, 0));
    k.box('stone', 0x4e504a, 1.8, 0.12, 1.8, T(x, 0.06, z, 0, r, 0));
    mb.add(id, x, 0.5, z, r, 1.15);
  }
  // 出生點前方左側：雕花鼓腰石案（bk_stone_desk，取代原本的方石墩）上擺博山爐；右側對一座太湖石立峰（bk_scholar_rock，整件溶）
  mb.add('bk_stone_desk', -3.4, 0, 7.2, 0.3, 1.0);
  mb.add('boshanlu', -3.4, 0.846, 7.2, 0.4, 1.3);
  mb.add('bk_scholar_rock', 4.2, 0, 6.2, -0.5, 1.0, { whole: true });
  // 西崖：鑿進崖壁的一座石窟（grotto_cave 縮到 55%，窟口在模型 +X、背面是空殼，背靠崖壁、窟口朝場內）。
  // 掃描是一塊淺灰砂岩、四周是不規則切邊：切邊後面墊一圈同色調的程式岩塊（兩側、背後），跟深色的崖壁之間有一段過渡。
  // 模型不能再往崖裡推：北邊那塊崖（x −35, z 18）會蓋住窟裡的佛像
  // 石窟自成一個批次（掃描本來就是獨立材質，不多 draw call），才能跟墊岩一起整窟溶解（fadeGroups）
  const gb = new Batch('ruins-grotto');
  gb.add('grotto_cave', -28.2, -0.66, 11.2, 0, 0.55);
  const grottoMesh = gb.build();
  group.add(grottoMesh);
  const grottoBox = new THREE.Box3(V3(-32, 0, 4.2), V3(-24.6, 7.8, 18.2));
  let grottoRocks;
  {
    // 這幾塊不投影（另成一個 mesh）：投下來的影子會把窟裡的佛像整個蓋黑
    const rk = new Kit(97);
    const rock = (x, y, z, sx, sy, sz, ry, seed, dark = 0) => {
      const g = lumpGeo(1, 2, 0.3, seed);
      const p = g.attributes.position;
      const col = new Float32Array(p.count * 3);
      const lo = new THREE.Color(0x9a9a92).lerp(new THREE.Color(0x2c2e2c), dark), hi = new THREE.Color(0xdcdad0).lerp(new THREE.Color(0x4a4a44), dark);
      for (let i = 0; i < p.count; i++) {
        const band = Math.sin(p.getY(i) * 6 + p.getX(i) * 1.7 + seed) * 0.5 + 0.5;
        const c = lo.clone().lerp(hi, band * 0.6 + (p.getY(i) + 1) * 0.2);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const M = T(x, y, z, 0, ry, 0, sx, sy, sz);
      rk.add('stone', g, 0xffffff, M, 0);
      g.computeBoundingBox();
      return g.boundingBox.clone().applyMatrix4(M); // 世界 AABB（相機防擋盒要包住兩側墊岩）
    };
    // 岩塊都放在掃描正面（x ≈ −25.5）後面，只從切邊外露出來，不擋窟口與佛像
    rock(-33.2, 5.0, 11.2, 2.6, 5.8, 8.8, 0.05, 301, 0.3); // 窟後的整塊岩體：從掃描頂緣後面露出來，往外接深色崖壁
    // 石窟的相機防擋盒包住窟口與兩側墊岩（墊岩伸到 z 3.7、18.7 再往外 ±1.7 多，舊盒子只到 4.2～18.2）
    grottoBox.union(rock(-28.2, 3.0, 3.7, 2.2, 3.8, 1.7, 0.3, 303)); // 南側岩壁
    grottoBox.union(rock(-28.3, 3.2, 18.7, 2.2, 4.0, 1.7, -0.25, 304)); // 北側岩壁
    grottoBox.union(rock(-29.4, 2.8, 16.0, 1.8, 3.2, 1.4, 0.15, 307)); // 北側岩壁與窟緣之間的縫
    for (const [z, s] of [[5.2, 0.8], [17.3, 0.9]]) rock(-25.6, 0.15, z, 1.0 * s, 0.6 * s, 1.1 * s, z, 310 + z); // 窟口兩角的碎岩
    grottoRocks = rk.build({ shadow: false, name: 'grotto-rocks', see: true });
    group.add(grottoRocks);
  }
  grottoBox.min.y = 0;
  // 防擋盒是 soft：盒子南北伸到 z 1.35～21.35、東緣 x −24.6，包住了主角走得到的西緣走帶（|x| ≤ 25.5）。
  // 硬盒會在主角貼著窟口、鏡頭朝西時把鏡頭夾到 3.5 m、俯角爬到頂，主角掉出畫面；改成鏡頭穿過去，整窟（掃描＋墊岩）溶掉。
  // 溶解盒只取走帶以西（x ≤ −25.6）：預設追尾鏡頭在主角南北方向時線段不經過，主角沿西緣走不會讓石窟消失
  grottoBox.soft = true;
  colliders.push(grottoBox);
  const grottoFadeBox = grottoBox.clone();
  grottoFadeBox.max.x = -25.6;
  fadeGroups.push({ box: grottoFadeBox, objs: [grottoMesh, grottoRocks] });

  // ── 兩側崖壁與前方山壁 ──
  const cl = [
    [-36, -18, 7, 15, 12, 0.2], [-38, 0, 8, 18, 12, -0.3], [-35, 18, 7, 13, 12, 0.1], [-26, 34, 12, 14, 7, 0.4],
    [36, -16, 7, 16, 12, -0.2], [38, 2, 8, 14, 13, 0.3], [35, 20, 7, 17, 11, -0.1], [24, 35, 12, 12, 8, -0.4], [0, 38, 14, 10, 8, 0],
    [-30, -32, 10, 18, 7, 0.3], [30, -33, 10, 20, 7, -0.3],
  ];
  cl.forEach(([x, z, w, h, d, ry], i) => {
    cliff(k, x, z, w, h, d, ry, 120 + i);
    box(x - w * 0.8, 0, z - d * 0.8, x + w * 0.8, h, z + d * 0.8);
  });

  // ── 半埋的巨齒輪與連桿 ──
  bigGear(k, -28.5, 2.4, -11, 7, 48, 0.15, Math.PI / 2, 0, 11);
  bigGear(k, 28.8, 1.8, -19, 6, 40, -0.1, Math.PI / 2 - 0.2, 0.3, 12, 0x6e6040);
  bigGear(k, 28, 0.4, 13, 4.5, 30, Math.PI / 2 - 0.35, 0.3, 0, 13, 0x7c6a44);
  bigGear(k, -27.5, 0.6, 21.8, 3.8, 26, Math.PI / 2 - 0.5, -0.4, 0, 14, 0x86704a);
  bigGear(k, -26, 1.2, 1.4, 2.4, 18, 0.2, Math.PI / 2 + 0.3, 0, 15, 0x6e6040);
  // 連桿：長銅條＋銷軸
  for (const [a, b, r] of [[[-28, 2.5, -4], [-25.2, 0.3, 2.6], 0.32], [[28.5, 2, -12], [26.2, 0.2, 2], 0.3], [[-22, 0.4, -24], [-28, 3.2, -16], 0.28], [[22, 0.2, 26.5], [28, 1.8, 17], 0.26]]) {
    k.rod('bronze', 0x6e5c3a, a, b, r, 8);
    for (const p of [a, b]) k.cyl('bronze', 0x86704a, r * 1.6, r * 1.6, r * 1.4, 12, T(p[0], p[1], p[2], 0, 0, Math.PI / 2));
  }
  // ── 殘柱、石塊、機關燈 ──
  for (const [x, z, h] of [[-15, -12, 3.5], [15, -12, 2.6], [-21, 6, 4.2], [21, 8, 3.2], [-12, 22, 2.2], [12, 23, 3.8], [-6, -22, 1.6], [6, -22, 2.8]]) {
    k.cyl('stone', 0x5e605a, 0.65, 0.72, h, 10, T(x, h / 2, z), 0.05);
    k.box('stone', 0x55574f, 1.7, 0.4, 1.7, T(x, 0.2, z));
    for (let i = 0; i < 3; i++) k.add('stone', lumpGeo(0.3 + R() * 0.4, 0, 0.3, 700 + i + x), 0x55574f, T(x + (R() - 0.5) * 3, 0.15, z + (R() - 0.5) * 3, R(), R(), R()));
    // 柱身上的銅箍
    k.cyl('bronze', 0x7a6440, 0.74, 0.74, 0.18, 12, T(x, Math.min(h - 0.3, 1.6), z));
  }
  for (const [x, z] of [[-11, 14], [11, 14], [-15, -3], [15, -3], [-9, -19], [9, -19], [-4, 18], [4, 18]]) {
    // 機關燈：石座、銅籠、冷綠樞芯
    k.box('stone', 0x5a5c56, 0.5, 1.4, 0.5, T(x, 0.7, z));
    k.box('stone', 0x4e504a, 0.7, 0.2, 0.7, T(x, 1.5, z));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      k.cyl('bronze', 0x86704a, 0.025, 0.025, 0.6, 5, T(x + Math.cos(a) * 0.22, 1.9, z + Math.sin(a) * 0.22));
    }
    k.cone('bronze', 0x7a6440, 0.36, 0.3, 4, T(x, 2.35, z, 0, Math.PI / 4, 0));
    k.sphere('glow', 0x5af0b0, 0.15, 10, 8, T(x, 1.9, z));
  }
  // 地面上的地脈槽（石砌導槽，槽底冷綠光）
  // 南邊兩條斜向兩側、停在 z 20 以內：正對出生點鏡頭（z ≈ 25）的地槽在畫面底部會縮成一根暗綠直柱
  for (const [x0, z0, x1, z1] of [[-24, -6, -8, -2], [8, -1, 24, -7], [13, 20, 4, 13], [-20, 20, -9, 12]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    k.box('stone', 0x45473f, 0.9, 0.14, len, T((x0 + x1) / 2, 0.07, (z0 + z1) / 2, 0, ry, 0));
    for (const sx of [-0.36, 0.36]) k.box('stone', 0x55574f, 0.18, 0.2, len, T((x0 + x1) / 2 + Math.cos(ry) * sx, 0.1, (z0 + z1) / 2 - Math.sin(ry) * sx, 0, ry, 0));
    k.box('glow', 0x167a52, 0.12, 0.02, len, T((x0 + x1) / 2, 0.15, (z0 + z1) / 2, 0, ry, 0));
  }
  // 傳送：兩座石環門
  const portals = [
    { x: -17, z: 14, label: '石環・返青萍渡', top: 4.6 },
    { x: 20, z: 0, label: '石環・往赤沙驛', top: 4.6 },
  ];
  for (const p of portals) {
    const ry = p.x < 0 ? 0.6 : -Math.PI / 2;
    const g = new Kit(95);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 1.0;
      g.box('stone', 0x5a5c56, 0.9, 0.7, 0.8, T(Math.cos(a) * 2.4, Math.sin(a) * 2.4 + 0.35, 0, 0, 0, a + Math.PI / 2));
    }
    for (const sx of [-1, 1]) g.box('stone', 0x55574f, 0.9, 0.5, 0.9, T(sx * 2.4, 0.15, 0));
    g.torus('glow', 0x3fd89a, 2.0, 0.05, 5, 40, Math.PI, T(0, 0.35, 0.42));
    k.merge(g, T(p.x + Math.sin(ry) * 1.9, 0, p.z + Math.cos(ry) * 1.9, 0, ry, 0));
  }
  portalMarker(k, group, -17, 14, '渡', 'crack');
  portalMarker(k, group, 20, 0, '沙', 'crack');

  group.add(k.build({ name: 'ruins', see: true }));
  group.add(mb.build());
  // 夜裡的機樞綠光：從場中高處斜打圓門。放在門前 2.5 m 時，銅輪轂會映出一顆亮綠光球（像發光體），所以退到場中、抬高
  const l1 = new THREE.PointLight(0x4ff0a8, 70, 30, 1.6);
  l1.position.set(0, 9, WZ + 11);
  group.add(l1);
  return { group, npcs: [], colliders, portals, beaconViews: [], fadeGroups, update() {} };
}

export function buildMapSceneryV2(mapId, opts) {
  if (mapId === 1002) return buildChisha(opts);
  if (mapId === 2001) return buildRuins(opts);
  return buildQingping(opts);
}

export { building, hangingLantern, lanternPost, crate, sack, jar, flagpole, lattice, flipGeo, pennantMesh };
export const _mat = MAT;
