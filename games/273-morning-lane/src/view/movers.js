// 會動的東西的畫面：狗（Blender 的 dog）、對向來車（car／carRed）、灑水器（Blender 本體＋執行時的水珠）、報紙補給包。
// 只讀 core/hazards.js 與 game.taken 的狀態。
import * as THREE from 'three';
import { HAZ } from '../core/config.js';
import { sprayAngle, sprayDir } from '../core/hazards.js';
import { meshes } from './rider.js';

const DROPS = 64;

export function makeMovers(scene, haz, A, street, taken) {
  const root = new THREE.Group(); scene.add(root);
  const dogs = haz.dogs.map(() => { const g = new THREE.Group(); const m = meshes(A.dog); g.add(m); root.add(g); return { g, m }; });
  const cars = haz.cars.map((c) => { const g = meshes(c.variant ? A.carRed : A.car); g.visible = false; root.add(g); return g; });
  // 灑水器：Blender 的擺動式灑水器本體（水管往房子那側拖）＋一串沿拋物線飛的水珠
  for (const s of haz.sprinklers) { const g = meshes(A.sprinkler); g.position.set(s.x, 0.02, s.z); g.rotation.y = s.side > 0 ? 0 : Math.PI; root.add(g); }
  // 報紙補給包：放在車道上、慢慢轉，撿走就消失
  const bundles = street.bundles.map((b) => { const g = meshes(A.bundle); g.position.set(b.x, 0, b.z); g.scale.setScalar(1.4); root.add(g); return g; });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 6, 4), new THREE.MeshBasicMaterial({ color: '#b9dcff', transparent: true, opacity: 0.8, depthWrite: false }), Math.max(1, haz.sprinklers.length * DROPS));
  drops.frustumCulled = false; drops.count = 0; root.add(drops);
  const M = new THREE.Matrix4(), S = new THREE.Vector3(1, 1, 1), Q = new THREE.Quaternion(), P = new THREE.Vector3();

  function sync(t) {
    street.bundles.forEach((b, i) => {
      const g = bundles[i]; g.visible = !taken.has(b.id);
      if (g.visible) { g.rotation.y = t * 1.2 + i; g.position.y = 0.06 + Math.sin(t * 3 + i) * 0.05; }
    });
    haz.dogs.forEach((d, i) => {
      const { g, m } = dogs[i];
      const running = d.v > 0.5;
      g.position.set(d.x, running ? Math.abs(Math.sin(d.run * 2.6)) * 0.14 : 0.12, d.z);
      g.rotation.y = -d.yaw;
      m.rotation.x = running ? Math.sin(d.run * 2.6) * 0.12 : 0;
    });
    haz.cars.forEach((c, i) => {
      const g = cars[i]; g.visible = c.state === 'drive';
      if (g.visible) { g.position.set(c.x, 0, c.z); g.rotation.y = Math.PI; }
    });
    let n = 0;
    for (const s of haz.sprinklers) {
      for (let k = 0; k < DROPS; k++) {
        const u = (t * 1.3 + k / DROPS) % 1;
        const a = sprayAngle(s, t - u * 0.45), dir = sprayDir(s, a);   // 舊的水珠沿著稍早的方向飛
        const r = u * HAZ.sprReach, j = ((k * 37) % 11) / 11 - 0.5;
        P.set(s.x + dir.x * r - dir.z * j * 0.12 * u, 0.33 + 4 * 0.9 * u * (1 - u), s.z + dir.z * r + dir.x * j * 0.12 * u);
        S.setScalar(1 - u * 0.4);
        drops.setMatrixAt(n++, M.compose(P, Q, S));
      }
    }
    drops.count = n; drops.instanceMatrix.needsUpdate = true;
  }
  function dispose() { scene.remove(root); drops.dispose(); }
  return { sync, dispose, root };
}
