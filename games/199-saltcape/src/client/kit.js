// 外觀模組（Blender 建的 kit.glb）：依地圖的門窗開口擺鐵窗、遮雨棚、門片、門廊、陽台，
// 屋頂水塔、街燈與公園長椅。全部只供繪製，碰撞仍是地圖的方塊。
import * as THREE from 'three';
import { mulberry32, hash2 } from '../core/rng.js';

const AWNING = ['#5f8f78', '#4f7fa8', '#c9c2b0', '#8aa86a', '#b0603f'].map((c) => new THREE.Color(c));
const SCOOTER = ['#e6e4de', '#c23a2a', '#2f5d8a', '#1d1d1f', '#9bb8a6', '#e0b33a', '#8a8f94'].map((c) => new THREE.Color(c));
const SHUTTER = ['#b8bcbc', '#9ea7a4', '#c9c6bc', '#7e8a8c'].map((c) => new THREE.Color(c));
const TINT = { awning: AWNING, scooterBody: SCOOTER, shutter: SHUTTER };

export function buildKit(W, kit, csmify, furniture) {
  const grp = new THREE.Group();
  if (!kit && !furniture) return grp;
  // 每個模組拆成（幾何、材質）清單
  const parts = {};
  for (const src of [kit, furniture].filter(Boolean)) src.traverse((o) => {
    if (!o.isMesh) return;
    let top = o; while (top.parent && top.parent !== src) top = top.parent;
    const name = top.name;
    o.updateWorldMatrix(true, false);
    const g = o.geometry.clone();
    // 模組原點在物件本身：只套用子網格相對頂層物件的變換
    const rel = new THREE.Matrix4().copy(top.matrixWorld).invert().multiply(o.matrixWorld);
    g.applyMatrix4(rel);
    const m = o.material.clone();
    m.roughness = Math.min(1, m.roughness);
    csmify(m);
    (parts[name] ||= []).push({ g, m, tint: TINT[o.material.name] || null });
  });
  const P = {}; // 模組名 → 擺放 [matrix, colorIndex]
  const put = (name, pos, nrm, sx, sy, sz, ci = 0, yawExtra = 0) => {
    const yaw = Math.atan2(nrm[0], nrm[1]) + yawExtra; // 模組 +Z 對齊外法線
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(sx, sy, sz));
    (P[name] ||= []).push([m, ci]);
  };
  const r = mulberry32(2026);
  for (const o of W.openings) {
    const [x, y, z, nx, nz, w, h, kind, bi, floor] = o;
    const b = W.buildings[bi]; if (!b) continue;
    const town = b.town, n = [nx, nz], t = [nz, -nx];
    const cy = y, bottom = y - h / 2, top = y + h / 2;
    const ci = Math.floor(hash2(Math.floor(x * 3), Math.floor(z * 3), bi) * 997);
    const rural = !town || ['port', 'river', 'pine', 'ranch', 'farms', 'mill', 'light'].includes(town);
    if (kind === 0) {
      const barP = town === 'docks' || town === 'foundry' || town === 'fort' ? 0.45 : town === 'city' && floor === 0 ? 0.25 : 0.04;
      const hasBar = r() < barP;
      if (hasBar) put('ironbar', [x, cy, z], n, w + 0.12, h + 0.1, 1, ci);
      if ((town === 'city' || town === 'port') && floor === 0 && b.floors > 2 && r() < 0.5) put('awning', [x, top + 0.18, z], n, w + 0.5, 1, 1, ci);
      if (town === 'resort' && floor > 0 && r() < 0.7) put('balcony', [x, bottom - 0.02, z], n, w + 0.8, 1, 1, ci);
      else if (town === 'city' && floor > 0 && !hasBar && r() < 0.12) put('balcony', [x, bottom - 0.02, z], n, w + 0.8, 1, 1, ci);
    } else if (b.kind === 'house') {
      // 住家：木門往內打開貼著牆；木壁板房子幾乎都有門廊，紅磚店面加遮雨棚
      const hinge = [x + t[0] * w / 2 - nx * 0.27, bottom, z + t[1] * w / 2 - nz * 0.27];
      put('door', hinge, n, (w * 0.95) / 0.9, 1.05, 1, ci, 0);
      if (rural && floor === 0 && b.floors <= 2 && r() < 0.8) put('porch', [x, bottom - 0.02, z], n, Math.max(2.8, w + 2.2), 1, 1, ci);
      else if (r() < 0.55) put('awning', [x, top + 0.25, z], n, w + 0.9, 1, 1.2, ci);
    }
  }
  // 室內家具：地圖給的位置與朝向
  for (const d of W.deco) if (d.t === 'furn') put(d.k, [d.x, d.y + 0.005, d.z], [Math.sin(d.yaw), Math.cos(d.yaw)], 1, 1, 1);
  for (const d of W.deco) if (d.t === 'roofTank') put('tank', [d.x, d.y, d.z], [0, 1], 1, 1, 1, 0, hash2(Math.floor(d.x), Math.floor(d.z), 5) * 6.28);
  // 街燈：沿街道兩側人行道每 30 公尺一盞；公園放長椅
  for (const p of W.pads) {
    const [x0, z0, x1, z1, y, k] = p;
    if (k === 0) {
      const ax = x1 - x0 >= z1 - z0, L = ax ? x1 - x0 : z1 - z0;
      if (L < 24 || (ax ? z1 - z0 : x1 - x0) < 6) continue;
      for (let s2 = 10; s2 < L - 6; s2 += 30) {
        if (ax) { put('lamp', [x0 + s2, y + 0.15, z0 - 0.7], [0, 1], 1, 1, 1, 0, Math.PI); put('lamp', [x0 + s2 + 15, y + 0.15, z1 + 0.7], [0, -1], 1, 1, 1, 0, Math.PI); }
        else { put('lamp', [x0 - 0.7, y + 0.15, z0 + s2], [1, 0], 1, 1, 1, 0, Math.PI); put('lamp', [x1 + 0.7, y + 0.15, z0 + s2 + 15], [-1, 0], 1, 1, 1, 0, Math.PI); }
      }
    }
    if (k === 1) for (let i = 0; i < 4; i++) put('bench', [x0 + 4 + i * ((x1 - x0 - 8) / 3), y + 0.01, (z0 + z1) / 2 + (i % 2 ? 9 : -9)], [0, i % 2 ? -1 : 1], 1, 1, 1);
  }
  const col = new THREE.Color();
  for (const [name, list] of Object.entries(P)) {
    for (const part of parts[name] || []) {
      const im = new THREE.InstancedMesh(part.g, part.m, list.length);
      list.forEach(([m, ci], i) => { im.setMatrixAt(i, m); if (part.tint) { col.copy(part.tint[ci % part.tint.length]); im.setColorAt(i, col); } });
      im.castShadow = name !== 'ironbar'; im.receiveShadow = true;
      if (part.tint) part.m.color.set('#ffffff');
      grp.add(im);
    }
  }
  return grp;
}
