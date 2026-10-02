// 彩繪飛艇模型（原創）：條紋氣囊＋木製吊籃＋四片尾翼＋雙螺旋槳。模型面向 -Z，原點在吊籃中心。只由 match.js 匯入。
import * as THREE from 'three';
import { BoxBatch, vcMat } from './geo.js';

const STRIPES = ['#ff5e5e', '#fff6e0', '#22d1b8', '#fff6e0'];
const A = 6.8, B = 5.6, C = 16, CY = 7.4; // 氣囊半軸與中心高度

function envelope() {
  const NZ = 48, NA = 72, pos = [], nor = [], col = [];
  const c = new THREE.Color();
  const P = (zi, ai) => {
    const t = (zi / NZ) * 2 - 1, s = Math.sqrt(Math.max(0, 1 - t * t)), a = (ai / NA) * Math.PI * 2;
    const x = Math.sin(a) * A * s, y = Math.cos(a) * B * s + CY, z = t * C;
    // 解析法線
    const nx = x / (A * A), ny = (y - CY) / (B * B), nz = z / (C * C), l = Math.hypot(nx, ny, nz) || 1;
    return [x, y, z, nx / l, ny / l, nz / l];
  };
  for (let zi = 0; zi < NZ; zi++) for (let ai = 0; ai < NA; ai++) {
    const q = [P(zi, ai), P(zi + 1, ai), P(zi + 1, ai + 1), P(zi, ai + 1)];
    const t = ((zi + 0.5) / NZ) * 2 - 1;
    const band = Math.abs(Math.abs(t) - 0.42) < 0.035; // 兩圈黃色飾帶
    c.set(band ? '#ffd13a' : STRIPES[Math.floor(ai / 3) % 4]);
    // 下半部略暗，讓氣囊有體積感
    const dark = ai > NA * 0.3 && ai < NA * 0.7 ? 0.9 : 1;
    for (const k of [0, 1, 2, 0, 2, 3]) { const v = q[k]; pos.push(v[0], v[1], v[2]); nor.push(v[3], v[4], v[5]); col.push(c.r * dark, c.g * dark, c.b * dark); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// 尾翼：四片後掠的三角板（雙面）
function fins() {
  const pos = [], col = [], c1 = new THREE.Color('#18c9b0'), c2 = new THREE.Color('#ff5a5a'), c3 = new THREE.Color('#ffd13a');
  const push = (pts, cols) => { pts.forEach((p, i) => { pos.push(...p); col.push(cols[i].r, cols[i].g, cols[i].b); }); };
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    const R = (x, y, z) => [x * ca - y * sa, x * sa + y * ca + CY, z]; // 繞 Z 軸旋轉（以氣囊中心為軸）
    const q = [R(0, 4.2, 8.5), R(0, 2.2, 14.6), R(0, 7.6, 15.6), R(0, 9.2, 11.2)];
    push([q[0], q[1], q[2]], [c1, c1, c2]); push([q[0], q[2], q[3]], [c1, c2, c2]);
    push([q[3], q[2], R(0, 9.6, 15.0)], [c3, c3, c3]); // 翼尖小黃片
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function propeller() {
  const g = new THREE.Group();
  const geo = new BoxBatch();
  geo.add(0, 0.8, 0, 0.16, 0.8, 0.05, '#fff3d6').add(0, -0.8, 0, 0.16, 0.8, 0.05, '#ff5a5a').add(0.8, 0, 0, 0.8, 0.16, 0.05, '#ff5a5a').add(-0.8, 0, 0, 0.8, 0.16, 0.05, '#fff3d6');
  g.add(new THREE.Mesh(geo.geometry(), vcMat(0.6)));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  g.add(disc);
  return g;
}

export function buildBlimp() {
  const g = new THREE.Group();
  // 專用材質：加一點自發光把陰影面提亮，維持卡通明亮感
  const lift = (m) => { m.emissive = new THREE.Color(0x7a6a5e); m.emissiveIntensity = 0.5; return m; };
  const env = new THREE.Mesh(envelope(), lift(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }))); env.castShadow = true; g.add(env);
  const fm = new THREE.Mesh(fins(), lift(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }))); fm.castShadow = true; g.add(fm);
  const b = new BoxBatch();
  const wood = '#b8782a', dark = '#8a5a22', gold = '#f2c14a', glass = '#9be8ff';
  // 吊籃：船形艙體＋金色滾邊＋艙頂
  b.add(0, -1.3, 0, 1.5, 0.45, 4.6, dark).add(0, -0.5, 0, 1.9, 0.5, 5.2, wood).add(0, 0.05, 0, 2.05, 0.1, 5.35, gold);
  b.add(0, 0.95, 0.4, 1.6, 0.85, 3.7, '#f7e3b5').add(0, 1.9, 0.4, 1.8, 0.14, 3.95, '#ff5a5a');
  b.add(0, 0.9, -4.55, 1.2, 0.7, 0.3, glass, 0, 0.35).add(0, 0.55, -5.4, 0.9, 0.12, 0.25, gold);
  for (const x of [-1.62, 1.62]) for (const z of [-2.4, -0.6, 1.2, 3.0]) b.add(x, 1.0, z, 0.06, 0.34, 0.5, glass);
  // 欄杆
  for (const x of [-2.0, 2.0]) { b.add(x, 0.6, 0, 0.05, 0.05, 5.2, gold); for (const z of [-4.8, -2.4, 0, 2.4, 4.8]) b.add(x, 0.35, z, 0.05, 0.3, 0.05, gold); }
  // 吊索（氣囊底部在 y≈1.8）
  for (const x of [-1.5, 1.5]) for (const z of [-3.4, 0.4, 4.0]) b.add(x, 2.5, z, 0.05, 1.3, 0.05, '#6a4a2a');
  // 引擎吊艙與支架
  for (const x of [-3.3, 3.3]) { b.add(x, 0.1, 3.4, 0.55, 0.5, 1.15, '#18c9b0').add(x, 0.1, 4.7, 0.3, 0.3, 0.2, '#ffd13a').add(x * 0.72, 0.2, 3.4, 0.5, 0.1, 0.2, dark); }
  // 船尾舵與前燈
  b.add(0, -0.7, 5.6, 0.07, 0.8, 0.5, '#ff5a5a').add(0, -0.2, -4.9, 0.3, 0.3, 0.2, '#fff6c0');
  const hull = new THREE.Mesh(b.geometry(), lift(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }))); hull.castShadow = true; g.add(hull);
  const props = [];
  for (const x of [-3.3, 3.3]) { const p = propeller(); p.position.set(x, 0.1, 4.95); g.add(p); props.push(p); }
  // 吊籃前燈（發光）
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1a8 }));
  lamp.position.set(0, -0.2, -5.1); g.add(lamp);
  return { group: g, props };
}
