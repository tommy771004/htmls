// chars 軌道：槍械、十字鎬、滑翔翼、物品模型（全部程式烘焙；以幾何快取共用，同款只建一次）。
import * as THREE from 'three';
import { Baker, M, shade, mix } from './chars-geo.js';
import { RARITY } from './items.js';

const matGun = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.18 });
const matItem = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
const matGlider = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, side: THREE.DoubleSide });

const DARK = '#2f3543', MID = '#59627a', STEEL = '#aeb8c8', WOOD = '#a56a34', LIGHT = '#eef1f7';

// ---------- 槍械 ----------
// 回傳 { geo, magGeo?, muzzle:[x,y,z], gripR, gripL, hold, reload, mag:[x,y,z] }
const gunCache = new Map();
function buildGun(defId, rarity, split) {
  const rc = RARITY[Math.max(0, Math.min(4, rarity))].color, rcd = shade(rc, 0.78);
  const B = new Baker(), MG = new Baker();
  const mag = (x, y, z, w, h, d, rot) => (split ? MG : B).box(x, y, z, w, h, d, rc, 0, rot, 0.012);
  let d;
  switch (defId) {
    case 'pump':
      B.box(0, 0.015, 0.26, 0.056, 0.105, 0.24, WOOD, 0, [-0.08, 0, 0], 0.02); B.box(0, -0.005, 0.37, 0.058, 0.12, 0.03, rc, 0, [-0.08, 0, 0], 0.01);
      B.box(0, 0.03, -0.02, 0.064, 0.095, 0.22, DARK, 0, null, 0.02); B.box(0, -0.05, 0.05, 0.04, 0.09, 0.045, WOOD, 0, [0.3, 0, 0], 0.015);
      B.cylZ(0, 0.048, -0.12, -0.78, 0.023, 0.023, STEEL); B.cylZ(0, -0.003, -0.12, -0.62, 0.019, 0.019, MID);
      B.cylZ(0, 0.048, -0.78, -0.82, 0.027, 0.027, DARK); B.sphere(0, 0.08, -0.77, 0.008, 0.012, 0.008, STEEL);
      B.box(0, 0.0, -0.4, 0.078, 0.07, 0.17, WOOD, 0, null, 0.025); B.box(0, 0.0, -0.325, 0.082, 0.074, 0.025, rc, 0, null, 0.01); B.box(0, 0.0, -0.475, 0.082, 0.074, 0.02, rcd, 0, null, 0.01);
      B.box(0, 0.082, -0.04, 0.02, 0.016, 0.1, STEEL);
      d = { muzzle: [0, 0.048, -0.84], gripR: [0, -0.06, 0.05], gripL: [0, -0.035, -0.4], hold: 'shotgun', reload: 'shell', mag: null };
      break;
    case 'smg':
      B.box(0, 0.03, -0.05, 0.058, 0.09, 0.27, DARK, 0, null, 0.02); B.cylZ(0, 0.034, -0.18, -0.38, 0.031, 0.031, MID); B.cylZ(0, 0.034, -0.38, -0.47, 0.021, 0.021, STEEL);
      for (let i = 0; i < 4; i++) B.box(0, 0.034, -0.22 - i * 0.045, 0.07, 0.014, 0.012, rc, 0, null, 0.004);
      B.box(0, -0.065, 0.035, 0.044, 0.11, 0.05, MID, 0, [0.3, 0, 0], 0.015); B.box(0, -0.075, -0.2, 0.04, 0.1, 0.04, rcd, 0, null, 0.014);
      B.limb([0, 0.04, 0.08], [0, 0.04, 0.3], 0.011, 0.011, STEEL); B.limb([0, 0.0, 0.09], [0, 0.02, 0.3], 0.01, 0.01, STEEL); B.box(0, 0.025, 0.31, 0.04, 0.09, 0.025, rc, 0, null, 0.01);
      B.box(0, 0.085, -0.06, 0.03, 0.022, 0.2, STEEL); B.box(0, 0.075, -0.42, 0.012, 0.035, 0.012, STEEL);
      mag(0, -0.13, -0.04, 0.042, 0.22, 0.055, [-0.06, 0, 0]);
      d = { muzzle: [0, 0.034, -0.48], gripR: [0, -0.075, 0.035], gripL: [0, -0.1, -0.2], hold: 'smg', reload: 'mag', mag: [0, -0.13, -0.04] };
      break;
    case 'sniper':
      B.box(0, 0.01, 0.29, 0.056, 0.115, 0.26, '#46604a', 0, [-0.06, 0, 0], 0.025); B.box(0, 0.075, 0.25, 0.04, 0.03, 0.14, shade('#46604a', 0.85)); B.box(0, 0.0, 0.42, 0.06, 0.125, 0.03, rc, 0, [-0.06, 0, 0], 0.01);
      B.box(0, 0.035, -0.06, 0.06, 0.095, 0.36, DARK, 0, null, 0.02); B.box(0, 0.03, -0.4, 0.056, 0.07, 0.3, '#46604a', 0, null, 0.02); B.box(0, 0.03, -0.3, 0.06, 0.074, 0.04, rc, 0, null, 0.01);
      B.cylZ(0, 0.04, -0.54, -0.98, 0.018, 0.014, STEEL); B.cylZ(0, 0.04, -0.98, -1.06, 0.026, 0.026, DARK); B.box(0, -0.06, 0.04, 0.042, 0.1, 0.05, '#46604a', 0, [0.3, 0, 0], 0.014);
      B.cylZ(0, 0.12, 0.03, -0.2, 0.034, 0.034, DARK); B.cylZ(0, 0.12, -0.2, -0.3, 0.046, 0.04, MID); B.sphere(0, 0.12, -0.305, 0.04, 0.04, 0.01, '#8ff0ff'); B.cylZ(0, 0.12, 0.03, 0.08, 0.04, 0.034, DARK);
      B.box(0, 0.085, -0.12, 0.02, 0.03, 0.03, STEEL); B.box(0, 0.085, 0.0, 0.02, 0.03, 0.03, STEEL);
      B.limb([0.03, 0.05, 0.01], [0.11, 0.035, 0.05], 0.009, 0.009, STEEL); B.sphere(0.12, 0.034, 0.054, 0.02, 0.02, 0.02, rc);
      for (const sx of [-1, 1]) B.limb([sx * 0.02, -0.01, -0.5], [sx * 0.07, -0.13, -0.58], 0.008, 0.008, STEEL);
      mag(0, -0.065, -0.07, 0.04, 0.06, 0.1);
      d = { muzzle: [0, 0.04, -1.07], gripR: [0, -0.07, 0.04], gripL: [0, -0.03, -0.36], hold: 'sniper', reload: 'bolt', mag: null };
      break;
    case 'pistol':
      B.box(0, 0.045, -0.055, 0.038, 0.048, 0.2, DARK, 0, null, 0.016); B.box(0, 0.074, -0.055, 0.03, 0.01, 0.19, STEEL); B.box(0, 0.01, -0.04, 0.034, 0.03, 0.17, MID, 0, null, 0.012);
      B.box(0, -0.05, 0.02, 0.037, 0.105, 0.052, rc, 0, [0.22, 0, 0], 0.016); B.box(0, -0.022, -0.075, 0.012, 0.03, 0.08, MID);
      B.cylZ(0, 0.045, -0.15, -0.19, 0.013, 0.013, STEEL); B.box(0, 0.088, -0.14, 0.01, 0.014, 0.01, STEEL); B.box(0, 0.088, 0.03, 0.02, 0.014, 0.014, STEEL);
      B.box(0, 0.045, -0.03, 0.04, 0.02, 0.012, rcd, 0, null, 0.004);
      d = { muzzle: [0, 0.045, -0.2], gripR: [0, -0.045, 0.025], gripL: [-0.01, -0.09, -0.0], hold: 'pistol', reload: 'mag', mag: null };
      break;
    default: // ar
      B.box(0, 0.03, -0.04, 0.058, 0.098, 0.31, DARK, 0, null, 0.02);
      B.box(0, 0.02, 0.25, 0.05, 0.088, 0.2, MID, 0, [-0.05, 0, 0], 0.02); B.box(0, 0.075, 0.2, 0.038, 0.03, 0.12, DARK); B.box(0, 0.012, 0.35, 0.056, 0.105, 0.03, rc, 0, [-0.05, 0, 0], 0.01);
      B.box(0, -0.065, 0.035, 0.045, 0.115, 0.05, MID, 0, [0.35, 0, 0], 0.016); B.box(0, -0.032, -0.05, 0.012, 0.018, 0.08, STEEL);
      B.box(0, 0.025, -0.31, 0.072, 0.078, 0.28, MID, 0, null, 0.025); B.box(0, 0.025, -0.255, 0.076, 0.082, 0.05, rc, 0, null, 0.012);
      for (let i = 0; i < 3; i++) B.box(0, 0.025, -0.34 - i * 0.05, 0.078, 0.02, 0.014, rcd, 0, null, 0.004);
      B.cylZ(0, 0.03, -0.44, -0.62, 0.016, 0.016, STEEL); B.cylZ(0, 0.03, -0.62, -0.69, 0.025, 0.025, DARK);
      B.box(0, 0.082, -0.15, 0.024, 0.012, 0.24, STEEL); B.box(0, 0.1, 0.0, 0.022, 0.034, 0.04, DARK); B.box(0, 0.072, -0.56, 0.012, 0.042, 0.012, STEEL);
      mag(0, -0.11, -0.07, 0.046, 0.16, 0.066, [-0.12, 0, 0]);
      d = { muzzle: [0, 0.03, -0.7], gripR: [0, -0.075, 0.035], gripL: [0, -0.05, -0.29], hold: 'rifle', reload: 'mag', mag: [0, -0.11, -0.07] };
  }
  d.geo = B.geometry(); d.magGeo = split && MG.n ? MG.geometry() : null;
  return d;
}
function gunData(defId, rarity, split) {
  const k = `${defId}_${rarity}_${split ? 1 : 0}`;
  let d = gunCache.get(k); if (!d) gunCache.set(k, (d = buildGun(defId, rarity, split)));
  return d;
}

const pickCache = new Map();
function buildPickaxe(rarity) {
  const rc = RARITY[Math.max(0, Math.min(4, rarity))].color, B = new Baker();
  B.limb([0, 0, 0.2], [0, 0, -0.52], 0.022, 0.019, WOOD, 0); B.cylZ(0, 0, 0.14, 0.0, 0.027, 0.027, '#2b2f3a'); B.sphere(0, 0, 0.2, 0.03, 0.03, 0.03, rc);
  B.box(0, 0, -0.52, 0.05, 0.1, 0.07, '#8f9bb0', 0, null, 0.015);
  // 鎬尖（上）與鑿刃（下）
  B.limb([0, 0.05, -0.52], [0, 0.17, -0.55], 0.024, 0.014, '#d5deea'); B.limb([0, 0.17, -0.55], [0, 0.27, -0.5], 0.014, 0.004, '#f2f6fb');
  B.limb([0, -0.05, -0.52], [0, -0.13, -0.55], 0.022, 0.02, '#d5deea'); B.box(0, -0.18, -0.55, 0.014, 0.1, 0.065, '#f2f6fb', 0, [0.2, 0, 0], 0.005);
  B.box(0, 0, -0.52, 0.056, 0.03, 0.076, rc, 0, null, 0.01);
  return B.geometry();
}

// 回傳 Group（有 userData.muzzle / gripR / gripL / hold / reload）
export function makeWeapon(defId, rarity = 0, split = false) {
  const g = new THREE.Group();
  if (defId === 'pickaxe') {
    let geo = pickCache.get(rarity); if (!geo) pickCache.set(rarity, (geo = buildPickaxe(rarity)));
    const m = new THREE.Mesh(geo, matGun); m.castShadow = true; g.add(m);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, -0.55); g.add(mz);
    g.userData = { muzzle: mz, hold: 'melee', gripR: new THREE.Vector3(), gripL: new THREE.Vector3(0, 0, 0) };
    return g;
  }
  const d = gunData(defId, rarity, split);
  const m = new THREE.Mesh(d.geo, matGun); m.castShadow = true; g.add(m);
  let magMesh = null;
  if (d.magGeo) { magMesh = new THREE.Mesh(d.magGeo, matGun); magMesh.castShadow = true; g.add(magMesh); }
  const mz = new THREE.Object3D(); mz.position.fromArray(d.muzzle); g.add(mz);
  g.userData = { muzzle: mz, gripR: new THREE.Vector3().fromArray(d.gripR), gripL: new THREE.Vector3().fromArray(d.gripL), hold: d.hold, reload: d.reload, magMesh, magRest: d.mag ? new THREE.Vector3().fromArray(d.mag) : null, body: m };
  return g;
}

// ---------- 物品 ----------
const itemCache = new Map();
const AMMO_COL = { light: '#ffc533', medium: '#4cc95a', heavy: '#4aa8ff', shells: '#ff5a4a' };
function buildItem(key) {
  const B = new Baker();
  const [kind, sub] = key.split(':');
  if (kind === 'bandage') {
    B.cyl(0, 0, 0, 0.058, 0.058, 0.07, '#f7f4ea', 0, null, 14); B.torus(0, 0.036, 0, 0.044, 0.014, '#e4e0d2', 0, [Math.PI / 2, 0, 0]); B.cyl(0, 0, 0, 0.061, 0.061, 0.026, '#ff4a5a', 0, null, 14);
    B.box(0.07, -0.028, 0.015, 0.1, 0.008, 0.05, '#f7f4ea', 0, [0, 0.3, 0.25], 0.003); B.box(0.0, 0.0, -0.062, 0.03, 0.01, 0.01, '#ffffff'); B.box(0, 0.0, -0.062, 0.01, 0.03, 0.01, '#ffffff');
  } else if (kind === 'medkit') {
    B.box(0, 0, 0, 0.26, 0.17, 0.1, '#f6f7fb', 0, null, 0.03); B.box(0, 0.0, -0.052, 0.12, 0.04, 0.012, '#ff3d4d'); B.box(0, 0.0, -0.052, 0.04, 0.12, 0.012, '#ff3d4d');
    B.torus(0, 0.092, 0, 0.05, 0.012, '#8a93a6', 0, [0, 0, 0], 1, 0.4); B.box(-0.1, 0.0, -0.052, 0.025, 0.04, 0.012, '#8a93a6'); B.box(0.1, 0.0, -0.052, 0.025, 0.04, 0.012, '#8a93a6');
    B.box(0, -0.085, 0, 0.27, 0.014, 0.105, '#d3d8e4', 0, null, 0.005);
  } else if (kind === 'minishield') {
    B.sphere(0, -0.01, 0, 0.052, 0.056, 0.052, (x, y) => mix('#2a8cff', '#9fe8ff', Math.max(0, Math.min(1, (y + 0.05) / 0.1))));
    B.cyl(0, 0.065, 0, 0.018, 0.022, 0.05, '#d6f4ff', 0, null, 10); B.cyl(0, 0.098, 0, 0.022, 0.018, 0.026, '#c9a06a'); B.sphere(-0.02, 0.01, -0.044, 0.012, 0.02, 0.006, '#ffffff');
    B.torus(0, -0.0, 0, 0.054, 0.007, '#ffffff', 0, [Math.PI / 2, 0, 0]);
  } else if (kind === 'shield') {
    B.sphere(0, -0.015, 0, 0.082, 0.1, 0.082, (x, y) => mix('#1f6bff', '#6fd0ff', Math.max(0, Math.min(1, (y + 0.08) / 0.17))));
    B.cyl(0, 0.098, 0, 0.026, 0.034, 0.07, '#cfeeff'); B.cyl(0, 0.145, 0, 0.034, 0.03, 0.04, '#c9a06a');
    B.torus(0.09, 0.02, 0, 0.045, 0.011, '#cfeeff', 0, [0, Math.PI / 2, 0]); B.torus(0, 0.0, 0, 0.083, 0.012, '#ffffff', 0, [Math.PI / 2, 0, 0], 1, 1);
    B.sphere(-0.03, 0.03, -0.075, 0.016, 0.03, 0.008, '#ffffff'); B.sphere(0, -0.02, -0.08, 0.02, 0.02, 0.006, '#ffe45e');
  } else if (kind === 'ammo') {
    const c = AMMO_COL[sub] || '#ffc533', dark = shade(c, 0.55);
    B.box(0, -0.02, 0, 0.23, 0.11, 0.14, c, 0, null, 0.02); B.box(0, 0.045, 0, 0.24, 0.025, 0.15, dark, 0, null, 0.01);
    B.box(0, -0.02, -0.072, 0.1, 0.05, 0.008, '#ffffff'); B.box(0, 0.0, 0.0, 0.01, 0.12, 0.145, shade(c, 0.78));
    const n = sub === 'heavy' ? 2 : sub === 'medium' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (sub === 'heavy' ? 0.09 : 0.055), r = sub === 'heavy' ? 0.026 : sub === 'shells' ? 0.022 : 0.016;
      const h = sub === 'heavy' ? 0.1 : sub === 'shells' ? 0.075 : 0.07;
      B.cyl(x, 0.058 + h / 2, 0, r, r, h, sub === 'shells' ? '#ff5a4a' : '#e8c15a'); B.cyl(x, 0.062, 0, r * 1.05, r * 1.05, 0.025, '#d9a441');
      if (sub !== 'shells') B.cone(x, 0.058 + h + 0.018, 0, r, 0.045, '#b87333'); else B.cyl(x, 0.058 + h + 0.003, 0, r * 0.9, r * 0.9, 0.008, '#f6e7b8');
    }
  } else if (kind === 'mat') {
    if (sub === 'wood') {
      const logs = [[-0.05, -0.04], [0.05, -0.04], [0.0, 0.04]];
      logs.forEach(([x, y], i) => { B.cylZ(x, y, -0.15, 0.15, 0.048, 0.048, '#8f5a2a', 0, 9); B.cylZ(x, y, 0.15, 0.152, 0.042, 0.042, '#f0c48a', 0, 9); B.cylZ(x, y, -0.152, -0.15, 0.042, 0.042, '#f0c48a', 0, 9); B.torus(x, y, 0.153, 0.026, 0.004, '#c58a4a'); });
      B.box(0, -0.0, 0, 0.05, 0.012, 0.3, '#e9d4a0', 0, [0, 0, 0], 0.004); B.box(0, 0.0, 0.02, 0.18, 0.02, 0.025, '#ffcf6a', 0, null, 0.005);
    } else if (sub === 'stone') {
      const g = new THREE.IcosahedronGeometry(1, 0);
      const rocks = [[-0.06, -0.03, 0.0, 0.085, '#9fb0c6', 0.3], [0.07, -0.035, 0.02, 0.075, '#b6c4d6', 1.2], [0.0, 0.04, -0.02, 0.07, '#8a9bb2', 2.1], [-0.01, -0.05, 0.07, 0.06, '#c4d0df', 0.7]];
      for (const [x, y, z, r, c, rot] of rocks) B.add(g, M(x, y, z, rot, rot * 1.7, 0, r, r * 0.85, r), (px, py, pz, n) => mix(c, '#ffffff', Math.max(0, n.y) * 0.25));
      g.dispose();
    } else {
      const col = '#c9d3e0';
      const ing = [[0, -0.045, -0.04, 0], [0, -0.045, 0.04, 0], [0.0, 0.0, 0.0, 0.0]];
      B.box(0, -0.05, -0.05, 0.2, 0.05, 0.08, col, 0, null, 0.015); B.box(0, -0.05, 0.05, 0.2, 0.05, 0.08, shade(col, 0.9), 0, null, 0.015);
      B.box(0, 0.0, 0, 0.2, 0.05, 0.08, mix(col, '#9fc4ff', 0.3), 0, [0, 0.12, 0], 0.015); B.box(0, 0.052, 0.0, 0.2, 0.05, 0.08, '#e8eef7', 0, [0, -0.1, 0], 0.015);
      B.box(0, 0.078, 0.0, 0.1, 0.004, 0.04, '#ffffff'); void ing;
    }
  }
  return B.geometry();
}
export function makeItem3D(defId = '', rarity = 0) {
  let key;
  const s = String(defId);
  if (s.startsWith('ammo_')) key = 'ammo:' + s.slice(5);
  else if (s.startsWith('mat_')) key = 'mat:' + s.slice(4);
  else if (['light', 'medium', 'heavy', 'shells'].includes(s)) key = 'ammo:' + s;
  else if (['wood', 'stone', 'metal'].includes(s)) key = 'mat:' + s;
  else key = s + ':';
  let geo = itemCache.get(key); if (!geo) itemCache.set(key, (geo = buildItem(key)));
  const g = new THREE.Group(), m = new THREE.Mesh(geo, matItem); m.castShadow = true; g.add(m);
  g.userData = { item: true };
  void rarity;
  return g;
}

// ---------- 滑翔翼 ----------
const gliderCache = new Map();
function buildGlider(cols) {
  const [c1, c2, c3] = cols.map((c) => new THREE.Color(c));
  const NZ = 8, PC = 6, panels = 9, span = 1.9, H = 0.95;
  const pos = [], nor = [], col = [], idx = [];
  const tmp = new THREE.Color();
  // 翼面函數：u∈[-1,1] 展向、v∈[0,1] 弦向；top=true 上表面
  const F = (u, v, top, out) => {
    const au = Math.abs(u), zl = -0.62 + 0.34 * u * u, zt = 0.72 + 0.12 * u * u - 0.05 * au;
    const z = zl + (zt - zl) * v, arch = -0.5 * u * u;
    const th = 0.17 * (1 - 0.5 * au) * Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.92 + 0.04)), 0.65);
    return out.set(u * span, H + arch + (top ? th : -th * 0.15), z);
  };
  const a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), a3 = new THREE.Vector3(), nn = new THREE.Vector3();
  const E = 1e-3;
  const surf = (top) => {
    for (let p = 0; p < panels; p++) {
      const base = pos.length / 3, u0 = (p / panels) * 2 - 1, u1 = ((p + 1) / panels) * 2 - 1;
      const c = p === 4 ? c3 : p % 2 ? c2 : c1;
      for (let j = 0; j <= NZ; j++) for (let i = 0; i <= PC; i++) {
        const u = u0 + (u1 - u0) * (i / PC), v = j / NZ;
        F(u, v, top, a1); pos.push(a1.x, a1.y, a1.z);
        F(u + E, v, top, a2).sub(F(u - E, v, top, a3)); const du = a2.clone();
        F(u, Math.min(1, v + E), top, a2).sub(F(u, Math.max(0, v - E), top, a3));
        nn.crossVectors(a2, du).normalize(); if (!top) nn.negate(); if (nn.y < 0 && top) nn.negate();
        nor.push(nn.x, nn.y, nn.z);
        tmp.copy(c);
        if (top && v > 0.9) tmp.copy(c3).lerp(tmp, 0.35);
        if (i === 0 || i === PC) tmp.multiplyScalar(0.72);
        if (!top) tmp.multiplyScalar(0.8);
        col.push(tmp.r, tmp.g, tmp.b);
      }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < PC; i++) {
        const q = base + j * (PC + 1) + i, r = q + 1, s2 = q + PC + 1, t = s2 + 1;
        if (top) idx.push(q, s2, r, r, s2, t); else idx.push(q, r, s2, r, t, s2);
      }
    }
  };
  surf(true); surf(false);
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wing.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); wing.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); wing.setIndex(idx);
  const B = new Baker();
  B.add(wing, new THREE.Matrix4(), 'attr');
  // 吊繩與把手
  const dk = '#3a3f52';
  for (const sx of [-1, 1]) for (const u of [0.28, 0.62, 0.94]) for (const v of [0.18, 0.85]) {
    const x = sx * u * span, zl = -0.62 + 0.34 * u * u, zt = 0.72 + 0.12 * u * u - 0.05 * u, z = zl + (zt - zl) * v;
    const y = H - 0.5 * u * u - 0.01;
    B.limb([x, y, z], [sx * 0.2, 0.0, (v - 0.5) * 0.06], 0.005, 0.005, '#f4f1e6', 0, 4);
  }
  B.cyl(0, 0, 0, 0.022, 0.022, 0.46, dk, 0, [0, 0, Math.PI / 2], 8); B.cyl(-0.2, 0, 0, 0.032, 0.032, 0.13, c3, 0, [0, 0, Math.PI / 2], 8); B.cyl(0.2, 0, 0, 0.032, 0.032, 0.13, c3, 0, [0, 0, Math.PI / 2], 8);
  return B.geometry();
}
export function makeGlider(cols = ['#ff7a2a', '#ffffff', '#18c9b0']) {
  const k = cols.join(',');
  let geo = gliderCache.get(k); if (!geo) gliderCache.set(k, (geo = buildGlider(cols)));
  const g = new THREE.Group(), m = new THREE.Mesh(geo, matGlider); m.castShadow = true; g.add(m);
  const hl = new THREE.Object3D(), hr = new THREE.Object3D(); hl.position.set(-0.2, 0, 0); hr.position.set(0.2, 0, 0); g.add(hl, hr);
  g.userData = { handleL: hl, handleR: hr };
  return g;
}
