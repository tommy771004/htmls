// 程式佔位幾何：GLB 缺檔或缺節點時用（開發中、或解析失敗），外觀粗略但比例對。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VC_MAT } from './assets.js';

function colored(geo, hex) {
  const g = geo.toNonIndexed(), n = g.attributes.position.count, c = new THREE.Color(hex), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const at = (g, x, y, z, ry = 0) => g.rotateY(ry).translate(x, y, z);
const merged = (...gs) => mergeGeometries(gs);
const group = (geo, name) => { const g = new THREE.Group(); g.name = name; const m = new THREE.Mesh(geo, VC_MAT()); m.castShadow = m.receiveShadow = true; g.add(m); return g; };

export const pine = (k) => {
  const H = k === 'pine_tall' ? 11 : k === 'pine_short' ? 6 : 8, R = k === 'pine_dense' ? 2.6 : H * 0.22;
  const parts = [colored(at(new THREE.CylinderGeometry(0.18, 0.28, H * 0.35, 5), 0, H * 0.17, 0), '#6b4a36')];
  for (let i = 0; i < 3; i++) parts.push(colored(at(new THREE.ConeGeometry(R * (1 - i * 0.25), H * 0.42, 7), 0, H * (0.35 + i * 0.2), 0, i), ['#2f5a3f', '#3d6b48', '#4f7d4f'][i]));
  return merged(...parts);
};
export const stump = () => colored(at(new THREE.CylinderGeometry(0.35, 0.45, 0.5, 7), 0, 0.25, 0), '#7a5a40');
export const boulder = () => colored(new THREE.DodecahedronGeometry(1.2, 0).scale(1, 0.8, 1).translate(0, 0.9, 0), '#a39f95');
export const rock = (k) => { const s = k === 'rock_L' ? 1.6 : k === 'rock_M' ? 0.8 : 0.35; return colored(new THREE.DodecahedronGeometry(s, 0).scale(1, 0.7, 1.1).translate(0, s * 0.5, 0), '#8f8b80'); };
export const cliff = () => colored(new THREE.BoxGeometry(12, 9, 3, 3, 3, 1).translate(0, 4.5, 0), '#8c887e');
export const reeds = () => { const ps = []; for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.2 + (i % 3) * 0.2; ps.push(colored(at(new THREE.ConeGeometry(0.05, 1.5, 3), Math.cos(a) * r, 0.75, Math.sin(a) * r), i % 4 ? '#a9a35a' : '#8a6a3e')); } return merged(...ps); };
export const lily = () => colored(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 8), '#5f8a4a');
export const log = () => colored(new THREE.CylinderGeometry(0.3, 0.35, 7, 7).rotateZ(Math.PI / 2), '#6d5a3e');
export const logDrift = () => colored(new THREE.CylinderGeometry(0.2, 0.22, 2.5, 6).rotateZ(Math.PI / 2).translate(0, 0.2, 0), '#8a6a4b');
export const cabin = () => group(merged(
  colored(new THREE.BoxGeometry(7, 3, 6).translate(0, 1.5, 0), '#8a5a3b'),
  colored(new THREE.ConeGeometry(5.4, 2.2, 4).rotateY(Math.PI / 4).scale(1, 1, 0.85).translate(0, 4.1, 0), '#4b5a48'),
  colored(new THREE.BoxGeometry(0.9, 5.5, 0.9).translate(2.6, 2.75, 1.5), '#8f8b80')), 'cabin');
export const dock = () => group(merged(
  colored(new THREE.BoxGeometry(2.4, 0.15, 14).translate(0, 0.5, -7), '#8c6a4a'),
  colored(new THREE.BoxGeometry(6, 0.15, 2.4).translate(0, 0.5, -13), '#8c6a4a')), 'dock');
export const bridge = () => group(merged(
  colored(new THREE.BoxGeometry(34, 1, 4).translate(0, 4, 0), '#8f8b80'),
  colored(new THREE.BoxGeometry(1.6, 4, 3.6).translate(-5.7, 2, 0), '#8f8b80'),
  colored(new THREE.BoxGeometry(1.6, 4, 3.6).translate(5.7, 2, 0), '#8f8b80')), 'bridge');
export const buoy = () => {
  const g = group(merged(colored(new THREE.CylinderGeometry(0.12, 0.14, 5, 6).translate(0, 0, 0), '#6e5541'), colored(new THREE.TorusGeometry(0.5, 0.12, 5, 10).rotateX(Math.PI / 2).translate(0, 0.05, 0), '#8c6a4a')), 'buoy');
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshStandardMaterial({ color: '#ffc46b', name: 'lamp_glow' }));
  lamp.position.y = 2.55; lamp.name = 'lamp_glow'; lamp.userData.special = 'lamp_glow'; g.add(lamp);
  const flag = new THREE.Group(); flag.name = 'buoy_flag'; flag.position.y = 1.2;
  flag.add(new THREE.Mesh(colored(new THREE.PlaneGeometry(0.5, 0.3).translate(0.3, 0, 0), '#a5473a'), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  g.add(flag);
  return g;
};
export const boatHull = () => {
  const g = group(merged(
    colored(new THREE.BoxGeometry(1.3, 0.45, 3.4).translate(0, 0.05, 0), '#a5473a'),
    colored(new THREE.BoxGeometry(1.1, 0.06, 3.1).translate(0, 0.2, 0), '#c08a55')), 'boat');
  g.children[0].material = VC_MAT();
  const paint = new THREE.Mesh(colored(new THREE.BoxGeometry(1.34, 0.12, 3.44).translate(0, 0.24, 0), '#ffffff'), new THREE.MeshStandardMaterial({ vertexColors: true, color: '#a5473a', name: 'hull_paint' }));
  paint.userData.special = 'hull_paint'; g.add(paint);
  for (const [n, x] of [['Oar_L', 0.6], ['Oar_R', -0.6]]) {
    const o = new THREE.Group(); o.name = n; o.position.set(x, 0.4, -0.28);
    o.add(new THREE.Mesh(colored(new THREE.BoxGeometry(2.4, 0.05, 0.08).translate(Math.sign(x) * 1.1, 0, 0), '#c08a55'), VC_MAT()));
    g.add(o);
  }
  return g;
};
export const fisher = () => group(merged(
  colored(new THREE.BoxGeometry(0.45, 0.6, 0.3).translate(0, 0.75, 0), '#6d7a5a'),
  colored(new THREE.SphereGeometry(0.15, 8, 6).translate(0, 1.2, 0), '#d8a77f'),
  colored(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 10).translate(0, 1.32, 0), '#d9bf7a')), 'fisher');
