// 道具與任務改版的場景：煙火、外送機車、空運貨機、帝國號遊艇、吉祥物「浪浪」、
// 全城建設（公園表演台、救生員塔、東區立體停車場）與店家設備（霓虹招牌、雨棚、海灘暖爐）。
// 靜態的部分每樣一個網格、狀態改變時重建；會動的東西各自一個小網格或 InstancedMesh。
import * as THREE from 'three';
import { Builder, T, prng } from './geo.js';
import { CITY_LOTS, lotRect, floorOf, BEACH, SAND_Y, STAGE, PARKING, CORE_AVES_Z, PROM } from './layout.js';
import { floorY } from './interior.js';
import { PAL } from './world.js';
import { BIZ_BY_ID } from './data.js';
import { SEA_Y } from './sea.js';

const TBOX = T.box;
const matS = new THREE.MeshLambertMaterial({ vertexColors: true });
// 夜裡變亮的發光材質（霓虹、舞台燈、暖爐）
const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.55, 0.55, 0.55) });
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _c = new THREE.Color();
const lighten = (hex, k) => '#' + _c.set(hex).lerp(new THREE.Color('#ffffff'), k).getHexString();

// ───────── 店家設備 ─────────
function neonSign(S, B, id) {
  const rr = lotRect(...CITY_LOTS[id]);
  const f = floorOf(id), y = floorY(f);
  const x = rr.x0 + 0.5, z = rr.z1 - 0.25, c = BIZ_BY_ID[id].color;
  // 立在店面左前角的直式招牌：深色框、亮色字條、上下兩道燈管
  S.box(x - 0.08, y, z - 0.08, x + 0.08, y + 6.4, z + 0.08, PAL.lampPole);
  S.box(x - 0.22, y + 3.1, z - 0.05, x + 0.22, y + 6.2, z + 1.25, '#23262b');
  B.box(x - 0.26, y + 3.3, z + 0.08, x + 0.26, y + 6.0, z + 1.12, lighten(c, 0.35));
  for (let k = 0; k < 4; k++) B.box(x - 0.3, y + 3.55 + k * 0.62, z + 0.25, x + 0.3, y + 3.85 + k * 0.62, z + 0.95, '#fff4d6');
  B.box(x - 0.27, y + 6.25, z - 0.05, x + 0.27, y + 6.35, z + 1.25, '#ffd36b');
  B.box(x - 0.27, y + 2.95, z - 0.05, x + 0.27, y + 3.05, z + 1.25, '#ffd36b');
}
// 海灘商家的雨棚：四根柱子撐起條紋帆布，下面兩張桌椅
function awning(S, id) {
  const p = id === 'boat' ? { x: 33, z: 22 } : id === 'umbrella' ? { x: -45, z: 25 } : { x: BEACH[id].x + 6, z: BEACH[id].z + 1.5 };
  const w = 6, d = 4.4, y = SAND_Y, c = BIZ_BY_ID[id].color;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.cyl(p.x + dx * (w / 2 - 0.2), y, p.z + dz * (d / 2 - 0.2), 0.08, 2.7, PAL.white, 6);
  for (let k = 0; k < 6; k++) {
    const x0 = p.x - w / 2 + (k * w) / 6;
    S.box(x0, y + 2.7, p.z - d / 2 - 0.2, x0 + w / 6, y + 2.86, p.z + d / 2 + 0.2, k % 2 ? PAL.white : c);
  }
  S.box(p.x - w / 2, y + 2.4, p.z + d / 2 + 0.1, p.x + w / 2, y + 2.7, p.z + d / 2 + 0.2, c);
  for (const dx of [-1.4, 1.4]) {
    S.cyl(p.x + dx, y, p.z, 0.55, 0.75, PAL.white, 8);
    S.box(p.x + dx - 0.25, y, p.z + 0.8, p.x + dx + 0.25, y + 0.45, p.z + 1.2, PAL.wood);
    S.box(p.x + dx - 0.25, y, p.z - 1.2, p.x + dx + 0.25, y + 0.45, p.z - 0.8, PAL.wood);
  }
}
// 海灘暖爐（道具）：傘位旁一排戶外暖爐
function heaters(S, B) {
  for (let k = 0; k < 6; k++) {
    const x = -40 + k * 5.4, z = 21.5 + (k % 2) * 6;
    S.cyl(x, SAND_Y, z, 0.35, 0.12, PAL.metal, 8);
    S.cyl(x, SAND_Y, z, 0.07, 2.1, PAL.metal, 6);
    S.add(T.cone8, x, SAND_Y + 2.1, z, 1.1, 0.35, 1.1, 0, '#5b6466', Math.PI);
    B.cyl(x, SAND_Y + 1.55, z, 0.16, 0.5, '#ff9a3c', 8);
  }
}

// ───────── 全城建設 ─────────
function stageGeo(S, B) {
  const { x, z, w, d } = STAGE, y = 0.32;
  S.box(x - w / 2, y, z - d / 2, x + w / 2, y + 0.9, z + d / 2, PAL.woodDark);
  S.box(x - w / 2 - 0.05, y + 0.9, z - d / 2 - 0.05, x + w / 2 + 0.05, y + 1.0, z + d / 2 + 0.05, PAL.wood);
  for (let k = 0; k < 3; k++) S.box(x - 1.2, y, z + d / 2 + k * 0.32, x + 1.2, y + 0.9 - k * 0.3, z + d / 2 + 0.32 + k * 0.32, PAL.wood2);
  // 背板與遮棚
  S.box(x - w / 2, y + 1, z - d / 2, x + w / 2, y + 4.6, z - d / 2 + 0.2, '#7a3b3b');
  for (const sx of [-1, 1]) S.box(x + sx * (w / 2 - 0.15) - 0.15, y + 1, z - d / 2, x + sx * (w / 2 - 0.15) + 0.15, y + 4.9, z + d / 2, PAL.lampPole);
  S.box(x - w / 2 - 0.3, y + 4.9, z - d / 2 - 0.3, x + w / 2 + 0.3, y + 5.15, z + d / 2 + 0.4, '#b4513c');
  for (let k = 0; k < 8; k++) S.box(x - w / 2 + k * (w / 8), y + 4.6, z + d / 2 + 0.2, x - w / 2 + (k + 0.5) * (w / 8), y + 4.9, z + d / 2 + 0.4, k % 2 ? '#e9c46a' : PAL.white);
  // 喇叭與燈
  for (const sx of [-1, 1]) {
    S.box(x + sx * (w / 2 - 0.9) - 0.5, y + 1, z - d / 2 + 0.4, x + sx * (w / 2 - 0.9) + 0.5, y + 2.6, z - d / 2 + 1.2, '#2a2f3a');
    B.ball(x + sx * (w / 2 - 0.9), y + 1.9, z - d / 2 + 1.22, 0.28, '#5d6b67');
  }
  for (let k = 0; k < 5; k++) B.ball(x - w / 2 + 0.8 + k * ((w - 1.6) / 4), y + 4.45, z + d / 2 + 0.1, 0.16, '#ffe2a0');
  // 麥克風架
  S.cyl(x + 1.6, y + 1, z + 0.6, 0.03, 1.5, PAL.metal, 6);
}
// 表演者：吉他手（身體＋頭＋吉他），每幀上下擺動
function performerGeo() {
  const S = new Builder();
  S.add(TBOX, 0, 0, 0, 0.42, 0.85, 0.3, 0, '#2a2f3a');
  S.add(TBOX, 0, 0.85, 0, 0.55, 0.7, 0.34, 0, '#e9c46a');
  S.ball(0, 1.6, 0, 0.22, '#d8a383');
  S.add(TBOX, 0, 1.78, 0, 0.5, 0.08, 0.5, 0, '#7a3b3b');
  S.add(T.ico, 0.05, 0.9, 0.3, 0.6, 0.5, 0.18, 0.5, '#b5793a');
  S.add(TBOX, -0.35, 1.25, 0.3, 0.7, 0.07, 0.07, 0.5, '#4a3626');
  return S.geometry();
}
function lifeguardGeo(S, B) {
  const x = -58, z = 31, y = SAND_Y;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.add(TBOX, x + dx * 1.1, y, z + dz * 1.0, 0.18, 4.2, 0.18, 0, PAL.white, dz * 0.08, -dx * 0.08);
  S.box(x - 1.5, y + 4, z - 1.4, x + 1.5, y + 4.2, z + 1.6, PAL.wood);
  S.box(x - 1.3, y + 4.2, z - 1.2, x + 1.3, y + 6.2, z + 0.8, '#c8453c');
  S.box(x - 1.32, y + 5.0, z + 0.5, x + 1.32, y + 5.9, z + 0.82, '#34474c');
  S.box(x - 1.32, y + 4.4, z + 0.5, x + 1.32, y + 4.9, z + 0.82, PAL.white);
  S.add(T.prism, x, y + 6.2, z - 0.2, 3.2, 1.1, 2.6, Math.PI / 2, PAL.white);
  // 樓梯、旗子、救生圈、救生板
  for (let k = 0; k < 7; k++) S.box(x - 0.5, y + 0.4 + k * 0.55, z + 1.6 + (6 - k) * 0.32, x + 0.5, y + 0.5 + k * 0.55, z + 1.95 + (6 - k) * 0.32, PAL.wood2);
  S.cyl(x + 1.6, y + 4, z - 1.2, 0.04, 3.6, PAL.metal, 6);
  S.box(x + 1.64, y + 6.6, z - 1.22, x + 2.9, y + 7.4, z - 1.18, '#e9b93a');
  S.add(T.ico, x + 1.36, y + 4.8, z + 0.86, 0.8, 0.8, 0.2, 0, '#e0763a');
  S.add(T.ico, x - 2.0, y, z + 0.8, 0.6, 0.25, 3.0, 0.3, '#c8453c', 0, 1.2);
  B.ball(x, y + 6.4, z + 0.9, 0.18, '#ffe2a0');
}
// 東區停車場：沒蓋之前是畫線的平面停車場（world.js 畫），蓋了之後是三層開放式立體停車場
function parkingGeo(S, B) {
  const { x0, x1, z0, z1 } = PARKING, y = 0.24;
  const lv = 3, gap = 3.2;
  for (let k = 0; k <= lv; k++) {
    const yy = y + k * gap;
    S.box(x0, yy, z0, x1, yy + 0.35, z1, k === lv ? '#8a908c' : '#a9ada6');
    if (k) {
      // 欄杆帶與車道線
      S.box(x0, yy + 0.35, z1 - 0.15, x1, yy + 1.15, z1, '#d9d1bd', true);
      S.box(x1 - 0.15, yy + 0.35, z0, x1, yy + 1.15, z1, '#d9d1bd', true);
      for (let s = 0; s < 8; s++) S.box(x0 + 2 + s * 3.4, yy + 0.351, z0 + 1, x0 + 2.1 + s * 3.4, yy + 0.36, z0 + 6, PAL.line, true);
    }
  }
  for (let cx = x0 + 0.6; cx < x1; cx += 7.4) for (const cz of [z0 + 0.6, (z0 + z1) / 2, z1 - 0.6]) S.box(cx - 0.3, y, cz - 0.3, cx + 0.3, y + lv * gap, cz + 0.3, '#c9c3b0');
  // 坡道與樓梯間
  S.box(x1 - 4.5, y, z0 + 1, x1 - 0.5, y + lv * gap + 2.4, z0 + 5, '#3f7a8c');
  B.box(x1 - 4.4, y + lv * gap + 0.6, z0 + 5.02, x1 - 0.6, y + lv * gap + 2.1, z0 + 5.1, '#7fc0d6');
  // P 字招牌（藍底白字）
  const sx = x0 + 2, sy = y + lv * gap + 0.4, sz = z1 + 0.1;
  S.box(sx, y, sz - 0.1, sx + 0.2, sy + 3.6, sz + 0.1, PAL.lampPole);
  B.box(sx - 1.0, sy + 0.8, sz + 0.12, sx + 1.4, sy + 3.4, sz + 0.2, '#24476b');
  B.box(sx - 0.4, sy + 1.2, sz + 0.21, sx, sy + 3.0, sz + 0.24, '#ffffff');
  B.box(sx, sy + 2.6, sz + 0.21, sx + 0.8, sy + 3.0, sz + 0.24, '#ffffff');
  B.box(sx, sy + 1.9, sz + 0.21, sx + 0.8, sy + 2.2, sz + 0.24, '#ffffff');
  B.box(sx + 0.6, sy + 2.1, sz + 0.21, sx + 0.9, sy + 2.7, sz + 0.24, '#ffffff');
  // 停在各層的車
  const rnd = prng(19), CAR = ['#c8453c', '#2f7f8f', '#d9a63e', '#f4f1e6', '#2a2f3a', '#5d8a93'];
  for (let k = 1; k <= lv; k++) for (let s = 0; s < 8; s++) {
    if (rnd() < 0.35) continue;
    const cx = x0 + 3.7 + s * 3.4, yy = y + k * gap + 0.35, c = CAR[Math.floor(rnd() * CAR.length)];
    S.box(cx - 0.85, yy + 0.2, z0 + 1.4, cx + 0.85, yy + 0.85, z0 + 5.6, c);
    S.box(cx - 0.75, yy + 0.85, z0 + 2.4, cx + 0.75, yy + 1.4, z0 + 4.6, '#34474c');
  }
}

// ───────── 帝國號、吉祥物、外送機車、貨機、煙火 ─────────
function yachtGeo(color) {
  const S = new Builder();
  S.add(TBOX, 0, -0.8, 0, 3.6, 1.9, 10, 0, '#fbf8ee');
  S.add(T.cone4, 0, -0.8, 5, 3.6, 1.9, 3.4, 0, '#fbf8ee', Math.PI / 2);
  S.add(TBOX, 0, 0.3, 0, 3.66, 0.36, 10.04, 0, color);
  S.add(TBOX, 0, 0.66, -0.4, 3.2, 0.1, 8.6, 0, PAL.wood);
  S.add(TBOX, 0, 0.76, -1.2, 2.7, 1.4, 4.6, 0, '#fbf8ee');
  S.add(TBOX, 0, 1.35, 0.4, 2.74, 0.6, 1.6, 0, '#34444b');
  S.add(TBOX, 0, 2.16, -1.6, 2.1, 0.9, 2.8, 0, '#fbf8ee');
  S.add(TBOX, 0, 2.5, -0.1, 2.14, 0.4, 0.6, 0, '#34444b');
  S.add(TBOX, 0, 3.06, -1.8, 2.3, 0.12, 3.2, 0, '#d9a63e');
  S.cyl(0, 3.1, -2.6, 0.05, 2.2, PAL.metal, 6);
  S.add(TBOX, 0, 4.4, -2.0, 0.04, 0.8, 1.3, 0, color);
  return S.geometry();
}
function mascotGeo(color) {
  const S = new Builder();
  S.add(TBOX, -0.25, 0, 0, 0.3, 0.6, 0.34, 0, '#e0763a');
  S.add(TBOX, 0.25, 0, 0, 0.3, 0.6, 0.34, 0, '#e0763a');
  S.add(T.ico1, 0, 0.5, 0, 1.6, 1.9, 1.4, 0, '#f4f1e6');
  S.add(T.ico1, 0, 2.15, 0, 1.15, 1.1, 1.1, 0, '#fbf8ee');
  S.add(T.cone8, 0, 2.6, 0.5, 0.45, 0.9, 0.3, 0, '#e9a23a', Math.PI / 2);
  S.ball(-0.28, 2.85, 0.42, 0.1, '#1f2a2c');
  S.ball(0.28, 2.85, 0.42, 0.1, '#1f2a2c');
  S.cyl(0, 3.1, 0, 0.5, 0.25, color, 12);
  S.add(TBOX, 0, 3.15, 0.45, 0.8, 0.08, 0.5, 0, color);
  // 翅膀
  S.add(T.ico, -0.9, 1.2, 0, 0.35, 1.1, 0.8, 0, '#d8d4c8', 0, 0.4);
  S.add(T.ico, 0.9, 1.2, 0, 0.35, 1.1, 0.8, 0, '#d8d4c8', 0, -0.4);
  // 綵帶
  S.add(TBOX, 0, 1.35, 0.68, 1.4, 0.3, 0.06, 0, color, 0, 0.25);
  return S.geometry();
}
function scooterGeo() {
  const S = new Builder();
  S.cyl(0, 0, -0.55, 0.26, 0.12, '#1f2a2c', 8);
  S.cyl(0, 0, 0.55, 0.26, 0.12, '#1f2a2c', 8);
  S.add(TBOX, 0, 0.2, 0, 0.42, 0.35, 1.3, 0, '#c8453c');
  S.add(TBOX, 0, 0.55, -0.25, 0.4, 0.15, 0.6, 0, '#2a2f3a');
  S.add(TBOX, 0, 0.55, 0.5, 0.12, 0.6, 0.12, 0, PAL.metal);
  S.add(TBOX, 0, 1.12, 0.5, 0.6, 0.06, 0.08, 0, PAL.metal);
  // 外送箱與騎士
  S.add(TBOX, 0, 0.75, -0.62, 0.62, 0.55, 0.55, 0, '#e9b93a');
  S.add(TBOX, 0, 0.7, -0.15, 0.4, 0.6, 0.3, 0, '#c8453c');
  S.ball(0, 1.3, -0.12, 0.2, '#f4f1e6');
  return S.geometry();
}
function planeGeo() {
  const S = new Builder();
  S.add(TBOX, 0, -0.9, 0, 1.8, 1.8, 14, 0, '#f4f1e6');
  S.add(T.cone8, 0, -0.9, 7, 1.8, 2.2, 1.8, 0, '#f4f1e6', Math.PI / 2);
  S.add(TBOX, 0, -0.2, -0.5, 18, 0.18, 2.6, 0, '#d8d4c8');
  S.add(TBOX, 0, 0, -6.5, 6, 0.14, 1.6, 0, '#d8d4c8');
  S.add(TBOX, 0, 0, -6.6, 0.16, 2.6, 1.8, 0, '#b4513c');
  S.add(TBOX, 0, -0.95, 0, 1.84, 0.3, 14.02, 0, '#b4513c');
  for (const sx of [-4, 4]) S.cyl(sx, -0.75, -0.2, 0.45, 1.6, '#7d8784', 8);
  return S.geometry();
}

// 煙火：每發一顆，升空後在高處炸成一圈粒子，粒子受重力下墜、慢慢變暗
const FW = { max: 900, per: 70 };
const FW_COLORS = ['#ffd36b', '#ff6b6b', '#7fd1ff', '#b7ff8a', '#ff9de2', '#ffffff'];
function createFireworks(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(FW.max * 3), col = new Float32Array(FW.max * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  // 正交鏡頭下 PointsMaterial 不會依距離縮放，size 是螢幕像素：由 setScale 依縮放換算
  // 圓形柔邊的光點（畫在 canvas 上），避免方形粒子
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const g2 = dot.getContext('2d'), rg = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.3, 'rgba(255,255,255,.8)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = rg;
  g2.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ size: 3, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  const P = Array.from({ length: FW.max }, () => ({ life: 0 }));
  const rockets = [];
  let next = 0, cur = 0, onBurst = null;
  const rnd = prng(41);
  function burst(x, y, z) {
    const c = new THREE.Color(FW_COLORS[Math.floor(rnd() * FW_COLORS.length)]);
    const sp = 13 + rnd() * 7;
    for (let k = 0; k < FW.per; k++) {
      const p = P[cur];
      cur = (cur + 1) % FW.max;
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      Object.assign(p, { x, y, z, vx: r * Math.cos(th) * sp, vy: u * sp + 2, vz: r * Math.sin(th) * sp, life: 1.6 + rnd() * 0.8, max: 2.4, r: c.r, g: c.g, b: c.b });
    }
    if (onBurst) onBurst(x, y, z);
  }
  return {
    pts,
    set onBurst(f) { onBurst = f; },
    // px：每一個世界單位在畫面上的像素數
    setScale(px) { mat.size = Math.max(3, px * 0.75); },
    // 讓畫面層判斷「煙火是不是在畫面裡」
    center: () => (rockets.length || P.some((p) => p.life > 0) ? [60, 48, 95] : null),
    update(dt, on) {
      if (on) {
        next -= dt;
        if (next <= 0) {
          next = 0.45 + rnd() * 0.7;
          rockets.push({ x: 10 + rnd() * 110, z: 80 + rnd() * 40, y: SEA_Y, vy: 34 + rnd() * 8, top: 38 + rnd() * 18 });
        }
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy * dt;
        r.vy -= 6 * dt;
        if (r.y >= r.top || r.vy < 4) { burst(r.x, r.y, r.z); rockets.splice(i, 1); }
      }
      let n = 0;
      for (const p of P) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) continue;
        p.vx *= 1 - dt * 0.9; p.vz *= 1 - dt * 0.9; p.vy = p.vy * (1 - dt * 0.9) - 5 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const k = Math.min(1, p.life / p.max * 1.6);
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
        col[n * 3] = p.r * k; col[n * 3 + 1] = p.g * k; col[n * 3 + 2] = p.b * k;
        n++;
      }
      // 火箭本身也畫一個亮點
      for (const r of rockets) {
        if (n >= FW.max) break;
        pos[n * 3] = r.x; pos[n * 3 + 1] = r.y; pos[n * 3 + 2] = r.z;
        col[n * 3] = 1; col[n * 3 + 1] = 0.85; col[n * 3 + 2] = 0.6;
        n++;
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      pts.visible = n > 0;
    },
  };
}

// 店門口前面那條路：店面朝 +z，前面是最近的東西向道路
function laneOf(id) {
  const rr = lotRect(...CITY_LOTS[id]);
  let ave = CORE_AVES_Z[0];
  for (const z of CORE_AVES_Z) if (z > rr.z1 && (ave < rr.z1 || z < ave)) ave = z;
  return { x: (rr.x0 + rr.x1) / 2, z0: rr.z1 + 0.6, lane: ave - 2.6 };
}

export function createExtras(scene, sea) {
  const meshes = {};
  const put = (k, build) => {
    if (meshes[k]) for (const m of meshes[k]) { m.parent.remove(m); m.geometry.dispose(); }
    meshes[k] = [];
    if (!build) return;
    const S = new Builder(), B = new Builder();
    build(S, B);
    if (!S.empty) meshes[k].push(S.mesh(matS));
    if (!B.empty) meshes[k].push(B.mesh(neonMat, { cast: false, receive: false }));
    for (const m of meshes[k]) scene.add(m);
  };
  // 表演者
  const performer = new THREE.Mesh(performerGeo(), matS);
  performer.castShadow = true;
  performer.visible = false;
  scene.add(performer);
  // 帝國號
  let yacht = null, yachtColor = '';
  const Y = { a: 0, x: 0, z: 0, yaw: 0, on: false };
  // 吉祥物
  let mascot = null, mascotColor = '';
  const M = { x: -40, z: (PROM.z0 + PROM.z1) / 2, dir: 1, pause: 0, on: false, t: 0 };
  // 外送機車
  const scooters = new THREE.InstancedMesh(scooterGeo(), matS, 10);
  scooters.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scooters.castShadow = true;
  scooters.frustumCulled = false;
  scene.add(scooters);
  const SC = [];
  // 貨機
  const plane = new THREE.Mesh(planeGeo(), matS);
  plane.visible = false;
  plane.castShadow = true;
  scene.add(plane);
  const PL = { t: 0, on: false, done: null };
  const fireworks = createFireworks(scene);

  const api = {
    fireworks,
    setGear(gear) {
      put('neon', (S, B) => { for (const [id, list] of Object.entries(gear)) if (list.includes('neon') && CITY_LOTS[id]) neonSign(S, B, id); });
      put('awning', (S) => { for (const [id, list] of Object.entries(gear)) if (list.includes('awning')) awning(S, id); });
    },
    setHeaters(on) { put('heaters', on ? heaters : null); },
    setCivic(civic, flag) {
      put('stage', civic.stage ? stageGeo : null);
      performer.visible = !!civic.stage;
      put('lifeguard', civic.lifeguard ? lifeguardGeo : null);
      put('parking', civic.parking ? parkingGeo : null);
      Y.on = !!civic.yacht;
      if (Y.on && yachtColor !== flag) {
        if (yacht) { scene.remove(yacht); yacht.geometry.dispose(); }
        yacht = new THREE.Mesh(yachtGeo(flag), matS);
        yacht.castShadow = true;
        scene.add(yacht);
        yachtColor = flag;
      }
      if (yacht) yacht.visible = Y.on;
      M.on = !!civic.mascot;
      if (M.on && mascotColor !== flag) {
        if (mascot) { scene.remove(mascot); mascot.geometry.dispose(); }
        mascot = new THREE.Mesh(mascotGeo(flag), matS);
        mascot.castShadow = true;
        scene.add(mascot);
        mascotColor = flag;
      }
      if (mascot) mascot.visible = M.on;
    },
    // 外送：從店門口騎上前面的馬路，往東騎一段後消失
    deliver(id) {
      if (!CITY_LOTS[id] || SC.length >= 10) return;
      const L = laneOf(id);
      SC.push({ x: L.x, z: L.z0, lane: L.lane, phase: 0, t: 0, dir: Math.random() < 0.5 ? 1 : -1 });
    },
    airfreight(done) { PL.on = true; PL.t = 0; PL.done = done; plane.visible = true; },
    yachtPos: () => (Y.on ? [Y.x, SEA_Y + 2, Y.z] : null),
    mascotPos: () => (M.on ? [M.x, PROM.y + 1.6, M.z] : null),
    update(dt, speed, night, fwOn) {
      neonMat.color.setScalar(0.5 + 0.5 * night);
      fireworks.update(dt, fwOn && night > 0.3);
      if (performer.visible) {
        M.t += dt;
        performer.position.set(STAGE.x - 0.6, 1.22 + Math.abs(Math.sin(M.t * 4)) * 0.08, STAGE.z + 0.3);
        performer.rotation.set(0, Math.sin(M.t * 1.3) * 0.4, Math.sin(M.t * 4) * 0.05);
      }
      if (Y.on && yacht) {
        // 在海灣裡繞一個大橢圓
        Y.a += dt * 0.025 * Math.min(speed, 3);
        const x = 40 + Math.cos(Y.a) * 140, z = 125 + Math.sin(Y.a) * 38;
        if (Y.x || Y.z) Y.yaw = Math.atan2(x - Y.x, z - Y.z);
        const v = Math.hypot(x - Y.x, z - Y.z);
        Y.x = x; Y.z = z;
        yacht.position.set(x, SEA_Y + Math.sin(M.t * 1.4) * 0.12, z);
        yacht.rotation.set(0, Y.yaw, Math.sin(M.t * 0.9) * 0.025);
        if (sea && v > 0) sea.wakeAt(Y, x, z, Y.yaw, v, 6, 2.6);
      }
      if (M.on && mascot) {
        // 在步道上來回散步，偶爾停下來揮手
        if (M.pause > 0) M.pause -= dt * Math.min(speed, 3);
        else {
          M.x += M.dir * dt * 1.6 * Math.min(speed, 3);
          if (M.x > 130 || M.x < -90) M.dir *= -1;
          if (Math.random() < dt * 0.05) M.pause = 3 + Math.random() * 4;
        }
        const wave = M.pause > 0 ? Math.sin(M.t * 6) * 0.15 : 0;
        mascot.position.set(M.x, PROM.y + (M.pause > 0 ? 0 : Math.abs(Math.sin(M.t * 5)) * 0.12), M.z);
        mascot.rotation.set(0, M.pause > 0 ? Math.PI / 4 : M.dir > 0 ? Math.PI / 2 : -Math.PI / 2, wave);
      }
      // 外送機車
      let n = 0;
      for (let i = SC.length - 1; i >= 0; i--) {
        const c = SC[i];
        c.t += dt * Math.min(speed, 3);
        const sp = 9 * dt * Math.min(speed, 3);
        let yaw = 0;
        if (c.phase === 0) { c.z += sp; if (c.z >= c.lane) { c.z = c.lane; c.phase = 1; } }
        else { c.x += c.dir * sp * 1.3; yaw = c.dir * Math.PI / 2; }
        if (c.t > 8) { SC.splice(i, 1); continue; }
        const k = c.t > 7 ? 8 - c.t : 1;
        _m.compose(_p.set(c.x, 0.25, c.z), _q.setFromEuler(_e.set(0, yaw, 0)), _s.setScalar(k));
        scooters.setMatrixAt(n++, _m);
      }
      scooters.count = n;
      scooters.instanceMatrix.needsUpdate = true;
      // 貨機：從東邊高空飛往海港
      if (PL.on) {
        PL.t += dt;
        const k = PL.t / 7;
        plane.position.set(260 - k * 520, 70 - k * 30, 40 + Math.sin(k * Math.PI) * 30);
        plane.rotation.set(0, -Math.PI / 2, Math.sin(k * Math.PI) * 0.15);
        if (k > 0.82 && PL.done) { PL.done(); PL.done = null; }
        if (k >= 1) { PL.on = false; plane.visible = false; }
      }
    },
  };
  return api;
}
