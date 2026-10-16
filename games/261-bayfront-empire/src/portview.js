// 海港畫面：碼頭與堆場（靜態）、隨等級重建的倉庫／岸橋／港務大樓，
// 依經濟狀態移動的貨櫃船、岸橋小車吊櫃動畫、堆場貨櫃（反映庫存）、往返街區的物流車。
import * as THREE from 'three';
import { Builder, prng, T } from './geo.js';
import { HARBOR, harborY, CITY_LOTS, lotRect, BEACH, CORE_STREETS_X } from './layout.js';
import { PAL } from './world.js';
import { PORT, CARGO_IDS, BIZ } from './data.js';
import { absMin } from './port.js';
import { SEA_Y } from './sea.js';

const TBOX = T.box;
const H = HARBOR;
const BOX_COL = ['#c8453c', '#2f7f8f', '#d9a63e', '#5f8790', '#8ea488', '#b5793a', '#e8e2d0', '#2d5a45'];
const CRANE = '#c0442f', CRANE_IDLE = '#8f7a6a';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
const _o = new THREE.Object3D();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
const TOWERS = [[-288, 46], [-236, 46], [-184, 46], [-150, 30]];

function quay(S, D, B) {
  const { x0, x1, z0, z1, y } = H;
  S.box(x0, -2.5, z0, x1, y, z1, '#bdb7a6');
  S.box(x0, -2.5, z1 - 0.4, x1, y + 0.1, z1, '#8f8a7c');
  // 碼頭邊的防舷材與繫纜樁
  for (let x = x0 + 3; x < x1; x += 6) S.box(x - 0.7, -1.2, z1, x + 0.7, y - 0.2, z1 + 0.5, '#2a2f30');
  for (let x = x0 + 6; x < x1; x += 9) { S.cyl(x, y, z1 - 1.2, 0.35, 0.7, '#3a4144', 8); S.cyl(x, y + 0.7, z1 - 1.2, 0.5, 0.15, '#3a4144', 8); }
  // 岸橋軌道、堆場格線、車道
  for (const rz of H.craneZ) D.box(x0, y, rz - 0.15, x1, y + 0.02, rz + 0.15, '#6f6a5e', true);
  D.box(x0, y, 45.5, x1, y + 0.02, 45.8, '#e8c25a', true);
  for (const z of [21.5, 32.9, 44.2]) D.box(H.yard.x0 - 3.3, y, z - 0.08, H.yard.x0 - 3.3 + H.yard.cols * H.yard.step, y + 0.02, z + 0.08, '#f2ecd8', true);
  for (let k = 0; k <= H.yard.cols; k++) {
    const x = H.yard.x0 - 3.3 + k * H.yard.step;
    D.box(x - 0.06, y, 21.5, x + 0.06, y + 0.02, 32.9, '#f2ecd8', true);
    D.box(x - 0.06, y, 32.9, x + 0.06, y + 0.02, 44.2, '#f2ecd8', true);
  }
  D.box(H.gateX - 5, y, z0, H.gateX + 5, y + 0.02, 46, '#5c6662', true);
  for (let z = z0 + 1; z < 45; z += 4) D.box(H.gateX - 0.1, y + 0.02, z, H.gateX + 0.1, y + 0.03, z + 2, '#f2ecd8', true);
  // 大門崗亭與柵欄
  S.box(H.gateX + 5.6, y, 18, H.gateX + 8.4, y + 2.8, 21, '#e9efe6');
  S.box(H.gateX + 5.4, y + 2.8, 17.8, H.gateX + 8.6, y + 3.05, 21.2, '#2d5a45');
  S.box(H.gateX - 5, y + 0.9, 19.2, H.gateX + 5.4, y + 1.05, 19.4, '#e0763a');
  // 照明塔
  for (const [lx, lz] of TOWERS) {
    S.box(lx - 0.25, y, lz - 0.25, lx + 0.25, y + 16, lz + 0.25, '#7d8784');
    S.box(lx - 1.4, y + 16, lz - 0.5, lx + 1.4, y + 16.3, lz + 0.5, '#7d8784');
    B.box(lx - 1.2, y + 15.6, lz - 0.4, lx + 1.2, y + 16, lz + 0.4, '#fff1c8');
  }
}

// 斜撐：在 x 固定的 yz 平面上，從 (y0,z0) 拉到 (y1,z1)
function strut(S, x, y0, z0, y1, z1, w, color) {
  const dy = y1 - y0, dz = z1 - z0;
  S.add(TBOX, x, y0, z0, w, Math.hypot(dy, dz), w, 0, color, Math.atan2(dz, dy));
}

// 隨等級變化：倉庫、冷藏倉、港務大樓、岸橋本體
function harborLevel(S, B, lv) {
  const y = H.y;
  const wall = lv ? '#ddd6c4' : '#a9a393', roof = lv ? '#4f6b5a' : '#6f6a5e';
  S.box(-298, y, 19, -274, y + 8, 40, wall);
  S.add(T.prism, -286, y + 8, 29.5, 24.4, 2.6, 21.4, Math.PI / 2, roof);
  for (let z = 21; z < 39; z += 4.4) S.box(-274, y, z, -273.85, y + 5, z + 3.2, lv ? '#8e9a96' : '#7c7a70', true);
  S.box(-280, y + 8.6, 40.1, -276, y + 9.8, 40.25, lv ? PORT.color : '#7c7a70', true);
  if (lv >= 2) {
    // 冷藏倉：白牆藍帶與屋頂冷凝機
    S.box(-298, y, 42, -278, y + 6.5, 54, '#f1f3ef');
    S.box(-298, y + 4.4, 53.98, -278, y + 5.2, 54.1, '#2f7f8f', true);
    S.box(-278.1, y + 4.4, 42, -277.98, y + 5.2, 54, '#2f7f8f', true);
    for (let x = -295; x < -280; x += 4) S.box(x, y + 6.5, 45, x + 2.4, y + 7.6, 47.4, PAL.ac);
  }
  if (lv >= 3) {
    // 港務大樓與管制塔
    S.box(-156, y, 19, -146, y + 14, 27, '#e9e2d0');
    for (let f = 0; f < 4; f++) B.box(-146.02, y + 2 + f * 3, 20, -145.9, y + 3.6 + f * 3, 26, '#ffe9b0');
    S.box(-154, y + 14, 20.5, -148, y + 18, 25.5, '#3e5258');
    S.box(-154.6, y + 18, 20, -147.4, y + 18.4, 26, '#e9e2d0');
    S.cyl(-151, y + 18.4, 23, 0.1, 4, '#d8d4c8', 6);
  }
  // 岸橋：門型框架、伸向海面的吊臂、機房
  const n = lv ? PORT.cranes[lv - 1] : 1;
  for (let b = 0; b < n; b++) {
    const cx = H.berths[b] + 4;
    const c = lv ? CRANE : CRANE_IDLE;
    const [za, zb] = H.craneZ;
    for (const lx of [cx - 5, cx + 5]) {
      for (const lz of [za, zb]) S.box(lx - 0.45, y, lz - 0.45, lx + 0.45, y + 23, lz + 0.45, c);
      S.box(lx - 0.4, y + 9, za, lx + 0.4, y + 9.8, zb, c);
      S.box(lx - 0.3, y, za - 0.8, lx + 0.3, y + 0.6, zb + 0.8, '#3a4144');
      strut(S, lx, y + 9.8, za, y + 23, zb, 0.3, c);
    }
    S.box(cx - 5.4, y + 9, za - 0.4, cx + 5.4, y + 9.8, za + 0.4, c);
    S.box(cx - 5.4, y + 23, za - 0.5, cx + 5.4, y + 24.2, zb + 0.5, c);
    // 吊臂（兩根平行樑）
    for (const sx of [cx - 1.6, cx + 1.6]) S.box(sx - 0.35, y + 23.4, 38, sx + 0.35, y + 24.6, 82, c);
    S.box(cx - 2.1, y + 24.6, 79, cx + 2.1, y + 25.2, 82, c);
    // 機房與拉桿
    S.box(cx - 3, y + 24.2, 39, cx + 3, y + 27.4, 45, PAL.white);
    S.box(cx - 2.6, y + 25, 45, cx + 2.6, y + 26.4, 45.1, '#3e5258', true);
    S.box(cx - 0.3, y + 24.2, za + 2, cx + 0.3, y + 31, za + 2.6, c);
    for (const sx of [cx - 1.6, cx + 1.6]) {
      strut(S, sx, y + 31, za + 2.3, y + 24.6, 81, 0.2, c);
      strut(S, sx, y + 31, za + 2.3, y + 24.6, 39, 0.2, c);
    }
  }
}

function feederGeo() {
  const S = new Builder();
  S.add(TBOX, 0, -2.2, 0, 9, 4, 40, 0, '#3f4f5a');
  S.add(T.cone4, 0, -0.2, 20, 12.7, 7, 5.66, 0, '#3f4f5a', Math.PI / 2);
  S.add(TBOX, 0, -0.5, 0, 9.04, 0.9, 40.04, 0, '#a8462f');
  S.add(TBOX, 0, 1.75, 0, 8.4, 0.2, 44, 0, '#55646b');
  S.add(TBOX, 0, 1.8, -16.5, 8, 8, 6, 0, '#f2ecdc');
  S.add(TBOX, 0, 7.4, -15.2, 8.3, 1.2, 3.6, 0, '#34444b');
  S.add(TBOX, 0, 9.8, -17.5, 1.6, 3.2, 1.6, 0, '#2d5a45');
  S.add(TBOX, 0, 1.8, 21.5, 6, 0.9, 3, 0, '#f2ecdc');
  return S.geometry();
}
function truckGeo() {
  const S = new Builder();
  S.add(TBOX, 0, 0.4, 2.3, 2.2, 2.1, 2.0, 0, '#2d5a45');
  S.add(TBOX, 0, 1.4, 3.0, 2.0, 0.8, 0.45, 0, '#34444b');
  S.add(TBOX, 0, 0.4, -1.2, 2.3, 3.1, 5.0, 0, '#f2ecdc');
  S.add(TBOX, 0, 1.6, -1.2, 2.34, 0.5, 5.02, 0, '#a8462f');
  for (const z of [-2.6, 2.4]) for (const x of [-1.1, 1.1]) S.add(T.cyl8, x, 0.4, z, 0.8, 0.35, 0.8, 0, '#22282a', 0, Math.PI / 2);
  return S.geometry();
}

export function createHarbor(scene, { sea, getState }) {
  const matS = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matD = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const matB = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.8, 0.8, 0.78) });
  {
    const S = new Builder(), D = new Builder(), B = new Builder();
    quay(S, D, B);
    scene.add(S.mesh(matS), D.mesh(matD, { cast: false }), B.mesh(matB, { cast: false, receive: false }));
  }
  // 照明塔的夜間光暈
  const poolMat = new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), poolMat, TOWERS.length);
  TOWERS.forEach(([x, z], i) => pools.setMatrixAt(i, _m.compose(_p.set(x, H.y + 0.05, z - 6), _q.identity(), _s.set(15, 1, 13))));
  pools.frustumCulled = false;
  pools.visible = false;
  scene.add(pools);
  let lvMeshes = [];
  let curLv = -1;
  function setLevel(lv) {
    if (lv === curLv) return;
    curLv = lv;
    for (const m of lvMeshes) { scene.remove(m); m.geometry.dispose(); }
    const S = new Builder(), B = new Builder();
    harborLevel(S, B, lv);
    lvMeshes = [S.mesh(matS)];
    if (!B.empty) lvMeshes.push(B.mesh(matB, { cast: false, receive: false }));
    for (const m of lvMeshes) scene.add(m);
  }

  // 岸橋小車、吊具、鋼索、吊著的貨櫃
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const trolley = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: '#f2ecdc' }), 3);
  const rope = new THREE.InstancedMesh(unit, new THREE.MeshBasicMaterial({ color: '#2a2f30' }), 6);
  const spreader = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: '#e0a23a' }), 3);
  const lifted = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: '#ffffff' }), 3);
  lifted.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(9), 3);
  // 堆場貨櫃與船上貨櫃
  const YMAX = H.yard.z.length * H.yard.cols * H.yard.tiers;
  const yard = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: '#ffffff' }), YMAX);
  yard.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(YMAX * 3), 3);
  const SHIPS = 8, PER = 54;
  const hulls = new THREE.InstancedMesh(feederGeo(), matS, SHIPS);
  const cargo = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: '#ffffff' }), SHIPS * PER);
  cargo.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHIPS * PER * 3), 3);
  const trucks = new THREE.InstancedMesh(truckGeo(), matS, 6);
  for (const m of [trolley, rope, spreader, lifted, yard, hulls, cargo, trucks]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = m !== rope;
    m.receiveShadow = m === yard;
    m.count = 0;
    scene.add(m);
  }
  const rnd = prng(4040);
  for (let i = 0; i < YMAX; i++) { _c.set(BOX_COL[Math.floor(rnd() * BOX_COL.length)]); yard.instanceColor.setXYZ(i, _c.r, _c.g, _c.b); }
  for (let i = 0; i < SHIPS * PER; i++) { _c.set(BOX_COL[Math.floor(rnd() * BOX_COL.length)]); cargo.instanceColor.setXYZ(i, _c.r, _c.g, _c.b); }
  for (let i = 0; i < 3; i++) { _c.set(BOX_COL[i * 2]); lifted.instanceColor.setXYZ(i, _c.r, _c.g, _c.b); }

  // 堆場格位：依庫存（每 60 單位一櫃）＋卸下但尚未交付的合約櫃填滿
  const slots = [];
  for (let t = 0; t < H.yard.tiers; t++) for (let k = 0; k < H.yard.cols; k++) for (const z of H.yard.z) slots.push([H.yard.x0 + k * H.yard.step, H.y + t * 2.6, z]);
  let yardShown = -1;
  function setYard(n) {
    n = Math.min(YMAX, Math.max(0, Math.round(n)));
    if (n === yardShown) return;
    yardShown = n;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = slots[i];
      _m.compose(_p.set(x, y, z), _q.identity(), _s.set(6.1, 2.55, 2.45));
      yard.setMatrixAt(i, _m);
    }
    yard.count = n;
    yard.instanceMatrix.needsUpdate = true;
  }

  // 船：由經濟狀態算出位置
  const view = new Map();
  function shipPose(q, now) {
    const anchor = H.anchor[q.id % H.anchor.length];
    const berth = q.berth >= 0 ? [H.berths[q.berth], H.shipZ] : anchor;
    const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const ease = (k) => k * k * (3 - 2 * k);
    if (q.state === 'inbound') {
      const k = Math.max(0, Math.min(1, (now - q.t) / Math.max(1, q.eta - q.t)));
      return lerp(H.spawn, anchor, ease(k));
    }
    if (q.state === 'waiting') return anchor;
    if (q.state === 'berthing') return lerp(anchor, berth, ease(Math.min(1, (now - q.t) / 40)));
    if (q.state === 'unloading') return berth;
    return lerp(berth, [H.spawn[0], H.spawn[1] - 60], ease(Math.min(1, (now - q.t) / 120)));
  }

  // 物流車
  const T_ = [];
  // 物流車的停車格：港務區東側，車頭朝海
  const park = (k) => [-161 + k * 3.3, 38];
  function truckRoute(s, k) {
    // 隨機挑一家有開的店，沿海道路東行 → 街道北上 → 大道西行 → 回到沿海道路 → 回港
    const own = BIZ.filter((b) => s.biz[b.id].lv);
    if (!own.length) return null;
    const b = own[Math.floor(rnd() * own.length)];
    let tx, row0 = false;
    if (CITY_LOTS[b.id]) {
      const r = lotRect(...CITY_LOTS[b.id]);
      tx = (r.x0 + r.x1) / 2;
      row0 = CITY_LOTS[b.id][1] === 0;
    } else tx = b.id === 'umbrella' ? -30 : b.id === 'boat' ? 18 : BEACH[b.id].x;
    const xt = CORE_STREETS_X.find((x) => x > tx + 4) ?? 120;
    const pts = [[H.gateX + 2.6, 10], [H.gateX + 3, 3.5]];
    if (!row0) pts.push([tx - 3, 3.5], ['stop', tx, 3.5]);
    pts.push([xt + 2.6, 3.5], [xt + 2.6, -44.6]);
    if (row0) pts.push(['stop', tx, -44.6]);
    pts.push([-122.6, -44.6], [-122.6, -3.5], [H.gateX - 2.6, -3.5], [H.gateX - 2.6, 10], [H.gateX - 2.6, 30], [park(k)[0], 30], park(k));
    return { pts, id: b.id };
  }

  return {
    setLevel,
    update(dt, speed) {
      const s = getState();
      const p = s.port;
      setLevel(p.lv);
      const now = absMin(s);
      // 堆場
      let contractBoxes = 0;
      for (const q of p.ships) if (q.kind === 'contract' && q.state === 'unloading') contractBoxes += Math.floor(q.done);
      let units = 0;
      for (const c of CARGO_IDS) units += p.stock[c];
      setYard(Math.ceil(units / PORT.container) + contractBoxes);

      // 船隻與船上貨櫃
      let n = 0, nc = 0;
      const seen = new Set();
      for (const q of p.ships) {
        if (n >= SHIPS) break;
        const [x, z] = shipPose(q, now);
        let v = view.get(q.id);
        if (!v) { v = { x, z, yaw: Math.PI / 2 }; view.set(q.id, v); }
        const dx = x - v.x, dz = z - v.z, d = Math.hypot(dx, dz);
        let yaw = v.yaw;
        if (d > 0.02) yaw = Math.atan2(dx, dz);
        if (q.state === 'unloading' || (q.state === 'berthing' && d < 0.02)) yaw = Math.PI / 2;
        if (q.state === 'waiting') yaw = v.yaw;
        let dy = yaw - v.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        v.yaw += dy * Math.min(1, dt * 1.5);
        if (d > 0.05) sea.wakeAt(v, x, z, v.yaw, Math.min(d, 6) * 0.7, 22, 5);
        v.x = x; v.z = z;
        seen.add(q.id);
        const bob = Math.sin(performance.now() * 0.0011 + q.id) * 0.12;
        _o.position.set(v.x, SEA_Y + bob, v.z);
        _o.rotation.set(0, v.yaw, Math.sin(performance.now() * 0.0008 + q.id) * 0.012);
        _o.updateMatrix();
        hulls.setMatrixAt(n, _o.matrix);
        // 甲板貨櫃：剩下幾櫃就畫幾櫃（最多 54）
        const left = Math.min(PER, Math.ceil(q.total - q.done));
        for (let k = 0; k < left; k++) {
          const bay = Math.floor(k / 6), r = k % 3, tier = Math.floor((k % 6) / 3);
          _m.compose(_p.set((r - 1) * 2.6, 1.95 + tier * 2.6, 14.5 - bay * 3.3), _q.identity(), _s.set(2.45, 2.55, 3.1));
          _m.premultiply(_o.matrix);
          cargo.setMatrixAt(nc++, _m);
        }
        v.label = { id: q.id, name: q.name, x: v.x, z: v.z, q };
        n++;
      }
      for (const id of view.keys()) if (!seen.has(id)) view.delete(id);
      hulls.count = n;
      cargo.count = nc;
      hulls.instanceMatrix.needsUpdate = cargo.instanceMatrix.needsUpdate = true;

      // 岸橋吊櫃動畫：對應泊位有船在卸貨時循環
      const nCr = p.lv ? PORT.cranes[p.lv - 1] : 1;
      let li = 0;
      const t = performance.now() / 1000;
      for (let b = 0; b < 3; b++) {
        if (b >= nCr) { trolley.setMatrixAt(b, HIDE); spreader.setMatrixAt(b, HIDE); rope.setMatrixAt(b, HIDE); lifted.setMatrixAt(b, HIDE); continue; }
        const cx = H.berths[b] + 4;
        const work = p.ships.some((q) => q.state === 'unloading' && q.berth === b) && speed > 0;
        const cyc = work ? ((t * Math.min(speed, 4) * 0.12 + b * 0.37) % 1) : 0.85;
        // 0–0.15 下降到船上、0.15–0.3 吊起、0.3–0.55 移到岸上、0.55–0.7 放下、0.7–1 回到海側
        let tz, hook;
        if (cyc < 0.3) { tz = 64; hook = cyc < 0.15 ? cyc / 0.15 : 1 - (cyc - 0.15) / 0.15; }
        else if (cyc < 0.55) { tz = 64 - ((cyc - 0.3) / 0.25) * 18; hook = 0; }
        else if (cyc < 0.7) { tz = 46; hook = cyc < 0.625 ? (cyc - 0.55) / 0.075 : 1 - (cyc - 0.625) / 0.075; }
        else { tz = 46 + ((cyc - 0.7) / 0.3) * 18; hook = 0; }
        const top = H.y + 23.2;
        const low = tz > 60 ? SEA_Y + 7.2 : H.y + 2.8;
        const hy = top - 3 - hook * (top - 3 - low);
        _m.compose(_p.set(cx, top - 1.2, tz), _q.identity(), _s.set(3.6, 1.2, 3.2));
        trolley.setMatrixAt(b, _m);
        _m.compose(_p.set(cx, hy, tz), _q.identity(), _s.set(6.4, 0.4, 2.8));
        spreader.setMatrixAt(b, _m);
        _m.compose(_p.set(cx, hy + 0.4, tz), _q.identity(), _s.set(0.12, top - 1.2 - hy - 0.4, 0.12));
        rope.setMatrixAt(b, _m);
        const carry = work && cyc > 0.15 && cyc < 0.625;
        if (carry) { _m.compose(_p.set(cx, hy - 2.55, tz), _q.identity(), _s.set(6.1, 2.55, 2.45)); lifted.setMatrixAt(li++, _m); }
      }
      trolley.count = spreader.count = rope.count = 3;
      lifted.count = li;
      for (const m of [trolley, spreader, rope, lifted]) m.instanceMatrix.needsUpdate = true;

      // 物流車
      const want = p.lv && units > 0 ? PORT.trucks[p.lv - 1] : 0;
      while (T_.length < want) { const [px, pz] = park(T_.length); T_.push({ route: null, i: 0, x: px, z: pz, yaw: 0, wait: rnd() * 6 }); }
      let nt = 0;
      for (let k = 0; k < want; k++) {
        const tr = T_[k];
        if (tr.wait > 0) tr.wait -= dt * speed;
        else {
          if (!tr.route) {
            tr.route = truckRoute(s, k);
            tr.i = 0;
            if (!tr.route) { tr.wait = 5; } else tr.route.pts.unshift([park(k)[0], 30], [H.gateX + 2.6, 30]);
          }
          let left = 10 * dt * speed;
          while (left > 0 && tr.route) {
            const w = tr.route.pts[tr.i];
            if (!w) { tr.route = null; tr.wait = 2 + rnd() * 6; break; }
            if (w[0] === 'stop') {
              const [, sx, sz] = w;
              const dx = sx - tr.x, dz = sz - tr.z, d = Math.hypot(dx, dz);
              if (d <= left) { tr.x = sx; tr.z = sz; tr.i++; tr.wait = 3; break; }
              tr.x += (dx / d) * left; tr.z += (dz / d) * left; tr.yaw = Math.atan2(dx, dz); left = 0;
              continue;
            }
            const dx = w[0] - tr.x, dz = w[1] - tr.z, d = Math.hypot(dx, dz);
            if (d <= left) { tr.x = w[0]; tr.z = w[1]; tr.i++; left -= d; }
            else { tr.x += (dx / d) * left; tr.z += (dz / d) * left; tr.yaw = Math.atan2(dx, dz); left = 0; }
          }
        }
        _m.compose(_p.set(tr.x, harborY(tr.x, tr.z), tr.z), _q.setFromEuler(_e.set(0, tr.yaw, 0)), _s.set(1, 1, 1));
        trucks.setMatrixAt(nt++, _m);
      }
      trucks.count = nt;
      trucks.instanceMatrix.needsUpdate = true;
    },
    shipLabels() {
      const out = [];
      for (const v of view.values()) if (v.label) out.push(v.label);
      return out;
    },
    setNight(k) {
      matB.color.setRGB(0.8 + 0.2 * k, 0.8 + 0.2 * k, 0.78 + 0.1 * k);
      poolMat.opacity = 0.16 * k;
      pools.visible = k > 0.02;
    },
    stats: () => ({ ships: hulls.count, yard: yard.count, trucks: trucks.count }),
  };
}
