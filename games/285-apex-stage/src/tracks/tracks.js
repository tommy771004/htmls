// 賽道與開放式綜合測試場生成系統（Circuit Track & Open Proving Ground）
// 包含：樣條曲線起伏賽道、3D 路緣石、護欄、起終點龍門架、看台、樹木造景、
// 檢查點防作弊與三段計時（S1/S2/S3）、大型甩尾圓環（Skidpad）、飛躍跳台（Ramps）與越野砂石泥地路段。

import * as THREE from 'three';
import { Body, Box, Plane, Trimesh, Vec3, Quaternion } from '../../../../vendor/cannon-es-0.20.0/cannon-es.js';

export const TRACK_LIST = [
  {
    id: 'circuit',
    name: 'TSUKUBA APEX CIRCUIT',
    subtitle: '專業競速賽道 · 高速直道 / 連續 S 彎 / 高低坡度 / 髮夾彎',
    lengthKm: '1.68 KM',
    surfaceDesc: 'ASPHALT 95% · CURB 5%'
  },
  {
    id: 'proving',
    name: 'ARIAKE PROVING GROUND',
    subtitle: '開放式綜合測試場 · 大型甩尾圓環 / 飛躍跳台 / 高速環道 / 越野泥地砂石區',
    lengthKm: 'OPEN 560×560M',
    surfaceDesc: 'ASPHALT · SKIDPAD · GRAVEL · DIRT'
  }
];

/**
 * 將 Three.js BufferGeometry 轉換為 cannon-es Trimesh
 */
function geometryToTrimesh(geometry) {
  const posAttr = geometry.attributes.position;
  const vertices = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count * 3; i++) {
    vertices[i] = posAttr.array[i];
  }
  let indices;
  if (geometry.index) {
    indices = Array.from(geometry.index.array);
  } else {
    indices = new Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) indices[i] = i;
  }
  return new Trimesh(vertices, indices);
}

/**
 * 建立起終點龍門架（Start/Finish Gantry）
 */
function buildGantryMesh(width = 16, label = 'APEX STAGE // START-FINISH') {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.78, roughness: 0.28 });
  const accentMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

  const pillarGeo = new THREE.BoxGeometry(0.65, 6.8, 0.65);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(pillarGeo, metalMat);
    p.position.set(side * (width * 0.5 + 0.5), 3.4, 0);
    p.castShadow = true;
    group.add(p);
  }

  // 橫樑看板
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111419';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#ff5500';
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillRect(0, 84, 512, 12);
  ctx.fillStyle = '#f5f7fa';
  ctx.font = 'italic 900 34px "DIN Condensed", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 256, 58);

  // 方格旗圖騰
  for (let y = 16; y < 80; y += 16) {
    for (let x = 16; x < 80; x += 16) {
      ctx.fillStyle = ((x + y) / 16) % 2 === 0 ? '#ffffff' : '#181b20';
      ctx.fillRect(x, y, 16, 16);
      ctx.fillRect(512 - 80 + (x - 16), y, 16, 16);
    }
  }

  const bannerTex = new THREE.CanvasTexture(c);
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
  const beamGeo = new THREE.BoxGeometry(width + 1.6, 1.35, 0.75);
  const beam = new THREE.Mesh(beamGeo, [metalMat, metalMat, metalMat, metalMat, bannerMat, bannerMat]);
  beam.position.set(0, 6.2, 0);
  beam.castShadow = true;
  group.add(beam);

  // 號誌燈列
  const lightGeo = new THREE.SphereGeometry(0.18, 12, 12);
  for (let i = -2; i <= 2; i++) {
    const l = new THREE.Mesh(lightGeo, accentMat);
    l.position.set(i * 0.9, 5.35, 0.42);
    group.add(l);
  }

  return group;
}

/**
 * 建立低多邊形樹木與看台建築群（Instanced / Merged）
 */
function populateSceneryTrees(group, positions) {
  const count = positions.length;
  if (!count) return;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1.8, 7);
  trunkGeo.translate(0, 0.9, 0);
  const crownGeo = new THREE.ConeGeometry(1.75, 4.4, 8);
  crownGeo.translate(0, 3.4, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2b5832, roughness: 0.78 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
  trunks.castShadow = true;
  crowns.castShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const p = positions[i];
    const scale = p.scale || (0.85 + (i % 5) * 0.12);
    dummy.position.set(p.x, p.y || 0, p.z);
    dummy.scale.setScalar(scale);
    dummy.rotation.y = (i * 1.7) % (Math.PI * 2);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  group.add(trunks, crowns);
}

/**
 * 1. 建立專業競速賽道（Circuit Track）
 */
export function buildCircuitTrack(scene, physicsWorld, textures) {
  physicsWorld.clearTrackBodies();
  const root = new THREE.Group();
  scene.add(root);

  // 封閉賽道控制點（順時針環線：起終點大直道 -> S 彎上坡 -> 高原弧線 -> 下坡複合彎 -> 後直道 -> 終點彎）
  const rawPts = [
    new THREE.Vector3(0, 0.0, -85),     // 0: 大直道起點段
    new THREE.Vector3(0, 0.0, 0),       // 1: 起終點龍門架 (Start/Finish)
    new THREE.Vector3(0, 0.0, 95),      // 2: 大直道底重煞區 (T1 入彎)
    new THREE.Vector3(42, 1.8, 148),    // 3: T1 右彎上坡
    new THREE.Vector3(105, 3.6, 138),   // 4: S 彎第一折
    new THREE.Vector3(158, 4.8, 162),   // 5: S 彎第二折（登頂）
    new THREE.Vector3(212, 4.0, 128),   // 6: 高原高速彎
    new THREE.Vector3(228, 2.2, 55),    // 7: 下坡入彎引道
    new THREE.Vector3(198, 0.5, -8),    // 8: 髮夾複合彎頂點（Apex）
    new THREE.Vector3(210, 0.0, -78),   // 9: 出彎加速段
    new THREE.Vector3(185, 0.0, -148),  // 10: 後方高速大直道中段
    new THREE.Vector3(115, 0.0, -182),  // 11: 後直道底高速右彎
    new THREE.Vector3(42, 0.0, -168),   // 12: 最終複合彎道入彎
    new THREE.Vector3(-4, 0.0, -132)    // 13: 接回主直道
  ];

  const curve = new THREE.CatmullRomCurve3(rawPts, true, 'catmullrom', 0.45);
  const segCount = 280;
  const roadHalfW = 8.6;     // 柏油路總寬 17.2m（寬敞街機超車與甩尾空間）
  const curbW = 1.45;        // 路緣石寬 1.45m
  const shoulderW = 5.5;     // 草地路肩緩衝區

  const samples = [];
  for (let i = 0; i < segCount; i++) {
    const t = i / segCount;
    const pt = curve.getPointAt(t);
    pt.y = Math.max(0, pt.y);
    const tan = curve.getTangentAt(t);
    tan.y = 0;
    tan.normalize();
    // 右側水平向量（+Y cross +Z = +X 左，故右側為 (-tan.z, 0, tan.x)）
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    samples.push({ t, pt, tan, right });
  }

  // 建立賽道柏油網格、路緣石網格與路肩草地網格
  const roadPos = [];
  const roadUV = [];
  const roadIdx = [];

  const curbPos = [];
  const curbUV = [];
  const curbIdx = [];

  const shoulderPos = [];
  const shoulderUV = [];
  const shoulderIdx = [];

  let totalLen = 0;
  for (let i = 0; i <= segCount; i++) {
    const s = samples[i % segCount];
    if (i > 0) {
      const prev = samples[(i - 1) % segCount];
      totalLen += s.pt.distanceTo(prev.pt);
    }
    const vCoord = totalLen / 14.0;

    // Road Left & Right
    const rL = s.pt.clone().addScaledVector(s.right, -roadHalfW);
    const rR = s.pt.clone().addScaledVector(s.right, roadHalfW);
    roadPos.push(rL.x, rL.y + 0.01, rL.z, rR.x, rR.y + 0.01, rR.z);
    roadUV.push(0, vCoord, 1, vCoord);

    // Curbs (Left & Right)
    const cL_in = rL.clone();
    const cL_out = s.pt.clone().addScaledVector(s.right, -(roadHalfW + curbW));
    const cR_in = rR.clone();
    const cR_out = s.pt.clone().addScaledVector(s.right, roadHalfW + curbW);

    curbPos.push(
      cL_out.x, cL_out.y + 0.055, cL_out.z,
      cL_in.x, cL_in.y + 0.015, cL_in.z,
      cR_in.x, cR_in.y + 0.015, cR_in.z,
      cR_out.x, cR_out.y + 0.055, cR_out.z
    );
    const cv = totalLen / 3.2;
    curbUV.push(0, cv, 1, cv, 0, cv, 1, cv);

    // Grass Shoulders (Left & Right Slopes down to ground)
    const shL_out = s.pt.clone().addScaledVector(s.right, -(roadHalfW + curbW + shoulderW));
    const shR_out = s.pt.clone().addScaledVector(s.right, roadHalfW + curbW + shoulderW);
    shoulderPos.push(
      shL_out.x, -0.12, shL_out.z,
      cL_out.x, cL_out.y + 0.04, cL_out.z,
      cR_out.x, cR_out.y + 0.04, cR_out.z,
      shR_out.x, -0.12, shR_out.z
    );
    const sv = totalLen / 10.0;
    shoulderUV.push(0, sv, 1, sv, 0, sv, 1, sv);

    if (i < segCount) {
      const rBase = i * 2;
      // 注意：rL 在 +X (左側)、rR 在 -X (右側)，因此逆時針正面朝上 (+Y) 的頂點順序為 (rBase, rBase+1, rBase+2)
      roadIdx.push(rBase, rBase + 1, rBase + 2, rBase + 1, rBase + 3, rBase + 2);

      const cBase = i * 4;
      // Left curb
      curbIdx.push(cBase, cBase + 1, cBase + 4, cBase + 1, cBase + 5, cBase + 4);
      // Right curb
      curbIdx.push(cBase + 2, cBase + 3, cBase + 6, cBase + 3, cBase + 7, cBase + 6);

      // Left & Right shoulders
      shoulderIdx.push(cBase, cBase + 1, cBase + 4, cBase + 1, cBase + 5, cBase + 4);
      shoulderIdx.push(cBase + 2, cBase + 3, cBase + 6, cBase + 3, cBase + 7, cBase + 6);
    }
  }

  // 建立賽道網格
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUV, 2));
  roadGeo.setIndex(roadIdx);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt.map,
    normalMap: textures.asphalt.normalMap,
    roughnessMap: textures.asphalt.roughnessMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  root.add(roadMesh);

  // 建立路緣石網格
  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
  curbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbUV, 2));
  curbGeo.setIndex(curbIdx);
  curbGeo.computeVertexNormals();

  const curbMat = new THREE.MeshStandardMaterial({
    map: textures.curb.map,
    normalMap: textures.curb.normalMap,
    roughnessMap: textures.curb.roughnessMap,
    roughness: 0.72,
    side: THREE.DoubleSide
  });
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.receiveShadow = true;
  root.add(curbMesh);

  // 建立草地路肩網格與大地面
  const shGeo = new THREE.BufferGeometry();
  shGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoulderPos, 3));
  shGeo.setAttribute('uv', new THREE.Float32BufferAttribute(shoulderUV, 2));
  shGeo.setIndex(shoulderIdx);
  shGeo.computeVertexNormals();

  const grassMat = new THREE.MeshStandardMaterial({
    map: textures.grass.map,
    normalMap: textures.grass.normalMap,
    roughness: 0.92
  });
  const shMesh = new THREE.Mesh(shGeo, grassMat);
  shMesh.receiveShadow = true;
  root.add(shMesh);

  const groundGeo = new THREE.PlaneGeometry(900, 900);
  groundGeo.rotateX(-Math.PI * 0.5);
  const groundMesh = new THREE.Mesh(groundGeo, grassMat);
  groundMesh.position.y = -0.15;
  groundMesh.receiveShadow = true;
  root.add(groundMesh);

  // 物理碰撞體：底層安全平面 + 賽道/路緣石/路肩 Trimesh
  const groundBody = new Body({ mass: 0, material: physicsWorld.defaultMat });
  groundBody.addShape(new Plane(), new Vec3(0, -0.15, 0), new Quaternion().setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI * 0.5));
  physicsWorld.addStaticBody(groundBody, 'grass');

  const roadBody = new Body({ mass: 0, material: physicsWorld.defaultMat });
  roadBody.addShape(geometryToTrimesh(roadGeo));
  physicsWorld.addStaticBody(roadBody, 'asphalt');

  const curbBody = new Body({ mass: 0, material: physicsWorld.defaultMat });
  curbBody.addShape(geometryToTrimesh(curbGeo));
  physicsWorld.addStaticBody(curbBody, 'curb');

  const shBody = new Body({ mass: 0, material: physicsWorld.defaultMat });
  shBody.addShape(geometryToTrimesh(shGeo));
  physicsWorld.addStaticBody(shBody, 'grass');

  // 建立賽道雙側金屬護欄（Guardrails + 物理碰撞牆）
  const railDist = roadHalfW + curbW + 2.6;
  const railMat = new THREE.MeshStandardMaterial({ color: 0xc8d0da, metalness: 0.72, roughness: 0.35 });
  const redWhiteMat = new THREE.MeshStandardMaterial({ color: 0xd92b2b, roughness: 0.55 });
  const railPositions = [];
  const railIndices = [];

  for (let i = 0; i <= segCount; i++) {
    const s = samples[i % segCount];
    const gL = s.pt.clone().addScaledVector(s.right, -railDist);
    const gR = s.pt.clone().addScaledVector(s.right, railDist);
    railPositions.push(
      gL.x, gL.y + 0.15, gL.z,
      gL.x, gL.y + 0.88, gL.z,
      gR.x, gR.y + 0.15, gR.z,
      gR.x, gR.y + 0.88, gR.z
    );
    if (i < segCount) {
      const b = i * 4;
      railIndices.push(b, b + 4, b + 1, b + 1, b + 4, b + 5);
      railIndices.push(b + 2, b + 3, b + 6, b + 3, b + 7, b + 6);
    }
  }
  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
  railGeo.setIndex(railIndices);
  railGeo.computeVertexNormals();
  const railMesh = new THREE.Mesh(railGeo, railMat);
  railMesh.castShadow = true;
  root.add(railMesh);

  // 每隔 2 段建立護欄物理 Box 碰撞體
  for (let i = 0; i < segCount; i += 2) {
    const s0 = samples[i];
    const s1 = samples[(i + 2) % segCount];
    const mid = s0.pt.clone().add(s1.pt).multiplyScalar(0.5);
    const segVec = s1.pt.clone().sub(s0.pt);
    const segLen = segVec.length();
    const yaw = Math.atan2(segVec.x, segVec.z);
    const q = new Quaternion().setFromAxisAngle(new Vec3(0, 1, 0), yaw);

    for (const side of [-1, 1]) {
      const bPos = mid.clone().addScaledVector(s0.right, side * railDist);
      const wallBody = new Body({ mass: 0, material: physicsWorld.barrierMat });
      wallBody.addShape(new Box(new Vec3(0.35, 1.1, segLen * 0.52)));
      wallBody.position.set(bPos.x, bPos.y + 0.7, bPos.z);
      wallBody.quaternion.copy(q);
      physicsWorld.addStaticBody(wallBody, 'asphalt');
    }
  }

  // 起終點龍門架與地面起跑格線
  const gantry = buildGantryMesh(roadHalfW * 2 + 1.2, 'TSUKUBA APEX // START - FINISH');
  gantry.position.set(0, 0, 0);
  root.add(gantry);

  // 看台建築與維修站（Pit Building & Grandstands）
  const standMat = new THREE.MeshStandardMaterial({ color: 0x1e242d, metalness: 0.4, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xe6e9ef, roughness: 0.4 });
  const pitBuilding = new THREE.Group();
  const pitBox = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 68), standMat);
  pitBox.position.set(-16.5, 2.75, 10);
  pitBox.castShadow = true;
  const pitRoof = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.6, 72), roofMat);
  pitRoof.position.set(-15.5, 5.8, 10);
  const pitStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 72), redWhiteMat);
  pitStripe.position.set(-10.3, 5.4, 10);
  pitBuilding.add(pitBox, pitRoof, pitStripe);
  root.add(pitBuilding);

  // 髮夾彎外側大型觀眾看台
  const hairpinStand = new THREE.Mesh(new THREE.BoxGeometry(10, 6.2, 42), standMat);
  hairpinStand.position.set(148, 3.1, 18);
  hairpinStand.castShadow = true;
  root.add(hairpinStand);

  // 種植賽道周圍景觀樹木
  const treeCoords = [];
  for (let i = 0; i < segCount; i += 4) {
    const s = samples[i];
    for (const side of [-1, 1]) {
      if (side === -1 && Math.abs(s.pt.x) < 25 && Math.abs(s.pt.z) < 60) continue; // 避開維修區
      const dist = railDist + 7 + (i % 3) * 4.5;
      const tp = s.pt.clone().addScaledVector(s.right, side * dist);
      treeCoords.push({ x: tp.x, y: 0, z: tp.z, scale: 0.9 + (i % 4) * 0.18 });
    }
  }
  populateSceneryTrees(root, treeCoords);

  // 6 個依序檢查點（Checkpoints）與 3 個計時分段（Sector 1: CP2, Sector 2: CP4, Sector 3: CP0）
  const checkpointIndices = [
    Math.floor(segCount * (1 / 14)), // CP0: Start/Finish (z ≈ 0)
    Math.floor(segCount * 0.22),     // CP1: T1/S-Curve entry
    Math.floor(segCount * 0.38),     // CP2: Sector 1 End (Hilltop)
    Math.floor(segCount * 0.56),     // CP3: Hairpin Exit
    Math.floor(segCount * 0.74),     // CP4: Sector 2 End (Back Straight)
    Math.floor(segCount * 0.90)      // CP5: Final Chicane
  ];

  // 將 samples 旋轉對齊使 index 0 為 Start/Finish (0, 0, 0)
  const startSampleIdx = samples.reduce((bestIdx, cur, idx) => {
    const dCur = Math.hypot(cur.pt.x, cur.pt.z);
    const dBest = Math.hypot(samples[bestIdx].pt.x, samples[bestIdx].pt.z);
    return dCur < dBest ? idx : bestIdx;
  }, 0);

  const orderedCheckpoints = [0, 0.18, 0.34, 0.52, 0.70, 0.86].map((frac, cpIdx) => {
    const sIdx = (startSampleIdx + Math.floor(frac * segCount)) % segCount;
    const s = samples[sIdx];
    return {
      index: cpIdx,
      sampleIndex: sIdx,
      position: s.pt.clone(),
      tangent: s.tan.clone(),
      radius: 18.5,
      isSectorEnd: cpIdx === 2 ? 1 : cpIdx === 4 ? 2 : cpIdx === 0 ? 3 : 0
    };
  });

  // 路面材質解析器：依距離賽道中心線之橫向距離判斷柏油 / 路緣石 / 草地
  physicsWorld.surfaceResolver = (x, z) => {
    let bestDistSq = Infinity;
    let bestSample = samples[0];
    for (let i = 0; i < segCount; i += 2) {
      const p = samples[i].pt;
      const dSq = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestSample = samples[i];
      }
    }
    const dx = x - bestSample.pt.x;
    const dz = z - bestSample.pt.z;
    const latDist = Math.abs(dx * bestSample.right.x + dz * bestSample.right.z);
    if (latDist <= roadHalfW - 0.15) return 'asphalt';
    if (latDist <= roadHalfW + curbW + 0.15) return 'curb';
    if (latDist <= roadHalfW + curbW + 1.8) return 'gravel';
    return 'grass';
  };

  return {
    id: 'circuit',
    name: 'TSUKUBA APEX CIRCUIT',
    root,
    samples,
    checkpoints: orderedCheckpoints,
    startPose: {
      position: new THREE.Vector3(0, 0.25, -8),
      yaw: 0
    },
    getNearestResetPose(x, z) {
      let bestIdx = 0;
      let bestDistSq = Infinity;
      for (let i = 0; i < samples.length; i++) {
        const p = samples[i].pt;
        const dSq = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
      const s = samples[bestIdx];
      return {
        position: new THREE.Vector3(s.pt.x, s.pt.y + 0.35, s.pt.z),
        yaw: Math.atan2(s.tan.x, s.tan.z)
      };
    },
    minimapPoints: samples.filter((_, i) => i % 3 === 0).map((s) => ({ x: s.pt.x, z: s.pt.z })),
    destroy() {
      scene.remove(root);
      physicsWorld.clearTrackBodies();
    }
  };
}

/**
 * 2. 建立開放式綜合測試場（Open Proving Ground）
 * 內含：高速測試外環道、大型甩尾圓環（Skidpad）、飛躍跳台組（Ramps）、懸吊測試波浪路、越野泥地與砂石拉力區
 */
export function buildProvingGround(scene, physicsWorld, textures) {
  physicsWorld.clearTrackBodies();
  const root = new THREE.Group();
  scene.add(root);

  // 1. 基礎大地面（水泥與柏油綜合測試場基底）
  const baseGeo = new THREE.PlaneGeometry(640, 640);
  baseGeo.rotateX(-Math.PI * 0.5);
  const baseMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt.map,
    normalMap: textures.asphalt.normalMap,
    roughnessMap: textures.asphalt.roughnessMap,
    roughness: 0.82
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.receiveShadow = true;
  root.add(baseMesh);

  const groundBody = new Body({ mass: 0, material: physicsWorld.defaultMat });
  groundBody.addShape(new Plane(), new Vec3(0, 0, 0), new Quaternion().setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI * 0.5));
  physicsWorld.addStaticBody(groundBody, 'asphalt');

  // 外圍邊界護欄牆（防止衝出測試場邊界）
  const boundHalf = 260;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x28303d, metalness: 0.6, roughness: 0.4 });
  const borderConfigs = [
    { x: 0, z: boundHalf, w: boundHalf * 2, d: 1.2 },
    { x: 0, z: -boundHalf, w: boundHalf * 2, d: 1.2 },
    { x: boundHalf, z: 0, w: 1.2, d: boundHalf * 2 },
    { x: -boundHalf, z: 0, w: 1.2, d: boundHalf * 2 }
  ];
  for (const bc of borderConfigs) {
    const wMesh = new THREE.Mesh(new THREE.BoxGeometry(bc.w, 1.4, bc.d), wallMat);
    wMesh.position.set(bc.x, 0.7, bc.z);
    root.add(wMesh);

    const wBody = new Body({ mass: 0, material: physicsWorld.barrierMat });
    wBody.addShape(new Box(new Vec3(bc.w * 0.5, 1.2, bc.d * 0.5)));
    wBody.position.set(bc.x, 0.7, bc.z);
    physicsWorld.addStaticBody(wBody, 'asphalt');
  }

  // 2. 西側：大型甩尾圓環（Giant Drift Skidpad, center at x = -85, z = 10, R = 52m）
  const skidCenter = { x: -85, z: 10 };
  const skidGroup = new THREE.Group();
  skidGroup.position.set(skidCenter.x, 0.02, skidCenter.z);

  const skidPadGeo = new THREE.CircleGeometry(52, 64);
  skidPadGeo.rotateX(-Math.PI * 0.5);
  const skidPadMat = new THREE.MeshStandardMaterial({
    color: 0x353b45,
    roughness: 0.48,
    metalness: 0.12
  });
  skidGroup.add(new THREE.Mesh(skidPadGeo, skidPadMat));

  // 同心甩尾角度標線圓環（R = 16m, 28m, 42m）
  const lineOrangeMat = new THREE.MeshBasicMaterial({ color: 0xff5500, side: THREE.DoubleSide });
  const lineCyanMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });
  for (const [r, mat] of [[16, lineOrangeMat], [28, lineCyanMat], [42, lineOrangeMat]]) {
    const rGeo = new THREE.RingGeometry(r - 0.35, r + 0.35, 64);
    rGeo.rotateX(-Math.PI * 0.5);
    const rm = new THREE.Mesh(rGeo, mat);
    rm.position.y = 0.015;
    skidGroup.add(rm);
  }

  // 圓環中心路緣石島與高塔標柱
  const centerCurbGeo = new THREE.CylinderGeometry(6.5, 7.2, 0.12, 32);
  const curbMat = new THREE.MeshStandardMaterial({
    map: textures.curb.map,
    normalMap: textures.curb.normalMap,
    roughness: 0.7
  });
  const centerCurb = new THREE.Mesh(centerCurbGeo, curbMat);
  centerCurb.position.y = 0.06;
  skidGroup.add(centerCurb);

  const pylon = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 6.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.4 })
  );
  pylon.position.y = 3.25;
  pylon.castShadow = true;
  skidGroup.add(pylon);
  root.add(skidGroup);

  // 3. 中央測試走廊：飛躍跳台組（Stunt Ramps）與懸吊行程波浪測試帶
  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x252b35,
    roughness: 0.55,
    metalness: 0.3
  });
  const rampStripeMat = new THREE.MeshBasicMaterial({ color: 0xffd000 });

  function addRamp(x, z, width, length, height, pitchAngleRad) {
    const rGroup = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(width, height, length);
    const mesh = new THREE.Mesh(boxGeo, rampMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rGroup.add(mesh);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.04, length * 0.92), rampStripeMat);
    stripe.position.y = height * 0.5 + 0.01;
    rGroup.add(stripe);

    rGroup.position.set(x, height * 0.22, z);
    rGroup.rotation.x = pitchAngleRad;
    root.add(rGroup);

    const body = new Body({ mass: 0, material: physicsWorld.defaultMat });
    body.addShape(new Box(new Vec3(width * 0.5, height * 0.5, length * 0.5)));
    body.position.set(x, height * 0.22, z);
    body.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), pitchAngleRad);
    physicsWorld.addStaticBody(body, 'asphalt');
  }

  // 主跑道北向起跳台 + 落地斜坡（從起點直衝即可飛躍！）
  addRamp(0, 48, 10, 14, 1.2, -0.17);   // 起跳斜坡（向 +Z 上升，繞 X 軸負向旋轉使 +Z 端翹起）
  addRamp(0, 78, 10, 14, 1.2, 0.17);    // 落地緩衝斜坡
  // 側邊高角度特技跳台
  addRamp(-22, 25, 8, 12, 1.5, -0.22);
  addRamp(-22, 58, 8, 12, 1.5, 0.22);

  // 懸吊行程測試路緣石波浪帶（Rhythm Kerb Strip at x = 22, z = 10..65）
  for (let i = 0; i < 8; i++) {
    const bz = 12 + i * 6.5;
    const sideOffset = (i % 2 === 0 ? -1.4 : 1.4);
    const bumpGeo = new THREE.BoxGeometry(4.2, 0.22, 2.2);
    const bumpMesh = new THREE.Mesh(bumpGeo, curbMat);
    bumpMesh.position.set(22 + sideOffset, 0.06, bz);
    root.add(bumpMesh);

    const bumpBody = new Body({ mass: 0, material: physicsWorld.defaultMat });
    bumpBody.addShape(new Box(new Vec3(2.1, 0.11, 1.1)));
    bumpBody.position.set(22 + sideOffset, 0.06, bz);
    physicsWorld.addStaticBody(bumpBody, 'curb');
  }

  // 4. 東側：專屬越野泥地與砂石拉力園區（Off-Road Dirt & Gravel Zone, center at x = 95, z = 0）
  const offroadCenter = { x: 95, z: 0 };
  const gravelGeo = new THREE.CircleGeometry(72, 64);
  gravelGeo.rotateX(-Math.PI * 0.5);
  const gravelMat = new THREE.MeshStandardMaterial({
    map: textures.gravel.map,
    normalMap: textures.gravel.normalMap,
    roughnessMap: textures.gravel.roughnessMap,
    roughness: 0.92
  });
  const gravelZone = new THREE.Mesh(gravelGeo, gravelMat);
  gravelZone.position.set(offroadCenter.x, 0.025, offroadCenter.z);
  gravelZone.receiveShadow = true;
  root.add(gravelZone);

  // 越野泥地內圈與草地外圈過渡
  const grassZoneGeo = new THREE.RingGeometry(70, 96, 64);
  grassZoneGeo.rotateX(-Math.PI * 0.5);
  const grassZoneMat = new THREE.MeshStandardMaterial({
    map: textures.grass.map,
    normalMap: textures.grass.normalMap,
    roughness: 0.94
  });
  const grassZone = new THREE.Mesh(grassZoneGeo, grassZoneMat);
  grassZone.position.set(offroadCenter.x, 0.018, offroadCenter.z);
  root.add(grassZone);

  // 越野區緩坡土丘跳台
  addRamp(95, -25, 14, 16, 1.1, -0.14);
  addRamp(95, 25, 14, 16, 1.1, 0.14);

  // 測試場分區龍門架標示
  const mainGantry = buildGantryMesh(16, 'ARIAKE PROVING GROUND // SPEED & RAMP STRIP');
  mainGantry.position.set(0, 0, -15);
  root.add(mainGantry);

  const rallyGantry = buildGantryMesh(16, 'OFF-ROAD GRAVEL & MUD TEST ZONE');
  rallyGantry.position.set(95, 0, -68);
  root.add(rallyGantry);

  const driftGantry = buildGantryMesh(16, 'SKIDPAD // DRIFT ANGLE ARENA');
  driftGantry.position.set(-85, 0, -45);
  root.add(driftGantry);

  // 5. 高速外環測試道（Outer High-Speed Oval Checkpoints & Minimap Ring）
  const ovalPts = [];
  const ovalSamples = [];
  const ovalSegs = 120;
  for (let i = 0; i < ovalSegs; i++) {
    const ang = (i / ovalSegs) * Math.PI * 2;
    const ox = Math.sin(ang) * 185;
    const oz = Math.cos(ang) * 175;
    const pt = new THREE.Vector3(ox, 0, oz);
    const nextAng = ((i + 1) / ovalSegs) * Math.PI * 2;
    const tan = new THREE.Vector3(
      Math.sin(nextAng) * 185 - ox,
      0,
      Math.cos(nextAng) * 175 - oz
    ).normalize();
    ovalPts.push({ x: ox, z: oz });
    ovalSamples.push({ pt, tan });
  }

  // 外環道藍色導引標線
  const ovalRingGeo = new THREE.RingGeometry(176, 184, 96);
  ovalRingGeo.rotateX(-Math.PI * 0.5);
  const ovalRingMesh = new THREE.Mesh(ovalRingGeo, lineCyanMat);
  ovalRingMesh.position.y = 0.02;
  root.add(ovalRingMesh);

  // 景觀樹木點綴外圍
  const treeCoords = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    treeCoords.push({ x: Math.cos(a) * 235, y: 0, z: Math.sin(a) * 235, scale: 1.1 });
  }
  populateSceneryTrees(root, treeCoords);

  // 測試場路面材質動態判定（Skidpad 水泥、Off-Road 砂石/泥地/草地、路緣石、高速柏油）
  physicsWorld.surfaceResolver = (x, z, hitBody, defaultSurf) => {
    if (defaultSurf === 'curb') return 'curb';

    const dSkid = Math.hypot(x - skidCenter.x, z - skidCenter.z);
    if (dSkid < 7.2) return 'curb';
    if (dSkid <= 52.0) return 'skidpad';

    const dOffroad = Math.hypot(x - offroadCenter.x, z - offroadCenter.z);
    if (dOffroad <= 36.0) return 'dirt';
    if (dOffroad <= 72.0) return 'gravel';
    if (dOffroad <= 96.0) return 'grass';

    return 'asphalt';
  };

  // 建立 6 個綜合測試場環場檢查點供自由計時使用
  const checkpoints = [0, 1, 2, 3, 4, 5].map((idx) => {
    const s = ovalSamples[Math.floor((idx / 6) * ovalSegs)];
    return {
      index: idx,
      position: s.pt.clone(),
      tangent: s.tan.clone(),
      radius: 26.0,
      isSectorEnd: idx === 2 ? 1 : idx === 4 ? 2 : idx === 0 ? 3 : 0
    };
  });

  return {
    id: 'proving',
    name: 'ARIAKE PROVING GROUND',
    root,
    samples: ovalSamples,
    checkpoints,
    startPose: {
      position: new THREE.Vector3(0, 0.25, -32),
      yaw: 0
    },
    zones: {
      skidpad: { x: -85, z: 0, yaw: 0 },
      ramps: { x: 0, z: -20, yaw: 0 },
      offroad: { x: 95, z: -60, yaw: 0 },
      oval: { x: 0, z: -175, yaw: Math.PI * 0.5 }
    },
    getNearestResetPose(x, z) {
      // 若在三大測試區附近，重置回該區入口；否則重置回中央跑道
      if (Math.hypot(x - skidCenter.x, z - skidCenter.z) < 75) {
        return { position: new THREE.Vector3(-85, 0.35, -35), yaw: 0 };
      }
      if (Math.hypot(x - offroadCenter.x, z - offroadCenter.z) < 95) {
        return { position: new THREE.Vector3(95, 0.35, -55), yaw: 0 };
      }
      return {
        position: new THREE.Vector3(0, 0.35, -32),
        yaw: 0
      };
    },
    minimapPoints: ovalPts,
    destroy() {
      scene.remove(root);
      physicsWorld.clearTrackBodies();
    }
  };
}
