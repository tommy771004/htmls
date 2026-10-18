// 城市生活改版的場景：買下的公寓（屋頂露台、旗子、Lv2 外牆布條）、競爭對手在公寓一樓開的店面、
// 三座地標（防波堤燈塔、海濱夜市、海灣摩天輪）。每樣一個網格，狀態改變時重建；摩天輪與燈塔光束每幀轉動。
import * as THREE from 'three';
import { Builder, T } from './geo.js';
import { lotRect, SAND_Y } from './layout.js';
import { PAL, lotFloors, roofY } from './world.js';
import { glowMat } from './decor.js';
import { APT_BY_KEY } from './empire.js';
import { LANDMARK_BY_ID } from './data.js';

const TBOX = T.box;
// 從 p0 到 p1 的方柱（方塊原點在底面中心，轉到兩點連線方向）
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _bq = new THREE.Quaternion(), _be = new THREE.Euler();
function beam(S, x0, y0, z0, x1, y1, z1, w, color) {
  _d.set(x1 - x0, y1 - y0, z1 - z0);
  const len = _d.length();
  _bq.setFromUnitVectors(_up, _d.normalize());
  _be.setFromQuaternion(_bq, 'XYZ');
  S.add(TBOX, x0, y0, z0, w, len, w, _be.y, color, _be.x, _be.z);
}
const matS = new THREE.MeshLambertMaterial({ vertexColors: true });
const OWN = '#2d5a45', GOLD = '#d9a63e';

// 公寓的外觀範圍（和 world.js 畫住宅時一樣：沿街 13 公尺深）
export function aptBox(key) {
  const a = APT_BY_KEY[key];
  const rr = lotRect(a.c, a.r, a.side);
  return { x0: rr.x0, x1: rr.x1, z0: rr.z1 - 13, z1: rr.z1, top: roofY(lotFloors(a.c, a.r, a.side, false)) };
}

function parasol(S, x, y, z, c) {
  S.cyl(x, y, z, 0.05, 2.1, PAL.lampPole, 6);
  S.add(T.cone8, x, y + 1.75, z, 2.4, 0.6, 2.4, 0, c);
  S.box(x - 0.45, y, z + 0.5, x + 0.45, y + 0.45, z + 1.0, PAL.white);
}

function aptGeo(S, B, key, lv) {
  const { x0, x1, z0, z1, top } = aptBox(key);
  const y = top + 0.08;
  // 屋頂露台：木地板、陽傘、花槽、燈串
  const dx0 = x0 + 1.2, dx1 = x1 - 1.2, dz0 = z1 - 6.2, dz1 = z1 - 0.9;
  S.box(dx0, y, dz0, dx1, y + 0.18, dz1, PAL.wood);
  for (let x = dx0 + 0.5; x < dx1; x += 0.55) S.box(x, y + 0.18, dz0, x + 0.04, y + 0.19, dz1, PAL.wood2, true);
  parasol(S, dx0 + 2, y + 0.18, dz0 + 1.8, OWN);
  parasol(S, dx1 - 2.4, y + 0.18, dz0 + 2.2, '#e8e2d0');
  for (let x = dx0 + 0.2; x < dx1 - 0.6; x += 1.6) {
    S.box(x, y + 0.18, dz1 - 0.6, x + 1.2, y + 0.65, dz1 - 0.1, '#b8875e');
    S.ball(x + 0.6, y + 0.5, dz1 - 0.35, 0.42, PAL.leaf2, 0);
  }
  for (const [px, pz] of [[dx0, dz0], [dx1, dz0], [dx0, dz1], [dx1, dz1]]) S.box(px - 0.05, y, pz - 0.05, px + 0.05, y + 2.6, pz + 0.05, PAL.lampPole);
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    B.ball(dx0 + (dx1 - dx0) * t, y + 2.45 - Math.sin(t * Math.PI) * 0.35, dz1, 0.07, '#ffe2a0');
    B.ball(dx0 + (dx1 - dx0) * t, y + 2.45 - Math.sin(t * Math.PI) * 0.35, dz0, 0.07, '#ffe2a0');
  }
  // 旗桿：綠底金邊的帝國旗
  const fx = x1 - 0.6, fz = z1 - 0.6;
  S.cyl(fx, top + 0.45, fz, 0.06, 4.2, PAL.metal, 6);
  S.box(fx - 1.8, top + 3.6, fz - 0.03, fx - 0.06, top + 4.6, fz + 0.03, OWN);
  S.box(fx - 1.8, top + 3.6, fz + 0.03, fx - 0.06, top + 3.75, fz + 0.05, GOLD, true);
  // 門口的銅牌
  S.box((x0 + x1) / 2 + 1.9, 1.1, z1, (x0 + x1) / 2 + 2.5, 1.6, z1 + 0.05, GOLD, true);
  if (lv >= 2) {
    // 翻修：外牆直布條、露台棚架、窗台花箱
    for (const bx of [x0 + 0.9, x1 - 1.7]) {
      S.box(bx, 4.2, z1 + 0.05, bx + 0.8, top - 1, z1 + 0.12, OWN, true);
      S.box(bx + 0.12, top - 2.2, z1 + 0.12, bx + 0.68, top - 1.6, z1 + 0.14, GOLD, true);
    }
    for (const px of [dx0 + 4.2, dx1 - 0.4]) S.box(px - 0.08, y, dz0 + 0.2, px + 0.08, y + 2.5, dz0 + 0.36, PAL.trim);
    for (let x = dx0 + 4.2; x <= dx1 - 0.3; x += 0.6) S.box(x - 0.04, y + 2.5, dz0 + 0.1, x + 0.04, y + 2.6, dz1 - 0.8, PAL.trim);
    S.box(dx0 + 4.2, y + 2.5, dz0 + 0.1, dx1 - 0.3, y + 2.6, dz0 + 0.3, PAL.trim);
  }
}

// 對手的店：公寓一樓左半邊換成深色店面、霓虹招牌與 A 字立牌
function rivalGeo(S, B, key) {
  const { x0, x1, z1 } = aptBox(key);
  const cx = (x0 + x1) / 2;
  const a = x0 + 0.6, b = cx - 1.9;
  S.box(a, 0.3, z1, b, 3.1, z1 + 0.12, '#2a2f3a', true);
  S.box(a + 0.3, 0.6, z1 + 0.12, b - 0.3, 2.5, z1 + 0.16, '#59707a', true);
  S.box(a - 0.1, 3.1, z1, b + 0.1, 3.75, z1 + 0.35, '#1f232b');
  B.box(a + 0.3, 3.25, z1 + 0.35, b - 0.3, 3.6, z1 + 0.4, '#ff4f6d', true);
  B.box(a + 0.3, 3.05, z1 + 0.13, b - 0.3, 3.1, z1 + 0.5, '#ff4f6d', true);
  // 斜雨棚
  S.add(TBOX, (a + b) / 2, 3.0, z1 + 0.75, b - a, 0.1, 1.5, 0, '#3a2f46', 0.35);
  const ax = b - 0.8, az = z1 + 1.8;
  S.add(TBOX, ax, 0.3, az, 0.7, 1.1, 0.08, 0, '#1f232b', 0.2);
  S.add(TBOX, ax, 0.3, az + 0.05, 0.7, 1.1, 0.08, 0, '#1f232b', -0.2);
}

// ───────── 地標 ─────────
function lighthouseGeo(S, B) {
  const [x, , z] = LANDMARK_BY_ID.lighthouse.at;
  S.cyl(x, -1.5, z, 3.2, 3.2, '#9a968c', 12);
  S.cyl(x, 1.7, z, 3.4, 0.25, PAL.trim, 12);
  const H = 14;
  for (let k = 0; k < 6; k++) {
    const r = 1.6 - k * 0.08;
    S.cyl(x, 1.95 + k * (H / 6), z, r, H / 6, k % 2 ? '#c8453c' : '#f4f1e6', 12);
  }
  const ty = 1.95 + H;
  S.cyl(x, ty, z, 1.7, 0.25, '#2c3d36', 12);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    S.box(x + Math.cos(a) * 1.6 - 0.04, ty + 0.25, z + Math.sin(a) * 1.6 - 0.04, x + Math.cos(a) * 1.6 + 0.04, ty + 1.0, z + Math.sin(a) * 1.6 + 0.04, '#2c3d36');
  }
  B.cyl(x, ty + 0.25, z, 0.85, 1.5, '#ffe9a8', 8);
  S.cone(x, ty + 1.75, z, 1.15, 1.2, '#c8453c', 12);
  S.ball(x, ty + 2.9, z, 0.18, '#2c3d36');
  // 管理員小屋
  S.box(x + 2.2, 0.2, z - 1.5, x + 4.6, 2.6, z + 1.2, '#f4f1e6');
  S.add(T.prism, x + 3.4, 2.6, z - 0.15, 2.6, 1.1, 3.0, 0, '#c8453c');
  return ty + 0.95;
}

function marketGeo(S, B) {
  const [cx, , cz] = LANDMARK_BY_ID.market.at;
  const y = SAND_Y;
  S.box(cx - 10, y, cz - 6.5, cx + 10, y + 0.12, cz + 7, '#d8c9a6');
  const COLS = ['#c8453c', '#2f7f8f', '#d9a63e', '#2d5a45', '#e07a5f', '#8a4f6e'];
  let k = 0;
  for (const rz of [cz - 4, cz + 3.2]) {
    for (let sx = cx - 8; sx <= cx + 6; sx += 4.6, k++) {
      const c = COLS[k % COLS.length];
      S.box(sx, y + 0.12, rz, sx + 3.4, y + 1.05, rz + 1.2, '#b48a5c');
      S.box(sx - 0.05, y + 1.05, rz - 0.05, sx + 3.45, y + 1.12, rz + 1.25, PAL.trim);
      for (const px of [sx + 0.05, sx + 3.25]) S.box(px, y + 0.12, rz - 0.6, px + 0.1, y + 2.6, rz - 0.5, PAL.woodDark);
      for (let j = 0; j < 5; j++) S.add(TBOX, sx + 0.34 + j * 0.68, y + 2.45, rz + 0.2, 0.68, 0.08, 2.3, 0, j % 2 ? PAL.cream : c, 0.28);
      for (let j = 0; j < 4; j++) S.box(sx + 0.3 + j * 0.8, y + 1.12, rz + 0.3, sx + 0.7 + j * 0.8, y + 1.32, rz + 0.8, COLS[(k + j + 2) % COLS.length]);
      B.ball(sx + 1.7, y + 2.0, rz - 0.5, 0.22, '#ff8a5a');
    }
  }
  // 中間走道的桌椅與燈串
  for (let x = cx - 7; x <= cx + 7; x += 3.5) {
    S.cyl(x, y + 0.12, cz, 0.06, 0.75, PAL.lampPole, 6);
    S.cyl(x, y + 0.87, cz, 0.55, 0.06, PAL.white, 10);
  }
  for (const px of [cx - 9.6, cx - 3.2, cx + 3.2, cx + 9.6]) {
    for (const pz of [cz - 5.6, cz + 6]) S.box(px - 0.07, y, pz - 0.07, px + 0.07, y + 3.8, pz + 0.07, PAL.lampPole);
  }
  for (let t = 0; t <= 1.001; t += 1 / 24) {
    const sag = Math.sin(t * Math.PI) * 0.6;
    B.ball(cx - 9.6 + 19.2 * t, y + 3.6 - sag, cz - 5.6, 0.08, '#ffe2a0');
    B.ball(cx - 9.6 + 19.2 * t, y + 3.6 - sag, cz + 6, 0.08, '#ffe2a0');
  }
  // 入口牌樓（朝沿海步道）
  for (const px of [cx - 3, cx + 3]) S.box(px - 0.2, y, cz - 6.6, px + 0.2, y + 4.4, cz - 6.2, '#a8462f');
  S.box(cx - 3.6, y + 4.4, cz - 6.8, cx + 3.6, y + 5.3, cz - 6.0, '#a8462f');
  B.box(cx - 2.8, y + 4.55, cz - 6.0, cx + 2.8, y + 5.15, cz - 5.95, '#ffd27a', true);
}

// 摩天輪：轉輪在自己的群組裡轉，車廂另外一個 InstancedMesh 保持直立
const WHEEL = { r: 11, cy: 13.5, cabins: 14 };
function ferrisBase(S, B) {
  const [x, , z] = LANDMARK_BY_ID.ferris.at;
  const y = SAND_Y;
  S.box(x - 6, y, z - 4, x + 6, y + 0.4, z + 4, '#cfc6ad');
  // A 字支架：兩組斜柱夾著輪軸（輪面朝鏡頭，軸沿 (1, 0, 1)）
  const k = Math.SQRT1_2;
  for (const side of [-1.6, 1.6]) {
    const bx = x + k * side, bz = z + k * side;
    for (const lean of [-1, 1]) beam(S, bx + lean * 6 * k, y + 0.4, bz - lean * 6 * k, bx, y + WHEEL.cy, bz, 0.45, '#e8e2d0');
  }
  S.add(T.cyl8, x, y + WHEEL.cy, z, 0.8, 3.6, 0.8, Math.PI / 4, PAL.metal, Math.PI / 2);
  // 售票亭
  S.box(x + 3, y + 0.4, z + 2, x + 5.4, y + 2.6, z + 3.8, '#2f7f8f');
  S.box(x + 2.8, y + 2.6, z + 1.8, x + 5.6, y + 2.85, z + 4, PAL.trim);
  B.box(x + 3.2, y + 1.6, z + 3.8, x + 5.2, y + 2.1, z + 3.85, '#ffe2a0', true);
}
function wheelGeo(S, B) {
  const { r, cabins } = WHEEL;
  const n = 28;
  for (const off of [-0.7, 0.7]) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, b = ((k + 1) / n) * Math.PI * 2;
      beam(S, Math.cos(a) * r, Math.sin(a) * r, off, Math.cos(b) * r, Math.sin(b) * r, off, 0.32, '#f4f1e6');
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      beam(S, 0, 0, off, Math.cos(a) * r, Math.sin(a) * r, off, 0.12, '#e8e2d0');
    }
  }
  for (let k = 0; k < cabins; k++) {
    const a = (k / cabins) * Math.PI * 2;
    S.add(TBOX, Math.cos(a) * r, Math.sin(a) * r - 0.06, 0, 0.12, 0.12, 1.6, 0, PAL.metal);
  }
  for (let k = 0; k < n * 2; k++) {
    const a = (k / (n * 2)) * Math.PI * 2;
    B.ball(Math.cos(a) * (r + 0.25), Math.sin(a) * (r + 0.25) - 0.1, 0.85, 0.12, k % 2 ? '#ffd27a' : '#ff8a5a');
  }
}
function cabinGeo() {
  const S = new Builder();
  S.add(TBOX, 0, -2.3, 0, 1.6, 1.5, 1.5, 0, '#ffffff');
  S.add(TBOX, 0, -0.85, 0, 1.75, 0.18, 1.65, 0, '#f4f1e6');
  S.add(TBOX, 0, -0.85, 0, 0.1, 0.85, 0.1, 0, PAL.metal);
  return S.geometry();
}

export function createEstate(scene) {
  const meshes = {};
  const put = (k, build) => {
    if (meshes[k]) for (const m of meshes[k]) { m.parent.remove(m); m.geometry.dispose(); }
    meshes[k] = [];
    if (!build) return;
    const S = new Builder(), B = new Builder();
    const parent = build(S, B) || scene;
    if (!S.empty) meshes[k].push(S.mesh(matS));
    if (!B.empty) meshes[k].push(B.mesh(glowMat, { cast: false, receive: false }));
    for (const m of meshes[k]) parent.add(m);
  };
  // 摩天輪的轉輪
  const [fx, , fz] = LANDMARK_BY_ID.ferris.at;
  const wheel = new THREE.Group();
  wheel.position.set(fx, SAND_Y + WHEEL.cy, fz);
  wheel.rotation.y = Math.PI / 4;
  const spin = new THREE.Group();
  wheel.add(spin);
  wheel.visible = false;
  scene.add(wheel);
  const cabins = new THREE.InstancedMesh(cabinGeo(), matS, WHEEL.cabins);
  cabins.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(WHEEL.cabins * 3), 3);
  const CAB = ['#c8453c', '#2f7f8f', '#d9a63e', '#2d5a45', '#e07a5f', '#8a4f6e', '#3f7a8c'];
  const _c = new THREE.Color();
  for (let k = 0; k < WHEEL.cabins; k++) { _c.set(CAB[k % CAB.length]); cabins.instanceColor.setXYZ(k, _c.r, _c.g, _c.b); }
  cabins.castShadow = true;
  wheel.add(cabins);
  // 燈塔光束：兩道反向的半透明長錐，夜裡才看得到
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Group();
  for (const s of [1, -1]) {
    const g = new THREE.ConeGeometry(4, 60, 16, 1, true).translate(0, -30, 0).rotateZ(s * Math.PI / 2);
    beam.add(new THREE.Mesh(g, beamMat));
  }
  beam.visible = false;
  scene.add(beam);
  let ang = 0, beamA = 0;
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);

  return {
    setApt(key, lv) { put('apt:' + key, lv ? (S, B) => aptGeo(S, B, key, lv) : null); },
    setRival(r) { put('rival', r ? (S, B) => rivalGeo(S, B, r.lot) : null); },
    setMark(id, on) {
      if (id === 'ferris') {
        put('ferris', on ? ferrisBase : null);
        put('wheel', on ? (S, B) => { wheelGeo(S, B); return spin; } : null);
        wheel.visible = on;
      } else if (id === 'lighthouse') {
        put('lighthouse', on ? (S, B) => { const top = lighthouseGeo(S, B); beam.position.set(LANDMARK_BY_ID.lighthouse.at[0], top, LANDMARK_BY_ID.lighthouse.at[2]); } : null);
        beam.visible = on;
      } else if (id === 'market') put('market', on ? marketGeo : null);
    },
    update(dt, speed, night) {
      if (wheel.visible) {
        ang += dt * 0.12 * Math.min(speed, 4);
        spin.rotation.z = ang;
        for (let k = 0; k < WHEEL.cabins; k++) {
          const a = ang + (k / WHEEL.cabins) * Math.PI * 2;
          _m.compose(_p.set(Math.cos(a) * WHEEL.r, Math.sin(a) * WHEEL.r, 0), _q.identity(), _s);
          cabins.setMatrixAt(k, _m);
        }
        cabins.instanceMatrix.needsUpdate = true;
      }
      if (beam.visible) {
        beamA += dt * 0.9;
        beam.rotation.y = beamA;
        beamMat.opacity = 0.22 * night;
      }
    },
  };
}
