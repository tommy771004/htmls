// 車流：在棋盤路網上隨機行駛（靠右），到路口挑下一個方向；同車道前方有車會減速。
// 每個路口有紅綠燈（東西向、南北向輪流放行，各路口錯開相位），紅燈與黃燈時在停止線前停下。
// 轎車、計程車、公車、貨車各一個 InstancedMesh；核心區路口立號誌桿，燈號顏色每幀更新。
import * as THREE from 'three';
import { Builder, prng, T } from './geo.js';
import { STREETS_X, COAST_Z, CORE_STREETS_X, CORE_AVES_Z } from './layout.js';

const TBOX = T.box;
const XS = STREETS_X.filter((x) => Math.abs(x) <= 216);
const ZS = [-168, -126, -84, -42, COAST_Z];
const LANE = 2.6;
// 號誌：一輪 20 秒（東西綠 8、黃 2、南北綠 8、黃 2）
const CYCLE = 20;
export function signalAt(ix, iz, t) {
  const u = (t + ix * 3 + iz * 7) % CYCLE;
  return { ew: u < 8 ? 'g' : u < 10 ? 'y' : 'r', ns: u >= 10 && u < 18 ? 'g' : u >= 18 ? 'y' : 'r' };
}
const STOP = 8.2; // 停止線離路口中心的距離
const PAINT = ['#b4513c', '#e8e2d0', '#3f6b8c', '#2d5a45', '#d4ae55', '#5c6b70', '#8a4f6e', '#e6dcc4', '#2f3a3d', '#7c9a8a'];

function car(S, len, wid, h, roofCol) {
  S.add(TBOX, 0, 0.3, 0, wid, h * 0.45, len, 0, '#ffffff');
  S.add(TBOX, 0, 0.3 + h * 0.45, -len * 0.06, wid * 0.86, h * 0.42, len * 0.52, 0, '#3a4a50');
  S.add(TBOX, 0, 0.3 + h * 0.87, -len * 0.06, wid * 0.86, 0.06, len * 0.5, 0, roofCol);
  for (const [x, z] of [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]]) S.add(T.cyl8, x, 0.32, z, 0.6, 0.3, 0.6, 0, '#22282a', 0, Math.PI / 2);
  S.add(TBOX, 0, 0.45, len / 2, wid * 0.8, 0.15, 0.05, 0, '#fff4c8');
}
const GEOS = {
  sedan: () => { const S = new Builder(); car(S, 4.2, 1.8, 1.4, '#ffffff'); return S.geometry(); },
  taxi: () => { const S = new Builder(); car(S, 4.3, 1.8, 1.4, '#ffffff'); S.add(TBOX, 0, 1.75, -0.2, 0.8, 0.25, 0.4, 0, '#f4f1e6'); return S.geometry(); },
  bus: () => {
    const S = new Builder();
    S.add(TBOX, 0, 0.35, 0, 2.5, 2.7, 11, 0, '#ffffff');
    S.add(TBOX, 0, 1.5, 0, 2.54, 1.0, 10.4, 0, '#34444b');
    S.add(TBOX, 0, 3.05, 0, 2.3, 0.2, 9, 0, '#d9d9d0');
    for (const z of [-3.6, 3.6]) for (const x of [-1.25, 1.25]) S.add(T.cyl8, x, 0.45, z, 0.9, 0.35, 0.9, 0, '#22282a', 0, Math.PI / 2);
    return S.geometry();
  },
  truck: () => {
    const S = new Builder();
    S.add(TBOX, 0, 0.4, 2.2, 2.2, 2.0, 2.0, 0, '#ffffff');
    S.add(TBOX, 0, 1.3, 2.9, 2.0, 0.8, 0.5, 0, '#34444b');
    S.add(TBOX, 0, 0.4, -1.2, 2.3, 3.0, 5.0, 0, '#e9e4d6');
    for (const z of [-2.6, 2.4]) for (const x of [-1.1, 1.1]) S.add(T.cyl8, x, 0.4, z, 0.8, 0.35, 0.8, 0, '#22282a', 0, Math.PI / 2);
    return S.geometry();
  },
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

export function createTraffic(scene, { mobile }) {
  const rnd = prng(808);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const types = [
    { k: 'sedan', n: mobile ? 22 : 34, len: 4.2, v: 9, colors: PAINT },
    { k: 'taxi', n: mobile ? 5 : 8, len: 4.3, v: 9.5, colors: ['#e2b23a'] },
    { k: 'bus', n: 3, len: 11, v: 6.5, colors: ['#2d6b55', '#b4513c'] },
    { k: 'truck', n: mobile ? 4 : 6, len: 7, v: 7, colors: ['#5f8790', '#e8e2d0', '#c0662f'] },
  ];
  const cars = [];
  for (const t of types) {
    const mesh = new THREE.InstancedMesh(GEOS[t.k](), mat, t.n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(t.n * 3), 3);
    scene.add(mesh);
    t.mesh = mesh;
    for (let i = 0; i < t.n; i++) {
      _c.set(t.colors[Math.floor(rnd() * t.colors.length)]);
      mesh.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
      // 公車固定跑沿海道路
      const ix = Math.floor(rnd() * XS.length), iz = t.k === 'bus' ? ZS.length - 1 : Math.floor(rnd() * ZS.length);
      const c = { t, mesh, i, ix, iz, dir: 0, u: rnd(), v: 0, vmax: t.v * (0.85 + rnd() * 0.3), x: 0, z: 0, yaw: 0 };
      pickDir(c, true);
      cars.push(c);
    }
  }

  // 號誌桿：立在每個核心路口的東南角（面向鏡頭），兩顆燈頭分別給東西向與南北向
  const poles = new Builder();
  const heads = [];
  for (const x of CORE_STREETS_X) {
    for (const z of CORE_AVES_Z) {
      const px = x + 7.4, pz = z + 7.4;
      poles.box(px - 0.12, 0, pz - 0.12, px + 0.12, 5.4, pz + 0.12, '#2c3d36');
      poles.box(px - 3.2, 5.0, pz - 0.08, px, 5.2, pz + 0.08, '#2c3d36');
      poles.box(px - 0.08, 5.0, pz - 3.2, px + 0.08, 5.2, pz, '#2c3d36');
      poles.box(px - 3.4, 4.4, pz - 0.25, px - 2.7, 5.15, pz + 0.25, '#23302b');
      poles.box(px - 0.25, 4.4, pz - 3.4, px + 0.25, 5.15, pz - 2.7, '#23302b');
      heads.push({ ix: XS.indexOf(x), iz: ZS.indexOf(z), ax: 'ew', x: px - 3.05, y: 4.78, z: pz + 0.27 });
      heads.push({ ix: XS.indexOf(x), iz: ZS.indexOf(z), ax: 'ns', x: px + 0.27, y: 4.78, z: pz - 3.05 });
    }
  }
  const poleMesh = poles.mesh(mat);
  scene.add(poleMesh);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), lampMat, heads.length);
  lamps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(heads.length * 3), 3);
  heads.forEach((h, i) => { _m.compose(_p.set(h.x, h.y, h.z), _q.identity(), _s); lamps.setMatrixAt(i, _m); });
  scene.add(lamps);
  const LAMP = { g: new THREE.Color('#4fd27a'), y: new THREE.Color('#ffc845'), r: new THREE.Color('#ff4a3a') };
  let sigT = 0;

  // dir：0 東 +x、1 南 +z、2 西 -x、3 北 -z
  function neighbor(ix, iz, d) {
    if (d === 0) return ix + 1 < XS.length ? [ix + 1, iz] : null;
    if (d === 2) return ix > 0 ? [ix - 1, iz] : null;
    if (d === 1) return iz + 1 < ZS.length ? [ix, iz + 1] : null;
    return iz > 0 ? [ix, iz - 1] : null;
  }
  function pickDir(c, any) {
    const opts = [];
    for (let d = 0; d < 4; d++) {
      if (!any && d === (c.dir + 2) % 4) continue;
      if (c.t.k === 'bus' && (d === 1 || d === 3)) continue;
      if (neighbor(c.ix, c.iz, d)) opts.push(d);
    }
    // 偏好直行
    if (!any && opts.includes(c.dir) && rnd() < 0.55) return (c.dir = c.dir);
    c.dir = opts.length ? opts[Math.floor(rnd() * opts.length)] : (c.dir + 2) % 4;
  }
  function pos(c) {
    const [nx, nz] = neighbor(c.ix, c.iz, c.dir) || [c.ix, c.iz];
    const x0 = XS[c.ix], z0 = ZS[c.iz], x1 = XS[nx], z1 = ZS[nz];
    const dx = Math.sign(x1 - x0), dz = Math.sign(z1 - z0);
    // 靠右行駛：前進方向的右手邊
    const ox = -dz * LANE, oz = dx * LANE;
    const lane = c.iz === ZS.length - 1 && (c.dir === 0 || c.dir === 2) ? 1.35 : 1;
    return { x: x0 + (x1 - x0) * c.u + ox * lane, z: z0 + (z1 - z0) * c.u + oz * lane, len: Math.hypot(x1 - x0, z1 - z0), yaw: Math.atan2(dx, dz) };
  }

  return {
    update(dt, speed) {
      const s = Math.min(speed, 4);
      sigT += dt * s;
      heads.forEach((h, i) => lamps.setColorAt(i, LAMP[signalAt(h.ix, h.iz, sigT)[h.ax]]));
      lamps.instanceColor.needsUpdate = true;
      for (const c of cars) {
        const p = pos(c);
        // 前車距離
        let ahead = Infinity;
        for (const o of cars) {
          if (o === c || Math.abs(o.yaw - p.yaw) > 0.2) continue;
          const dx = o.x - p.x, dz = o.z - p.z;
          const along = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
          const side = Math.abs(dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw));
          if (along > 0 && side < 1.5 && along < ahead) ahead = along;
        }
        const gap = (c.t.len + 9);
        let target = ahead < gap ? c.vmax * Math.max(0, (ahead - c.t.len - 1.5) / (gap - c.t.len - 1.5)) : c.vmax;
        // 紅綠燈：前方路口不是綠燈就在停止線前停（黃燈時已經很近的就直接過）
        const nb = neighbor(c.ix, c.iz, c.dir);
        if (nb) {
          const sg = signalAt(nb[0], nb[1], sigT)[c.dir % 2 ? 'ns' : 'ew'];
          const toLine = (1 - c.u) * p.len - STOP - c.t.len / 2;
          if (sg !== 'g' && toLine > (sg === 'y' ? 3 : -0.5)) target = Math.min(target, c.vmax * Math.max(0, Math.min(1, (toLine - 0.5) / 14)));
        }
        c.v += (target - c.v) * Math.min(1, dt * 3);
        c.u += (c.v * dt * s) / Math.max(1, p.len);
        if (c.u >= 1) {
          const nb = neighbor(c.ix, c.iz, c.dir);
          if (nb) { c.ix = nb[0]; c.iz = nb[1]; }
          c.u -= 1;
          pickDir(c, false);
        }
        const q = pos(c);
        let dy = q.yaw - c.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        c.yaw += dy * Math.min(1, dt * 8 * Math.max(0.3, s));
        c.x += (q.x - c.x) * Math.min(1, dt * 10 * Math.max(0.3, s));
        c.z += (q.z - c.z) * Math.min(1, dt * 10 * Math.max(0.3, s));
        if (!c.init) { c.x = q.x; c.z = q.z; c.yaw = q.yaw; c.init = true; }
        _m.compose(_p.set(c.x, 0.02, c.z), _q.setFromEuler(_e.set(0, c.yaw, 0)), _s);
        c.mesh.setMatrixAt(c.i, _m);
      }
      for (const t of types) t.mesh.instanceMatrix.needsUpdate = true;
    },
    count: () => cars.length,
  };
}
