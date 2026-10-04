// 外觀模組（Blender 建的 kit.glb）：依地圖的門窗開口擺鐵窗、遮雨棚、鐵捲門、門片、門廊、陽台，
// 屋頂水塔、騎樓下的機車、街燈與廟埕長椅。全部只供繪製，碰撞仍是地圖的方塊。
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
    if (kind === 0) {
      const barP = town === 'old' ? (floor > 0 ? 0.65 : 0.2) : town === 'estate' ? 0.55 : town ? 0.3 : 0.15;
      const hasBar = r() < barP;
      if (hasBar) put('ironbar', [x, cy, z], n, w + 0.12, h + 0.1, 1, ci);
      if ((town === 'old' || town === 'village' || !town || town === 'kiln' || town === 'cape') && r() < (hasBar ? 0.25 : 0.4)) put('awning', [x, top + 0.18, z], n, w + 0.5, 1, 1, ci);
      if (town === 'estate' && floor > 0 && !hasBar && r() < 0.35) put('balcony', [x, bottom - 0.02, z], n, w + 0.8, 1, 1, ci);
    } else {
      if (b.kind === 'house' && town === 'old') {
        // 騎樓店面：鐵捲門半開，門前停機車
        put('shutter', [x, top + 0.02, z], n, w + 0.1, (h + 0.1) * (0.3 + r() * 0.35), 1, ci);
        const nS = r() < 0.75 ? 1 + Math.floor(r() * 3) : 0;
        for (let k = 0; k < nS; k++) { const off = (k - (nS - 1) / 2) * 0.75 + (r() - 0.5) * 0.2; put('scooter', [x + t[0] * off + nx * 1.5, bottom - 0.08, z + t[1] * off + nz * 1.5], n, 1, 1, 1, ci + k * 13, r() < 0.5 ? 0 : Math.PI); }
      } else if (b.kind === 'house') {
        // 一般住家：木門往內打開貼著牆；鄉間房子加門廊
        const hinge = [x + t[0] * w / 2 - nx * 0.27, bottom, z + t[1] * w / 2 - nz * 0.27];
        put('door', hinge, n, (w * 0.95) / 0.9, 1.05, 1, ci, 0);
        if ((town === 'village' || !town || town === 'cape' || town === 'kiln') && r() < 0.65) put('porch', [x, bottom - 0.02, z], n, Math.max(2.4, w + 1.4), 1, 1, ci);
        else if (r() < 0.5) put('awning', [x, top + 0.25, z], n, w + 0.9, 1, 1.2, ci);
      }
    }
  }
  // 室內家具：地圖給的位置與朝向
  for (const d of W.deco) if (d.t === 'furn') put(d.k, [d.x, d.y + 0.005, d.z], [Math.sin(d.yaw), Math.cos(d.yaw)], 1, 1, 1);
  for (const d of W.deco) if (d.t === 'roofTank') put('tank', [d.x, d.y, d.z], [0, 1], 1, 1, 1, 0, hash2(Math.floor(d.x), Math.floor(d.z), 5) * 6.28);
  // 老街街燈：沿東西向街道兩側，每 24 公尺一盞；廟埕放長椅
  for (const p of W.pads) {
    const [x0, z0, x1, z1, y, k] = p;
    if (k === 0 && x1 - x0 > 60) for (let x = x0 + 8; x < x1 - 4; x += 24) { put('lamp', [x, y, z0 + 0.4], [0, 1], 1, 1, 1, 0, Math.PI); put('lamp', [x + 12, y, z1 - 0.4], [0, -1], 1, 1, 1, 0, Math.PI); }
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
