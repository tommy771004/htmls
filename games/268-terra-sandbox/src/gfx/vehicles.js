// 載具模型（全部用程式建模，車頭朝 -z、原點在地面中心）。
// 車子拆成三份：車漆（可換色）、細節（玻璃、輪胎、保險桿）、燈（夜間發光），讓車流可以用 InstancedMesh 換色。
import * as THREE from 'three';
import { Builder, P, mat } from './geo.js';

const GLASS = 0x2a3540;
const TIRE = 0x1c1e21;
const RIM = 0xb9bdc3;
const TRIM = 0x2d3135;
const HEAD = 0xfff4d6;
const TAIL = 0xc81e1e;

// 側面輪廓（u：-L/2 車尾 → +L/2 車頭，v：高度），沿 x 擠出成寬度 w
function profile(pts, w, bevel = 0.06) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  // (u, v, d) → (d - w/2 + bevel, v, -u)：行列式為 +1，面向不翻轉
  const m = new THREE.Matrix4().set(0, 0, 1, -(w - bevel * 2) / 2, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

const SPECS = {
  sedan: { L: 4.6, W: 1.84, wheelR: 0.34, wb: 1.38, body: [[-2.3, 0.32], [-2.32, 0.78], [-2.0, 0.9], [-1.15, 0.93], [-0.45, 1.4], [0.75, 1.42], [1.45, 0.98], [2.25, 0.86], [2.32, 0.58], [2.28, 0.32]], cabin: [[-1.45, 0.9], [-0.55, 1.4], [0.8, 1.42], [1.6, 0.92]] },
  taxi: null,
  hatch: { L: 4.0, W: 1.78, wheelR: 0.32, wb: 1.25, body: [[-2.0, 0.32], [-2.02, 1.05], [-1.85, 1.45], [0.45, 1.47], [1.3, 0.98], [1.96, 0.86], [2.02, 0.56], [1.98, 0.32]], cabin: [[-1.9, 0.95], [-1.8, 1.42], [0.45, 1.44], [1.35, 0.95]] },
  suv: { L: 4.85, W: 1.98, wheelR: 0.4, wb: 1.45, body: [[-2.42, 0.4], [-2.45, 1.1], [-2.32, 1.78], [0.75, 1.8], [1.45, 1.18], [2.38, 1.06], [2.44, 0.7], [2.4, 0.4]], cabin: [[-2.35, 1.15], [-2.25, 1.74], [0.72, 1.76], [1.5, 1.15]] },
  van: { L: 5.2, W: 2.0, wheelR: 0.38, wb: 1.7, body: [[-2.6, 0.38], [-2.62, 2.1], [1.45, 2.12], [2.3, 1.25], [2.58, 1.0], [2.6, 0.38]], cabin: [[1.2, 1.25], [1.5, 2.02], [1.62, 2.02], [2.3, 1.26]] },
  pickup: { L: 5.4, W: 2.0, wheelR: 0.42, wb: 1.75, body: [[-2.7, 0.45], [-2.7, 1.1], [2.65, 1.12], [2.7, 0.7], [2.66, 0.45]], cab: [[-0.55, 1.1], [-0.55, 1.88], [0.75, 1.9], [1.45, 1.15]], cabin: [[-0.5, 1.15], [-0.48, 1.84], [0.74, 1.86], [1.42, 1.15]] },
  jeep: { L: 4.6, W: 1.95, wheelR: 0.44, wb: 1.42, body: [[-2.2, 0.5], [-2.2, 1.25], [0.85, 1.25], [0.95, 1.3], [2.2, 1.22], [2.25, 0.85], [2.2, 0.5]], cab: [[-2.15, 1.25], [-2.12, 1.95], [0.55, 1.97], [0.85, 1.28]], cabin: [[-2.1, 1.3], [-2.08, 1.9], [0.52, 1.92], [0.8, 1.3]] },
};
SPECS.taxi = SPECS.sedan;

const cache = new Map();

// 回傳 { paint, detail, lights, wheels:[{x,y,z,r}], spec }（Builder）
export function carParts(model, paintColor = 0xffffff, withWheels = true) {
  const key = `${model}:${paintColor}:${withWheels}`;
  if (cache.has(key)) return cache.get(key);
  const S = SPECS[model] || SPECS.sedan;
  const paint = new Builder();
  const detail = new Builder();
  const lights = new Builder();
  const I = new THREE.Matrix4();
  const W = S.W;
  const L = S.L;
  paint.geom(profile(S.body, W, 0.08), I, paintColor);
  if (S.cab) paint.geom(profile(S.cab, W * 0.96, 0.06), I, paintColor);
  // 車窗：比車身窄一點的深色玻璃，外面再貼一層車漆窗框
  detail.geom(profile(S.cabin, W * (S.cab ? 0.98 : 0.9), 0.04), mat(0, 0.005, 0, 1, 1, 1), GLASS);
  const roofY = Math.max(...S.cabin.map((p) => p[1]));
  const roofU0 = S.cabin[1][0];
  const roofU1 = S.cabin[2][0];
  paint.geom(P.box(), mat(0, roofY + 0.02, -(roofU0 + roofU1) / 2, W * 0.86, 0.06, Math.abs(roofU1 - roofU0) + 0.1), paintColor);
  // B 柱
  for (const s of [-1, 1]) paint.geom(P.box(), mat(s * W * 0.455, roofY - 0.25, -(roofU0 + roofU1) / 2 + 0.1, 0.05, 0.5, 0.12), paintColor);
  // 保險桿、水箱罩、後視鏡、車牌
  const bumperY = S.body[0][1] + 0.12;
  detail.geom(P.box(), mat(0, bumperY, -L / 2 - 0.02, W * 0.96, 0.2, 0.12), TRIM);
  detail.geom(P.box(), mat(0, bumperY, L / 2 + 0.02, W * 0.96, 0.2, 0.12), TRIM);
  detail.geom(P.box(), mat(0, bumperY + 0.26, -L / 2 + 0.01, W * 0.5, 0.18, 0.06), model === 'jeep' ? 0x1c1e21 : 0x3a3f45);
  detail.geom(P.box(), mat(0, bumperY + 0.02, L / 2 + 0.09, 0.42, 0.13, 0.02), 0xeeeeee);
  for (const s of [-1, 1]) paint.geom(P.box(), mat(s * (W / 2 + 0.08), roofY - 0.48, -S.cabin[3][0] + 0.25, 0.16, 0.1, 0.12), paintColor);
  // 燈
  const hy = bumperY + 0.27;
  for (const s of [-1, 1]) {
    if (model === 'jeep') lights.geom(P.cyl(14), mat(s * W * 0.36, hy, -L / 2 - 0.01, 0.12, 0.05, 0.12, Math.PI / 2, 0, 0), HEAD);
    else lights.geom(P.box(), mat(s * W * 0.36, hy, -L / 2 + 0.02, 0.36, 0.1, 0.06), HEAD);
    lights.geom(P.box(), mat(s * W * 0.4, hy + (model === 'van' || model === 'suv' ? 0.3 : 0), L / 2 - 0.0, 0.26, 0.14, 0.06), TAIL);
  }
  // 車型特色
  if (model === 'taxi') {
    lights.geom(P.box(), mat(0, roofY + 0.14, 0.1, 0.62, 0.2, 0.26), 0xfff2b0);
    detail.geom(P.box(), mat(0, roofY + 0.06, 0.1, 0.66, 0.05, 0.3), 0x24272b);
    for (const s of [-1, 1]) detail.geom(P.box(), mat(s * (W / 2 + 0.005), 0.72, 0.4, 0.01, 0.12, 1.6), 0x1f2328);
  }
  if (model === 'pickup') {
    // 貨斗
    for (const s of [-1, 1]) paint.geom(P.box(), mat(s * (W / 2 - 0.06), 1.3, 1.45, 0.1, 0.38, 2.4), paintColor);
    paint.geom(P.box(), mat(0, 1.3, 2.62, W - 0.1, 0.38, 0.08), paintColor);
    detail.geom(P.box(), mat(0, 1.13, 1.45, W - 0.22, 0.03, 2.35), 0x34383d);
  }
  if (model === 'jeep') {
    // 黑色輪拱、備胎、側踏板
    for (const sx of [-1, 1]) {
      for (const z of [-S.wb, S.wb]) detail.geom(P.box(), mat(sx * (W / 2 + 0.06), S.wheelR * 2 + 0.06, z, 0.2, 0.1, 1.1), 0x1e2023);
      detail.geom(P.box(), mat(sx * (W / 2 + 0.04), 0.48, 0, 0.16, 0.06, 1.6), 0x1e2023);
    }
    detail.geom(P.cyl(18), mat(0, 1.15, L / 2 + 0.2, 0.42, 0.26, 0.42, Math.PI / 2, 0, 0), TIRE);
    detail.geom(P.cyl(14), mat(0, 1.15, L / 2 + 0.34, 0.24, 0.02, 0.24, Math.PI / 2, 0, 0), RIM);
  }
  if (model === 'suv') for (const s of [-1, 1]) detail.geom(P.box(), mat(s * W * 0.38, roofY + 0.09, 0.3, 0.05, 0.05, 2.4), 0x2a2d31);
  // 輪子
  const wheels = [];
  for (const z of [-S.wb, S.wb]) for (const sx of [-1, 1]) wheels.push({ x: sx * (W / 2 - 0.12), y: S.wheelR, z, r: S.wheelR });
  if (withWheels) for (const w of wheels) addWheel(detail, w.x, w.y, w.z, w.r, w.x > 0 ? 1 : -1);
  const out = { paint, detail, lights, wheels, spec: S };
  cache.set(key, out);
  return out;
}

export function addWheel(B, x, y, z, r, side = 1, rot = 0) {
  B.geom(P.cyl(16), mat(x, y, z, r, 0.26, r, rot, 0, Math.PI / 2), TIRE);
  B.geom(P.cyl(12), mat(x + side * 0.135, y, z, r * 0.62, 0.02, r * 0.62, rot, 0, Math.PI / 2), RIM);
  B.geom(P.cyl(6), mat(x + side * 0.15, y, z, r * 0.18, 0.03, r * 0.18, rot, 0, Math.PI / 2), 0x6b7076);
}

export function wheelGeo(r) {
  const B = new Builder();
  addWheel(B, 0, 0, 0, r, 1);
  return B.build();
}

// 車流：每種車型三個 InstancedMesh（車漆換色、細節、燈）
export class TrafficRenderer {
  constructor(lampMat, max = 40) {
    this.group = new THREE.Group();
    this.max = max;
    this.models = {};
    const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25 });
    const det = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 });
    for (const m of ['sedan', 'taxi', 'suv', 'pickup', 'van', 'hatch', 'jeep']) {
      const parts = carParts(m, 0xffffff, true);
      const mk = (b, material) => {
        const im = new THREE.InstancedMesh(b.build(), material, max);
        im.count = 0;
        im.castShadow = true;
        im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(im);
        return im;
      };
      const paint = mk(parts.paint, body);
      paint.setColorAt(0, new THREE.Color(1, 1, 1));
      this.models[m] = { paint, detail: mk(parts.detail, det), lights: mk(parts.lights, lampMat) };
    }
    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
  }

  update(cars) {
    const counts = {};
    for (const k in this.models) counts[k] = 0;
    for (const c of cars) {
      const M = this.models[c.model] || this.models.sedan;
      const k = this.models[c.model] ? c.model : 'sedan';
      const i = counts[k]++;
      if (i >= this.max) continue;
      this._e.set(0, -c.yaw, 0);
      this._q.setFromEuler(this._e);
      this._p.set(c.x, c.y, c.z);
      this._m.compose(this._p, this._q, this._s);
      M.paint.setMatrixAt(i, this._m);
      M.detail.setMatrixAt(i, this._m);
      M.lights.setMatrixAt(i, this._m);
      M.paint.setColorAt(i, this._c.setHex(c.color));
    }
    for (const k in this.models) {
      const M = this.models[k];
      const n = Math.min(counts[k], this.max);
      for (const im of [M.paint, M.detail, M.lights]) {
        im.count = n;
        im.instanceMatrix.needsUpdate = true;
      }
      if (M.paint.instanceColor) M.paint.instanceColor.needsUpdate = true;
    }
  }
}

// ── 玩家載具 ──
const VMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 });

export function playerCar(model, color, lampMat) {
  const g = new THREE.Group();
  const parts = carParts(model, color, false);
  const B = new Builder();
  B.append(parts.paint);
  B.append(parts.detail);
  const body = new THREE.Mesh(B.build(), VMAT);
  body.castShadow = true;
  const lights = new THREE.Mesh(parts.lights.build(), lampMat);
  const bodyRoot = new THREE.Group();
  bodyRoot.add(body, lights);
  g.add(bodyRoot);
  const wheels = [];
  const wg = wheelGeo(parts.spec.wheelR);
  for (const w of parts.wheels) {
    const m = new THREE.Mesh(wg, VMAT);
    m.position.set(w.x, w.y, w.z);
    m.castShadow = true;
    if (w.x < 0) m.rotation.y = Math.PI;
    const pivot = new THREE.Group();
    pivot.position.copy(m.position);
    m.position.set(0, 0, 0);
    pivot.add(m);
    g.add(pivot);
    wheels.push({ pivot, mesh: m, front: w.z < 0, left: w.x < 0 });
  }
  return { group: g, bodyRoot, wheels, spec: parts.spec };
}

export function bikeModel() {
  const g = new THREE.Group();
  const B = new Builder();
  const frame = 0x2e6fd8;
  const tube = (x0, y0, z0, x1, y1, z1, r, c) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    m.compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), q, new THREE.Vector3(r, len, r));
    B.geom(P.cyl(6), m, c);
  };
  tube(0, 0.36, 0.52, 0, 0.62, 0.05, 0.022, frame);
  tube(0, 0.36, 0.05, 0, 0.92, 0.18, 0.025, frame);
  tube(0, 0.36, 0.05, 0, 0.36, 0.52, 0.02, frame);
  tube(0, 0.86, 0.15, 0, 0.84, -0.48, 0.025, frame);
  tube(0, 0.36, 0.05, 0, 0.84, -0.46, 0.026, frame);
  tube(0, 0.36, -0.58, 0, 1.02, -0.47, 0.02, 0x3a3f45);
  tube(-0.26, 1.04, -0.45, 0.26, 1.04, -0.45, 0.016, 0x3a3f45);
  B.geom(P.box(), mat(0, 0.96, 0.2, 0.12, 0.05, 0.26), 0x1f2328);
  B.geom(P.cyl(10), mat(0, 0.36, 0.05, 0.08, 0.04, 0.08, 0, 0, Math.PI / 2), 0x8b9096);
  const frameMesh = new THREE.Mesh(B.build(), VMAT);
  frameMesh.castShadow = true;
  g.add(frameMesh);
  const wg = new THREE.TorusGeometry(0.34, 0.035, 8, 24);
  wg.rotateY(Math.PI / 2);
  const spokes = new THREE.CylinderGeometry(0.3, 0.3, 0.01, 10, 1, true);
  spokes.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const z of [0.52, -0.58]) {
    const w = new THREE.Group();
    w.position.set(0, 0.36, z);
    const t = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: TIRE, roughness: 0.8 }));
    const s = new THREE.Mesh(spokes, new THREE.MeshStandardMaterial({ color: 0xc9cdd2, wireframe: true }));
    t.castShadow = true;
    w.add(t, s);
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels };
}

export function planeModel() {
  const g = new THREE.Group();
  const B = new Builder();
  const white = 0xf2f2ef;
  const red = 0xc8322b;
  B.geom(new THREE.CapsuleGeometry(0.62, 5.6, 6, 14), mat(0, 1.6, 0.2, 1, 1, 1, Math.PI / 2, 0, 0), white);
  B.geom(new THREE.ConeGeometry(0.55, 2.4, 14), mat(0, 1.75, 4.2, 1, 1, 1, Math.PI / 2 + 0.06, 0, 0), white);
  B.geom(P.box(), mat(0, 1.5, 0.2, 1.26, 0.12, 6.0), red);
  B.geom(P.box(), mat(0, 2.25, -1.0, 9.6, 0.14, 1.5), white);
  B.geom(P.box(), mat(0, 2.33, -1.0, 9.4, 0.02, 0.3), red);
  B.geom(P.box(), mat(0, 1.9, 4.9, 3.4, 0.1, 0.9), white);
  B.geom(P.box(), mat(0, 2.6, 5.0, 0.1, 1.5, 1.0, -0.25, 0, 0), red);
  B.geom(new THREE.SphereGeometry(0.58, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0, 2.1, -1.2, 0.95, 0.8, 1.7), GLASS);
  for (const s of [-1, 1]) {
    B.geom(P.cyl(6), mat(s * 0.9, 0.85, -1.4, 0.05, 1.1, 0.05, 0, 0, s * 0.35), 0x3a3f45);
    B.geom(P.cyl(14), mat(s * 1.12, 0.32, -1.4, 0.32, 0.18, 0.32, 0, 0, Math.PI / 2), TIRE);
  }
  B.geom(P.cyl(10), mat(0, 0.25, 4.0, 0.16, 0.1, 0.16, 0, 0, Math.PI / 2), TIRE);
  B.geom(P.cone(14), mat(0, 1.6, -3.55, 0.3, 0.55, 0.3, -Math.PI / 2, 0, 0), red);
  const body = new THREE.Mesh(B.build(), VMAT);
  body.castShadow = true;
  g.add(body);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.05), new THREE.MeshStandardMaterial({ color: 0x2b2f33 }));
  prop.position.set(0, 1.6, -3.85);
  g.add(prop);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false }));
  disc.position.set(0, 1.6, -3.9);
  g.add(disc);
  return { group: g, prop, disc };
}

export function boatModel() {
  const g = new THREE.Group();
  const B = new Builder();
  // 船身：俯視外型擠出（船頭在 -z）
  const s = new THREE.Shape();
  s.moveTo(-1.15, 3.0);
  s.lineTo(1.15, 3.0);
  s.lineTo(1.2, -0.5);
  s.quadraticCurveTo(1.0, -2.6, 0, -3.4);
  s.quadraticCurveTo(-1.0, -2.6, -1.2, -0.5);
  s.closePath();
  const hull = new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 });
  hull.rotateX(Math.PI / 2);
  hull.translate(0, 0.65, 0);
  hull.computeVertexNormals();
  B.geom(hull, new THREE.Matrix4(), 0xf4f4f1);
  B.geom(P.box(), mat(0, -0.2, 0, 2.3, 0.08, 6.2), 0xb32d2a);
  B.geom(P.box(), mat(0, 0.72, 0.6, 2.1, 0.05, 4.4), 0xd9cdb5);
  B.geom(P.box(), mat(0, 1.05, -0.4, 1.9, 0.5, 0.06, -0.5, 0, 0), GLASS);
  B.geom(P.box(), mat(-0.45, 0.95, 0.6, 0.7, 0.4, 0.7), 0x3b4148);
  B.geom(P.box(), mat(0.45, 0.95, 0.6, 0.7, 0.4, 0.7), 0x3b4148);
  B.geom(P.box(), mat(0, 1.0, 2.1, 1.9, 0.5, 0.7), 0x3b4148);
  B.geom(P.box(), mat(0, 0.7, 3.25, 0.5, 1.1, 0.45), 0x22262b);
  const m = new THREE.Mesh(B.build(), VMAT);
  m.castShadow = true;
  g.add(m);
  return { group: g };
}

export function chairGeo() {
  const B = new Builder();
  const c = 0x5d636b;
  B.geom(P.cyl(6), mat(0, 1.25, 0, 0.04, 2.5, 0.04), c);
  B.geom(P.box(), mat(0, 2.52, 0, 0.3, 0.3, 0.5), 0x3a3f45);
  B.geom(P.box(), mat(0, 0.0, 0.05, 1.9, 0.08, 0.55), c);
  B.geom(P.box(), mat(0, 0.36, 0.33, 1.9, 0.62, 0.06, 0.15, 0, 0), c);
  B.geom(P.box(), mat(0, 0.0, -0.06, 1.85, 0.05, 0.42), 0x41474f);
  B.geom(P.box(), mat(0, 0.62, -0.4, 1.9, 0.05, 0.05), c);
  for (const s of [-1, 1]) {
    B.geom(P.box(), mat(s * 0.95, 0.3, -0.18, 0.05, 0.62, 0.05), c);
    B.geom(P.box(), mat(s * 0.95, 0.62, -0.1, 0.05, 0.05, 0.6), c);
  }
  return B.build();
}
