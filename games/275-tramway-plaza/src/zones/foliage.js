// 區塊 5：程序化植栽系統 — 歐式自然分叉行道樹、公園喬木、灌木叢與屋頂空中花園（全 InstancedMesh，僅 2 Draw Calls）
import * as THREE from 'three';

/**
 * 決定性偽亂數，確保每次載入每棵樹的枝幹傾角與葉團錯落完全一致
 */
function seeded(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 建立自然不規則的有機多面體葉團基礎幾何（避免呆板正球體或圓錐體）
 */
function createOrganicLeafPuffGeo() {
  const geo = new THREE.IcosahedronGeometry(1.0, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 0.86 + 0.24 * Math.sin(v.x * 3.7 + v.y * 2.3) * Math.cos(v.z * 3.1 - v.y * 1.9);
    v.multiplyScalar(n);
    v.y *= 0.78; // 微扁平層次樹冠，更貼近參考圖的地中海／歐風闊葉樹
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildFoliageSystem(materials, treeSlots, shrubSlots, rooftopPlantSlots) {
  const group = new THREE.Group();
  group.name = 'zone_foliage';

  // 再加入廣場與北側公寓中庭的點綴喬木（對照參考圖：噴泉右上側、公寓之間皆有綠樹穿插）
  const extraTrees = [
    { x: 9.2, y: 0.095, z: 4.8, scale: 1.06, kind: 'plaza' },
    { x: 11.4, y: 0.095, z: 2.2, scale: 0.96, kind: 'plaza' },
    { x: -12.0, y: 0.095, z: -1.6, scale: 0.94, kind: 'plaza' },
    // 北側高架環內公寓中庭綠樹
    { x: 0.9, y: 0.095, z: -8.6, scale: 1.02, kind: 'courtyard' },
    { x: 8.3, y: 0.095, z: -8.4, scale: 1.05, kind: 'courtyard' },
    { x: 16.4, y: 0.095, z: -10.8, scale: 0.98, kind: 'courtyard' },
    { x: 17.8, y: 0.095, z: -14.6, scale: 0.92, kind: 'courtyard' },
    { x: -6.2, y: 0.095, z: -14.8, scale: 0.94, kind: 'courtyard' },
  ];
  const allTrees = [...treeSlots, ...extraTrees];

  const woodTransforms = [];
  const leafTransforms = [];

  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  // 1. 生成每棵樹的主幹 + 2~3 支分叉側枝 + 5~6 團通透錯落葉冠
  allTrees.forEach((t, idx) => {
    const s = t.scale || 1.0;
    const r1 = seeded(idx * 3.1 + 1);
    const r2 = seeded(idx * 7.3 + 2);
    const leanX = (r1 - 0.5) * 0.14;
    const leanZ = (r2 - 0.5) * 0.14;
    const trunkH = (2.15 + r1 * 0.45) * s;

    // 主幹
    pos.set(t.x, t.y + trunkH * 0.5, t.z);
    euler.set(leanX, r1 * Math.PI * 2, leanZ);
    quat.setFromEuler(euler);
    scl.set(0.16 * s, trunkH, 0.16 * s);
    m4.compose(pos, quat, scl);
    woodTransforms.push(m4.clone());

    const crownBaseY = t.y + trunkH * 0.88;

    // 三支向上斜伸的分叉枝幹與各自承托的葉團
    const branchCount = 3;
    for (let b = 0; b < branchCount; b++) {
      const bAngle = r2 * Math.PI * 2 + (b / branchCount) * Math.PI * 2 + seeded(idx * 11 + b) * 0.45;
      const bTilt = 0.48 + seeded(idx * 17 + b) * 0.22;
      const bLen = (0.95 + seeded(idx * 23 + b) * 0.35) * s;

      const dirX = Math.cos(bAngle) * Math.sin(bTilt);
      const dirY = Math.cos(bTilt);
      const dirZ = Math.sin(bAngle) * Math.sin(bTilt);

      pos.set(
        t.x + leanX * trunkH * 0.4 + dirX * bLen * 0.45,
        crownBaseY + dirY * bLen * 0.45,
        t.z + leanZ * trunkH * 0.4 + dirZ * bLen * 0.45,
      );
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dirX, dirY, dirZ).normalize());
      scl.set(0.085 * s, bLen, 0.085 * s);
      m4.compose(pos, quat, scl);
      woodTransforms.push(m4.clone());

      // 枝端主葉團
      const tipX = t.x + dirX * bLen * 0.98;
      const tipY = crownBaseY + dirY * bLen * 0.98 + 0.18 * s;
      const tipZ = t.z + dirZ * bLen * 0.98;
      const puffR = (0.86 + seeded(idx * 29 + b) * 0.24) * s;

      pos.set(tipX, tipY, tipZ);
      euler.set(seeded(idx + b) * 0.4, bAngle, seeded(idx * 2 + b) * 0.4);
      quat.setFromEuler(euler);
      scl.set(puffR * 1.08, puffR * 0.92, puffR);
      m4.compose(pos, quat, scl);
      leafTransforms.push(m4.clone());
    }

    // 樹頂中央高冠葉團與側翼小葉團（營造自然空氣感輪廓）
    pos.set(t.x + leanX * 0.4, crownBaseY + 1.15 * s, t.z + leanZ * 0.4);
    euler.set(0, r1 * 3.1, 0);
    quat.setFromEuler(euler);
    scl.set(1.02 * s, 0.92 * s, 0.98 * s);
    m4.compose(pos, quat, scl);
    leafTransforms.push(m4.clone());

    pos.set(t.x - leanX * 0.8 + (r2 - 0.5) * 0.5 * s, crownBaseY + 0.52 * s, t.z + (r1 - 0.5) * 0.5 * s);
    scl.set(0.76 * s, 0.68 * s, 0.76 * s);
    m4.compose(pos, quat, scl);
    leafTransforms.push(m4.clone());
  });

  // 2. 地面低矮灌木叢（水池岸邊、高架下綠帶）
  const extraShrubs = [
    { x: -0.2, y: 0.22, z: 0.5, scale: 0.72 },
    { x: 2.2, y: 0.22, z: 0.5, scale: 0.68 },
    { x: 7.4, y: 0.22, z: 0.5, scale: 0.75 },
    { x: 12.8, y: 0.22, z: 0.5, scale: 0.70 },
    { x: -4.2, y: 0.22, z: -5.4, scale: 0.78 },
    { x: 1.5, y: 0.22, z: -5.4, scale: 0.74 },
    { x: 9.2, y: 0.22, z: -5.4, scale: 0.80 },
  ];
  [...shrubSlots, ...extraShrubs].forEach((sh, i) => {
    const sc = (sh.scale || 0.8) * 0.48;
    pos.set(sh.x, sh.y + sc * 0.55, sh.z);
    euler.set(0, i * 1.1, 0);
    quat.setFromEuler(euler);
    scl.set(sc * 1.25, sc * 0.82, sc * 1.15);
    m4.compose(pos, quat, scl);
    leafTransforms.push(m4.clone());
  });

  // 3. 歐風公寓屋頂花園植栽團（重現參考圖每棟公寓閣樓頂端蓬鬆茂盛的屋頂綠植！）
  rooftopPlantSlots.forEach((rp, i) => {
    const count = 5;
    for (let k = 0; k < count; k++) {
      const ox = (seeded(i * 13 + k) - 0.5) * rp.w;
      const oz = (seeded(i * 29 + k) - 0.5) * rp.d;
      const r = 0.28 + seeded(i * 41 + k) * 0.22;
      pos.set(rp.x + ox, rp.y + r * 0.55, rp.z + oz);
      euler.set(0, k * 1.3, 0);
      quat.setFromEuler(euler);
      scl.set(r * 1.2, r * 0.95, r * 1.15);
      m4.compose(pos, quat, scl);
      leafTransforms.push(m4.clone());
    }
  });

  // 建立 2 個 InstancedMesh 完成全城植栽渲染
  const woodGeo = new THREE.CylinderGeometry(0.68, 1.0, 1.0, 7);
  const woodMesh = new THREE.InstancedMesh(woodGeo, materials.trunkBark, woodTransforms.length);
  woodMesh.name = 'instanced_tree_trunks';
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  woodTransforms.forEach((mat, i) => woodMesh.setMatrixAt(i, mat));
  woodMesh.instanceMatrix.needsUpdate = true;

  const puffGeo = createOrganicLeafPuffGeo();
  const leafMesh = new THREE.InstancedMesh(puffGeo, materials.foliage, leafTransforms.length);
  leafMesh.name = 'instanced_foliage_crowns';
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  leafTransforms.forEach((mat, i) => leafMesh.setMatrixAt(i, mat));
  leafMesh.instanceMatrix.needsUpdate = true;

  group.add(woodMesh, leafMesh);
  return group;
}
