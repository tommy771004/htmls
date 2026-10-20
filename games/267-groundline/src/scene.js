// Groundline（267）Three.js 高細節等角停機坪 3D 場景、Blender glTF 解壓載入與深度立體互動

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GATES, STEPS, gateById } from './sim.js';

async function decodeEmbeddedGLB(name = 'groundline') {
  const el = document.getElementById('glb-' + name);
  if (!el) return null;
  const b64 = el.textContent.trim();
  if (!b64) return null;
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ab = await new Response(
    new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer();
  return await new GLTFLoader().parseAsync(ab, '');
}

function createApronTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const toU = (x) => ((x + 100) / 200) * canvas.width;
  const toV = (z) => ((z + 50) / 115) * canvas.height;

  // 1. 柔和草地底色與割草條紋
  ctx.fillStyle = '#cad8be';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(178, 198, 162, 0.42)';
  for (let i = 0; i < 24; i++) {
    ctx.fillRect(0, i * 44, canvas.width, 22);
  }

  // 2. 停機坪混凝土地面 (X: -86..+88, Z: -28..+16) 與輪胎磨損油漬細節
  ctx.fillStyle = '#e3ded4';
  ctx.fillRect(toU(-86), toV(-28), toU(88) - toU(-86), toV(16) - toV(-28));

  // 各停機位地面淡淡油漬與輪胎痕跡
  GATES.forEach((g) => {
    const grd = ctx.createRadialGradient(
      toU(g.x), toV(g.standZ), 4,
      toU(g.x), toV(g.standZ), 56
    );
    grd.addColorStop(0, 'rgba(90, 86, 78, 0.16)');
    grd.addColorStop(1, 'rgba(90, 86, 78, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(toU(g.x - 9), toV(g.standZ - 11), toU(g.x + 9) - toU(g.x - 9), toV(g.standZ + 11) - toV(g.standZ - 11));
  });

  // 混凝土分塊伸縮縫
  ctx.strokeStyle = 'rgba(150, 142, 128, 0.36)';
  ctx.lineWidth = 1.4;
  for (let x = -84; x <= 86; x += 4) {
    ctx.beginPath();
    ctx.moveTo(toU(x), toV(-28));
    ctx.lineTo(toU(x), toV(16));
    ctx.stroke();
  }
  for (let z = -26; z <= 16; z += 4) {
    ctx.beginPath();
    ctx.moveTo(toU(-86), toV(z));
    ctx.lineTo(toU(88), toV(z));
    ctx.stroke();
  }

  // 3. 主平行滑行道 TWY A (Z: 18.5..29.5) 與瀝青過渡帶
  ctx.fillStyle = '#3b414b';
  ctx.fillRect(toU(-92), toV(18.5), toU(92) - toU(-92), toV(29.5) - toV(18.5));
  ctx.fillStyle = '#464d57';
  ctx.fillRect(toU(-78), toV(14.5), toU(78) - toU(-78), toV(19.0) - toV(14.5));

  // 快速脫離滑行道
  const drawTurnoff = (x1, z1, x2, z2, w) => {
    ctx.save();
    ctx.strokeStyle = '#3b414b';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(toU(x1), toV(z1));
    ctx.lineTo(toU(x2), toV(z2));
    ctx.stroke();
    ctx.restore();
  };
  drawTurnoff(-60, 26, -44, 50, 74);
  drawTurnoff(0, 26, 14, 50, 68);
  drawTurnoff(76, 26, 82, 50, 74);

  // 4. 09L / 27R 主跑道 (Z: 42..58)
  ctx.fillStyle = '#31363f';
  ctx.fillRect(toU(-96), toV(42), toU(96) - toU(-96), toV(58) - toV(42));

  // 跑道接地帶黑膠輪胎擦痕 (Touchdown Skid Marks)
  ctx.fillStyle = 'rgba(20, 22, 26, 0.35)';
  for (let s of [-1, 1]) {
    ctx.fillRect(toU(s * 52 - 14), toV(45.5), 160, 18);
    ctx.fillRect(toU(s * 52 - 14), toV(51.5), 160, 18);
  }

  // 跑道白色邊線與中線虛線
  ctx.strokeStyle = '#f2efe8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(toU(-94), toV(43));
  ctx.lineTo(toU(94), toV(43));
  ctx.moveTo(toU(-94), toV(57));
  ctx.lineTo(toU(94), toV(57));
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([28, 22]);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(toU(-78), toV(50));
  ctx.lineTo(toU(78), toV(50));
  ctx.stroke();
  ctx.restore();

  // 跑道頭斑馬線與瞄準塊
  ctx.fillStyle = '#f2efe8';
  for (let side of [-1, 1]) {
    const bx = side * 88;
    for (let k = -5.5; k <= 5.5; k += 2.2) {
      ctx.fillRect(toU(bx - 3.5), toV(50 + k - 0.55), 36, 5);
    }
    ctx.fillRect(toU(side * 58 - 5), toV(45.2), 48, 12);
    ctx.fillRect(toU(side * 58 - 5), toV(52.8), 48, 12);
  }

  // 5. 地勤服務車道（Z = -18.2 雙白虛線車道 + 斑馬穿越線）
  ctx.save();
  ctx.fillStyle = '#d1ccc0';
  ctx.fillRect(toU(-82), toV(-20.2), toU(82) - toU(-82), toV(-16.2) - toV(-20.2));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(toU(-82), toV(-20.2));
  ctx.lineTo(toU(82), toV(-20.2));
  ctx.moveTo(toU(-82), toV(-16.2));
  ctx.lineTo(toU(82), toV(-16.2));
  ctx.stroke();
  ctx.restore();

  // 6. 滑行道與停機坪黃色標線（航空黃附黑邊襯底）
  const strokeYellow = (drawFn, width = 4.5) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#20242a';
    ctx.lineWidth = width + 3;
    drawFn();
    ctx.stroke();
    ctx.strokeStyle = '#f4c038';
    ctx.lineWidth = width;
    drawFn();
    ctx.stroke();
    ctx.restore();
  };

  strokeYellow(() => {
    ctx.beginPath();
    ctx.moveTo(toU(-88), toV(24));
    ctx.lineTo(toU(88), toV(24));
  }, 5);

  ctx.save();
  ctx.strokeStyle = '#e5b232';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(toU(-88), toV(19.3));
  ctx.lineTo(toU(88), toV(19.3));
  ctx.moveTo(toU(-88), toV(28.7));
  ctx.lineTo(toU(88), toV(28.7));
  ctx.stroke();
  ctx.restore();

  strokeYellow(() => {
    ctx.beginPath();
    ctx.moveTo(toU(-36), toV(50));
    ctx.quadraticCurveTo(toU(-46), toV(50), toU(-58), toV(24));
    ctx.moveTo(toU(22), toV(50));
    ctx.quadraticCurveTo(toU(12), toV(50), toU(0), toV(24));
    ctx.moveTo(toU(68), toV(24));
    ctx.quadraticCurveTo(toU(80), toV(24), toU(82), toV(50));
  }, 4.2);

  // 5 座登機門 (G1–G5) 機坪紅色警戒框、機型停止橫線、空橋輪跡圓弧與地面門號
  GATES.forEach((g) => {
    ctx.save();
    ctx.strokeStyle = '#d85648';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(
      toU(g.x - 9.2),
      toV(g.standZ - 11.5),
      toU(g.x + 9.2) - toU(g.x - 9.2),
      toV(g.standZ + 12.5) - toV(g.standZ - 11.5)
    );
    ctx.restore();

    // 空橋行走輪地面白色虛線圓弧區
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(toU(g.rotundaX), toV(g.rotundaZ), 88, 0.15 * Math.PI, 0.65 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // 從 TWY A 彎入登機門的黃色引導中心線
    strokeYellow(() => {
      ctx.beginPath();
      ctx.moveTo(toU(g.x - 10), toV(24));
      ctx.quadraticCurveTo(toU(g.x), toV(24), toU(g.x), toV(12));
      ctx.lineTo(toU(g.x), toV(g.standZ - 10.5));
    }, 4.5);

    // 鼻輪 T 字停止線 (A320 / B738 / A321 Stop Bars)
    strokeYellow(() => {
      ctx.beginPath();
      ctx.moveTo(toU(g.x - 2.6), toV(g.standZ - 9.8));
      ctx.lineTo(toU(g.x + 2.6), toV(g.standZ - 9.8));
      ctx.moveTo(toU(g.x - 1.9), toV(g.standZ - 8.2));
      ctx.lineTo(toU(g.x + 1.9), toV(g.standZ - 8.2));
      ctx.moveTo(toU(g.x - 1.6), toV(g.standZ - 6.8));
      ctx.lineTo(toU(g.x + 1.6), toV(g.standZ - 6.8));
    }, 3.4);

    // 地面黑底黃字登機門編號牌
    const bx = toU(g.x + 5.2);
    const by = toV(g.standZ - 10.6);
    ctx.fillStyle = '#1b222c';
    ctx.fillRect(bx - 22, by - 13, 44, 26);
    ctx.strokeStyle = '#f4c038';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 22, by - 13, 44, 26);
    ctx.fillStyle = '#f4c038';
    ctx.font = 'bold 17px "DIN Alternate", "Bahnschrift", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.id, bx, by + 1);
  });

  // 西側 GSE 車隊調度站與東側油槽灌裝車位標線
  ctx.strokeStyle = '#f4c038';
  ctx.lineWidth = 2;
  for (let vx of [-74, -69, -64]) {
    ctx.strokeRect(toU(vx - 1.8), toV(-16.2), 36, 38);
    ctx.strokeRect(toU(vx - 1.8), toV(-23.5), 36, 38);
  }
  for (let fx of [68, 73, 78]) {
    ctx.strokeRect(toU(fx - 1.8), toV(-15.8), 36, 42);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildFallbackTemplates() {
  const matBody = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.4, flatShading: true });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0x2d8a8a, roughness: 0.4, flatShading: true });
  const ac = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 24, 12), matBody);
  fus.rotation.x = Math.PI / 2;
  fus.position.y = 2.6;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(26, 0.35, 3.8), matBody);
  wing.position.set(0, 2.4, 1);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 3.2), matAccent);
  tail.position.set(0, 4.8, 10.2);
  ac.add(fus, wing, tail);

  const veh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 5.2), matAccent);
  veh.position.y = 0.9;
  const grp = new THREE.Group();
  grp.add(veh);

  return {
    Terminal: new THREE.Group(),
    TerminalRoof: new THREE.Group(),
    TowerRadar: new THREE.Group(),
    FuelTankFarm: new THREE.Group(),
    GSEDepot: new THREE.Group(),
    JetbridgeRotunda: new THREE.Group(),
    JetbridgeArm: new THREE.Group(),
    Aircraft_A320: ac,
    Aircraft_B738: ac.clone(),
    Aircraft_A321: ac.clone(),
    Aircraft_E190: ac.clone(),
    FuelTruck: grp,
    BaggageTug: grp.clone(),
    CateringTruck: grp.clone(),
    CleaningVan: grp.clone(),
    PushbackTug: grp.clone(),
  };
}

// 為每架飛機建立豐富的地勤作業與動態細節組件（輪擋、三角錐、GPU電源車、開啟艙門、動態行李輸送帶、加油管、渦扇葉片與航行燈）
function createAircraftDetailRig() {
  const rig = new THREE.Group();

  // 1. 左右引擎旋轉渦扇葉片盤 (Spinning Turbofan Blades at x = ±4.85, y = 1.42, z = -2.35)
  const fanGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.14, 12);
  fanGeo.rotateX(Math.PI / 2);
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x26303d, roughness: 0.3, metalness: 0.7 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd8e2ec, roughness: 0.2, metalness: 0.85 });
  const makeFan = (x) => {
    const fg = new THREE.Group();
    fg.position.set(x, 1.42, -2.36);
    fg.add(new THREE.Mesh(fanGeo, fanMat));
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.11, 0.04), bladeMat);
      bar.rotation.z = (i * Math.PI) / 6;
      bar.position.z = -0.05;
      fg.add(bar);
    }
    return fg;
  };
  const leftFan = makeFan(-4.85);
  const rightFan = makeFan(4.85);
  rig.add(leftFan, rightFan);

  // 2. 機背防撞紅閃燈光球與鼻輪滑行地面光束 (Anti-collision Beacon & Taxi Light Cone)
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const beaconBulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), beaconMat);
  beaconBulb.position.set(0, 4.78, -3.2);
  rig.add(beaconBulb);

  const beamGeo = new THREE.ConeGeometry(3.2, 11.5, 16, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff1b8,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const taxiBeam = new THREE.Mesh(beamGeo, beamMat);
  taxiBeam.position.set(0, 0.42, -15.2);
  rig.add(taxiBeam);

  // 3. 可開啟的客艙門與腹艙貨艙門 (Openable L1/R1 Cabin Doors & Lower Cargo Door)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ed, roughness: 0.3, metalness: 0.25 });
  const interiorMat = new THREE.MeshBasicMaterial({ color: 0xffe2a6 });
  const doorsGroup = new THREE.Group();
  // L1 登機門外翻開啟 + 暖光艙門內洞
  const l1Hole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.32, 0.92), interiorMat);
  l1Hole.position.set(-1.76, 2.9, -7.5);
  const l1Door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.32, 0.92), doorMat);
  l1Door.position.set(-2.02, 2.9, -8.15);
  l1Door.rotation.y = 0.35;
  // R1 餐車服務門與右前腹艙貨艙門
  const r1Hole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.32, 0.92), interiorMat);
  r1Hole.position.set(1.76, 2.9, -7.5);
  const r1Door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.32, 0.92), doorMat);
  r1Door.position.set(2.02, 2.9, -8.15);
  r1Door.rotation.y = -0.35;
  const cargoDoor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.85, 1.25), doorMat);
  cargoDoor.position.set(1.95, 2.15, -4.6);
  cargoDoor.rotation.z = -0.65;
  doorsGroup.add(l1Hole, l1Door, r1Hole, r1Door, cargoDoor);
  doorsGroup.visible = false;
  rig.add(doorsGroup);

  // 4. 停機坪地面安全三角錐、鼻輪輪擋與 GPU 地面電源車 (Safety Cones, Chocks & GPU Cart)
  const safetyGroup = new THREE.Group();
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5722, roughness: 0.4 });
  const coneBaseMat = new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.5 });
  const conePositions = [
    [-6.2, -3.2], [-3.6, -3.2], [6.2, -3.2], [3.6, -3.2],
    [-14.5, 3.6], [14.5, 3.6], [0, -14.2],
  ];
  for (const [cx, cz] of conePositions) {
    const cg = new THREE.Group();
    cg.position.set(cx, 0, cz);
    const cBody = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 8), coneMat);
    cBody.position.y = 0.31;
    const cStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.16, 8), coneBaseMat);
    cStripe.position.y = 0.32;
    cg.add(cBody, cStripe);
    safetyGroup.add(cg);
  }
  // 鼻輪黃色輪擋 + 右前側 GPU 地面電源車
  const chockMat = new THREE.MeshStandardMaterial({ color: 0xf4c038, roughness: 0.4 });
  const chock1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.22), chockMat);
  chock1.position.set(0, 0.09, -10.35);
  const chock2 = chock1.clone();
  chock2.position.set(0, 0.09, -9.25);
  const gpuBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.85), chockMat);
  gpuBody.position.set(2.85, 0.55, -10.8);
  gpuBody.castShadow = true;
  safetyGroup.add(chock1, chock2, gpuBody);
  safetyGroup.visible = false;
  rig.add(safetyGroup);

  // 5. 動態行李輸送帶車与滾動彩色行李箱 (Animated Baggage Belt Loader at Right Forward Cargo Hold)
  const beltGroup = new THREE.Group();
  beltGroup.position.set(3.45, 0, -4.6);
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.58, 1.35),
    new THREE.MeshStandardMaterial({ color: 0xf4c038, roughness: 0.42 })
  );
  chassis.position.set(0.6, 0.38, 0);
  chassis.castShadow = true;
  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.16, 0.92),
    new THREE.MeshStandardMaterial({ color: 0x2b333e, roughness: 0.6 })
  );
  ramp.position.set(-0.2, 1.25, 0);
  ramp.rotation.z = -0.42;
  ramp.castShadow = true;
  beltGroup.add(chassis, ramp);

  const bagColors = [0x437fc2, 0xde6552, 0x5ca379, 0xe8a331];
  const movingBags = [];
  for (let i = 0; i < 4; i++) {
    const bm = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.30, 0.38),
      new THREE.MeshStandardMaterial({ color: bagColors[i], roughness: 0.45 })
    );
    bm.castShadow = true;
    beltGroup.add(bm);
    movingBags.push(bm);
  }
  beltGroup.visible = false;
  rig.add(beltGroup);

  // 6. 翼下加油軟管與動態流動油料光球 (Refueling Hose & Flow Pulse during Step 3)
  const fuelGroup = new THREE.Group();
  const hoseCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(6.4, 1.2, -1.8),
    new THREE.Vector3(5.6, 0.25, 0.4),
    new THREE.Vector3(4.85, 1.85, 1.2)
  );
  const hoseGeo = new THREE.TubeGeometry(hoseCurve, 16, 0.08, 8, false);
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0xea7334, roughness: 0.4 });
  const hoseMesh = new THREE.Mesh(hoseGeo, hoseMat);
  const pulseSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc4d })
  );
  fuelGroup.add(hoseMesh, pulseSphere);
  fuelGroup.visible = false;
  rig.add(fuelGroup);

  return {
    rig,
    leftFan,
    rightFan,
    beaconBulb,
    taxiBeam,
    doorsGroup,
    safetyGroup,
    beltGroup,
    movingBags,
    fuelGroup,
    hoseCurve,
    pulseSphere,
  };
}

export async function createApronScene(canvas, world, callbacks = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdce6ee);
  scene.fog = new THREE.FogExp2(0xdce6ee, 0.0022);

  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 1.0, 520);
  camera.position.set(18, 86, 114);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(2, 0, -2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 22;
  controls.maxDistance = 240;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = Math.PI * 0.10;
  controls.update();

  // 光源系統（支援日景與夜航模式無縫切換）
  const hemi = new THREE.HemisphereLight(0xf6f9fc, 0xc8c2b4, 0.92);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff5e4, 1.65);
  sun.position.set(58, 92, 46);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -105;
  sun.shadow.camera.right = 105;
  sun.shadow.camera.top = 75;
  sun.shadow.camera.bottom = -65;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 230;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight(0x9ec2dc, 0.42);
  fillLight.position.set(-60, 45, -40);
  scene.add(fillLight);

  // 地面與黃色跑道／滑行道標線平面
  const groundGeo = new THREE.PlaneGeometry(200, 115);
  const groundMat = new THREE.MeshStandardMaterial({
    map: createApronTexture(),
    roughness: 0.85,
    metalness: 0.04,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 7.5);
  ground.receiveShadow = true;
  scene.add(ground);

  const outerGeo = new THREE.PlaneGeometry(520, 520);
  const outerMat = new THREE.MeshStandardMaterial({ color: 0xc5d4b8, roughness: 0.95 });
  const outerGround = new THREE.Mesh(outerGeo, outerMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.06;
  scene.add(outerGround);

  // 解壓並載入 Blender 生成的 groundline.glb
  const templates = buildFallbackTemplates();
  let glbLoaded = false;
  try {
    const gltf = await decodeEmbeddedGLB('groundline');
    if (gltf && gltf.scene) {
      glbLoaded = true;
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => {
            if (m) {
              m.side = THREE.DoubleSide;
              if ('flatShading' in m) m.flatShading = true;
              m.needsUpdate = true;
            }
          });
        }
      });
      for (const child of gltf.scene.children) {
        templates[child.name] = child;
      }
    }
  } catch (err) {
    console.warn('[Groundline] GLB fallback:', err);
  }

  const pickables = [];
  function registerPickable(rootObj, userData) {
    rootObj.traverse((o) => {
      if (o.isMesh) {
        o.userData = { ...userData };
        pickables.push(o);
      }
    });
  }

  // 1. 放置主航廈（Terminal）與可透視波浪屋頂（TerminalRoof）
  const terminalObj = templates.Terminal.clone(true);
  terminalObj.position.set(0, 0, -38);
  registerPickable(terminalObj, { pickType: 'terminal', label: '航廈候機大樓 · 點擊切換屋頂透視檢視內裝' });
  scene.add(terminalObj);

  const terminalRoofObj = (templates.TerminalRoof || new THREE.Group()).clone(true);
  terminalRoofObj.position.set(0, 0, -38);
  const roofMaterials = [];
  terminalRoofObj.traverse((o) => {
    if (o.isMesh) {
      const clonedMats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => {
        const cm = m.clone();
        cm.transparent = true;
        roofMaterials.push(cm);
        return cm;
      });
      o.material = Array.isArray(o.material) ? clonedMats : clonedMats[0];
    }
  });
  registerPickable(terminalRoofObj, { pickType: 'terminal', label: '弧形玻璃波浪屋頂 · 點擊切換航廈內裝透視' });
  scene.add(terminalRoofObj);

  // 航廈 2F 候機室動態行走旅客 (Animated Miniature Passengers inside Terminal Concourse)
  const paxGroup = new THREE.Group();
  paxGroup.position.set(0, 4.18, -38);
  const paxColors = [0x1e8288, 0xe05a47, 0x255bb5, 0xe8a331, 0x437fc2, 0x343d4b];
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf5d6ba, roughness: 0.5 });
  const paxAgents = [];
  for (let i = 0; i < 32; i++) {
    const pg = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.85, 6),
      new THREE.MeshStandardMaterial({ color: paxColors[i % paxColors.length], roughness: 0.5 })
    );
    body.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), headMat);
    head.position.y = 0.98;
    const suitcase = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.36, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x343d4b, roughness: 0.4 })
    );
    suitcase.position.set(0.26, 0.22, 0.12);
    pg.add(body, head, suitcase);
    paxGroup.add(pg);
    paxAgents.push({
      mesh: pg,
      baseX: -52 + (i / 31) * 104,
      laneZ: -4.5 + (i % 5) * 2.2,
      speed: (i % 2 === 0 ? 1 : -1) * (1.8 + (i % 4) * 0.45),
      phase: i * 0.7,
    });
  }
  scene.add(paxGroup);

  // 2. 航管塔台旋轉雷達（TowerRadar）與全場雷達掃描波環
  const towerRadarObj = (templates.TowerRadar || new THREE.Group()).clone(true);
  towerRadarObj.position.set(-54, 24.4, -42);
  registerPickable(towerRadarObj, { pickType: 'tower', label: '航管塔台雷達 · 點擊啟動雷達加速與切換日／夜航燈光' });
  scene.add(towerRadarObj);

  // 塔台柱身透明互動碰撞體（方便直接點擊塔台）
  const towerHitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 3.8, 22, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  towerHitMesh.position.set(-54, 16, -42);
  towerHitMesh.userData = { pickType: 'tower', label: '西側航管塔台 (ATC) · 點擊切換夜航燈光與雷達掃描' };
  pickables.push(towerHitMesh);
  scene.add(towerHitMesh);

  const radarSweepGeo = new THREE.RingGeometry(1.5, 3.2, 64);
  radarSweepGeo.rotateX(-Math.PI / 2);
  const radarSweepMat = new THREE.MeshBasicMaterial({
    color: 0x18b2a6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const radarSweepRing = new THREE.Mesh(radarSweepGeo, radarSweepMat);
  radarSweepRing.position.set(-54, 0.22, -42);
  scene.add(radarSweepRing);

  // 3. 放置東側航空油槽區 (FuelTankFarm) 與高壓供油脈衝環
  const fuelFarmObj = templates.FuelTankFarm.clone(true);
  fuelFarmObj.position.set(73, 0, -25);
  registerPickable(fuelFarmObj, { pickType: 'fuelfarm', label: '東側航空油槽區 (JET A-1) · 點擊啟動高壓增壓供油' });
  scene.add(fuelFarmObj);

  const fuelPulseGeo = new THREE.RingGeometry(11.5, 13.0, 48);
  fuelPulseGeo.rotateX(-Math.PI / 2);
  const fuelPulseMat = new THREE.MeshBasicMaterial({
    color: 0xea7334,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const fuelPulseRing = new THREE.Mesh(fuelPulseGeo, fuelPulseMat);
  fuelPulseRing.position.set(73, 0.18, -25);
  scene.add(fuelPulseRing);

  // 4. 放置西側地勤車維修調度棚廠 (GSEDepot)
  const depotObj = (templates.GSEDepot || new THREE.Group()).clone(true);
  depotObj.position.set(-69, 0, -25);
  registerPickable(depotObj, { pickType: 'depot', label: '西側地勤車調度棚廠 · 點擊自動增援待命車輛至選中航班' });
  scene.add(depotObj);

  // 5. 機坪高桿照明燈塔与跑道／滑行道嵌入式 LED 助航燈點 (Airfield Ground Lighting)
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x8b96a3, roughness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d1,
    emissive: new THREE.Color(0xffdfa0),
    emissiveIntensity: 1.6,
  });
  const apronSpotLights = [];
  for (let lx of [-60, -36, -12, 12, 36, 60]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 11, 6), mastMat);
    mast.position.set(lx, 5.5, -22.8);
    mast.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.7), lampMat);
    head.position.set(lx, 11.0, -22.4);
    scene.add(mast, head);
  }
  // 跑道與滑行道嵌入式夜航燈群（綠中心線燈、藍滑行道邊燈、跑道白邊燈）
  const aglGroup = new THREE.Group();
  const greenLedMat = new THREE.MeshBasicMaterial({ color: 0x28cd41 });
  const blueLedMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
  const whiteLedMat = new THREE.MeshBasicMaterial({ color: 0xfff7d6 });
  const ledGeo = new THREE.SphereGeometry(0.24, 6, 6);
  for (let x = -84; x <= 84; x += 8) {
    const gLed = new THREE.Mesh(ledGeo, greenLedMat);
    gLed.position.set(x, 0.12, 24);
    const bLed1 = new THREE.Mesh(ledGeo, blueLedMat);
    bLed1.position.set(x, 0.12, 19.3);
    const bLed2 = new THREE.Mesh(ledGeo, blueLedMat);
    bLed2.position.set(x, 0.12, 28.7);
    const rLed1 = new THREE.Mesh(ledGeo, whiteLedMat);
    rLed1.position.set(x, 0.12, 43);
    const rLed2 = new THREE.Mesh(ledGeo, whiteLedMat);
    rLed2.position.set(x, 0.12, 57);
    aglGroup.add(gLed, bLed1, bLed2, rLed1, rLed2);
  }
  GATES.forEach((g) => {
    for (let z = g.standZ - 8; z <= 20; z += 4.5) {
      const leadLed = new THREE.Mesh(ledGeo, greenLedMat);
      leadLed.position.set(g.x, 0.12, z);
      aglGroup.add(leadLed);
    }
  });
  scene.add(aglGroup);

  // 6. 5 座空橋（JetbridgeRotunda + JetbridgeArm）支援滑鼠點擊手動切換對接／伸縮
  const gateMeshes = {};
  const manualBridgeOverrides = {};
  GATES.forEach((g) => {
    const grp = new THREE.Group();
    grp.position.set(g.rotundaX, 0, g.rotundaZ);
    const rotunda = templates.JetbridgeRotunda.clone(true);
    const arm = templates.JetbridgeArm.clone(true);
    grp.add(rotunda, arm);
    registerPickable(grp, {
      pickType: 'gate',
      gateId: g.id,
      label: `${g.id} 透明空橋 · 點擊聚焦或切換空橋對接／艙門檢視`,
    });
    scene.add(grp);
    gateMeshes[g.id] = { group: grp, arm };
  });

  // 選中航班與選中地勤車的地面光環 + 滑鼠懸停光環
  const ringGeo = new THREE.RingGeometry(13.2, 14.6, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x1e6fd9,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const selectionRing = new THREE.Mesh(ringGeo, ringMat);
  selectionRing.position.y = 0.08;
  scene.add(selectionRing);

  const vehRingGeo = new THREE.RingGeometry(3.4, 4.2, 32);
  vehRingGeo.rotateX(-Math.PI / 2);
  const vehRingMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const vehicleRing = new THREE.Mesh(vehRingGeo, vehRingMat);
  vehicleRing.position.y = 0.10;
  vehicleRing.visible = false;
  scene.add(vehicleRing);

  const hoverRingGeo = new THREE.RingGeometry(4.8, 5.5, 36);
  hoverRingGeo.rotateX(-Math.PI / 2);
  const hoverRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const hoverRing = new THREE.Mesh(hoverRingGeo, hoverRingMat);
  hoverRing.position.y = 0.11;
  hoverRing.visible = false;
  scene.add(hoverRing);

  // 互動狀態（航廈透視、夜航模式、雷達掃描、油槽增壓、選中車輛、艙門手動檢視）
  const envState = {
    terminalCutaway: false,
    nightMode: false,
    radarBoostUntil: 0,
    fuelBoostUntil: 0,
    selectedVehicleId: null,
    inspectDoors: false,
  };

  // 建立航班 3D 實例池（附帶 createAircraftDetailRig）
  const flightActors = new Map();

  function ensureFlightActor(f) {
    if (flightActors.has(f.id)) return flightActors.get(f.id);
    const root = new THREE.Group();
    const tpl = templates[f.modelKey] || templates.Aircraft_A320;
    const mesh = tpl.clone(true);
    mesh.position.set(0, 0, 0);
    root.add(mesh);

    const detail = createAircraftDetailRig();
    root.add(detail.rig);

    const tug = templates.PushbackTug.clone(true);
    tug.position.set(0, 0, -14.2);
    tug.rotation.y = Math.PI;
    tug.visible = false;
    root.add(tug);

    registerPickable(root, {
      pickType: 'flight',
      flightId: f.id,
      label: `${f.callsign} (${f.acType}) · 點擊選取航班或派駐已選車輛`,
    });

    scene.add(root);
    const actor = { root, mesh, tug, detail };
    flightActors.set(f.id, actor);
    return actor;
  }

  // 建立地勤車 3D 實例池與路徑導引線
  const vehicleActors = new Map();
  const routeLineMat = new THREE.LineBasicMaterial({ color: 0xea7334, transparent: true, opacity: 0.78 });

  for (const v of world.vehicles) {
    const root = new THREE.Group();
    const tpl = templates[v.modelKey] || templates.FuelTruck;
    const mesh = tpl.clone(true);
    mesh.position.set(0, 0, 0);
    root.add(mesh);

    registerPickable(root, {
      pickType: 'vehicle',
      vehicleId: v.id,
      label: `${v.id} ${v.typeLabel} · 點擊選取車輛，再點飛機即可直接派車`,
    });

    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const routeLine = new THREE.Line(lineGeo, routeLineMat);
    routeLine.visible = false;
    scene.add(root, routeLine);
    vehicleActors.set(v.id, { root, mesh, routeLine });
  }

  // 滑鼠懸停與點擊 Raycasting
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos = { x: 0, y: 0 };

  function raycastEvent(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(pickables, false);
  }

  canvas.addEventListener('pointermove', (e) => {
    const hits = raycastEvent(e);
    if (hits.length > 0) {
      const hit = hits[0];
      const ud = hit.object.userData || {};
      canvas.style.cursor = 'pointer';
      hoverRing.visible = true;
      hoverRing.position.set(hit.point.x, 0.11, hit.point.z);
      if (callbacks.onHover3D) {
        callbacks.onHover3D({
          ...ud,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }
    } else {
      canvas.style.cursor = 'grab';
      hoverRing.visible = false;
      if (callbacks.onHover3D) callbacks.onHover3D(null);
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    downPos = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
    const hits = raycastEvent(e);
    if (hits.length === 0) {
      envState.selectedVehicleId = null;
      return;
    }
    const ud = hits[0].object.userData || {};
    if (ud.pickType === 'flight') {
      if (envState.selectedVehicleId && callbacks.onDirectDispatchVehicle) {
        callbacks.onDirectDispatchVehicle(envState.selectedVehicleId, ud.flightId);
        envState.selectedVehicleId = null;
      } else if (callbacks.onSelectFlight) {
        callbacks.onSelectFlight(ud.flightId);
      }
    } else if (ud.pickType === 'vehicle') {
      envState.selectedVehicleId =
        envState.selectedVehicleId === ud.vehicleId ? null : ud.vehicleId;
      if (callbacks.onSelectVehicle) callbacks.onSelectVehicle(ud.vehicleId, envState.selectedVehicleId);
    } else if (ud.pickType === 'gate') {
      toggleGateBridge(ud.gateId);
      if (callbacks.onInteractBuilding) callbacks.onInteractBuilding('gate', ud.gateId);
    } else if (ud.pickType === 'terminal') {
      toggleTerminalCutaway();
      if (callbacks.onInteractBuilding) callbacks.onInteractBuilding('terminal', envState.terminalCutaway);
    } else if (ud.pickType === 'tower') {
      triggerTowerAction();
      if (callbacks.onInteractBuilding) callbacks.onInteractBuilding('tower', envState.nightMode);
    } else if (ud.pickType === 'fuelfarm') {
      triggerFuelBoost();
      if (callbacks.onInteractBuilding) callbacks.onInteractBuilding('fuelfarm', true);
    } else if (ud.pickType === 'depot') {
      if (callbacks.onInteractBuilding) callbacks.onInteractBuilding('depot', true);
    }
  });

  // 互動控制函式
  function toggleTerminalCutaway(forceVal) {
    envState.terminalCutaway = typeof forceVal === 'boolean' ? forceVal : !envState.terminalCutaway;
    return envState.terminalCutaway;
  }

  function toggleNightMode(forceVal) {
    envState.nightMode = typeof forceVal === 'boolean' ? forceVal : !envState.nightMode;
    if (envState.nightMode) {
      scene.background.setHex(0x162232);
      scene.fog.color.setHex(0x162232);
      hemi.color.setHex(0x4a6b94);
      hemi.groundColor.setHex(0x1e2631);
      hemi.intensity = 0.55;
      sun.color.setHex(0x9ec5ff);
      sun.intensity = 0.68;
      outerMat.color.setHex(0x233028);
    } else {
      scene.background.setHex(0xdce6ee);
      scene.fog.color.setHex(0xdce6ee);
      hemi.color.setHex(0xf6f9fc);
      hemi.groundColor.setHex(0xc8c2b4);
      hemi.intensity = 0.92;
      sun.color.setHex(0xfff5e4);
      sun.intensity = 1.65;
      outerMat.color.setHex(0xc5d4b8);
    }
    return envState.nightMode;
  }

  function triggerTowerAction() {
    envState.radarBoostUntil = performance.now() + 14000;
    toggleNightMode();
  }

  function triggerFuelBoost() {
    envState.fuelBoostUntil = performance.now() + 12000;
    // 為所有加油車補充油量並加速當前加油步驟
    for (const v of world.vehicles) {
      if (v.type === 'fuel') v.fuelPct = 100;
    }
    for (const f of world.flights) {
      if (f.state === 'active' && f.stepIndex === 3 && f.steps[3]) {
        f.steps[3].progress = Math.min(1, f.steps[3].progress + 0.35);
      }
    }
  }

  function toggleGateBridge(gateId) {
    const cur = manualBridgeOverrides[gateId];
    if (cur === 'undocked') delete manualBridgeOverrides[gateId];
    else manualBridgeOverrides[gateId] = 'undocked';
    focusGate(gateId);
  }

  function toggleInspectDoors(forceVal) {
    envState.inspectDoors = typeof forceVal === 'boolean' ? forceVal : !envState.inspectDoors;
    return envState.inspectDoors;
  }

  // 鏡頭平滑移焦動畫
  let camAnim = null;
  function moveCameraTo(targetPos, camOffset, durationMs = 520) {
    camAnim = {
      t0: performance.now(),
      dur: durationMs,
      fromTarget: controls.target.clone(),
      toTarget: targetPos.clone(),
      fromPos: camera.position.clone(),
      toPos: targetPos.clone().add(camOffset),
    };
  }

  function focusGate(gateId) {
    const g = gateById(gateId);
    moveCameraTo(new THREE.Vector3(g.x, 1.8, g.standZ), new THREE.Vector3(14, 30, 38));
  }

  function focusFlight(flightId, closeup = false) {
    const f = world.flights.find((x) => x.id === flightId);
    if (!f) return;
    const offset = closeup ? new THREE.Vector3(11, 16, 22) : new THREE.Vector3(15, 32, 42);
    if (f.pose && f.pose.visible) {
      moveCameraTo(new THREE.Vector3(f.pose.x, 2.0, f.pose.z), offset);
    } else {
      focusGate(f.gateId);
    }
  }

  function setCameraPreset(preset) {
    if (preset === 'overview') {
      moveCameraTo(new THREE.Vector3(2, 0, -2), new THREE.Vector3(16, 86, 116));
    } else if (preset === 'terminal') {
      moveCameraTo(new THREE.Vector3(0, 3.5, -26), new THREE.Vector3(-14, 28, 38));
    } else if (preset === 'runway') {
      moveCameraTo(new THREE.Vector3(0, 1, 34), new THREE.Vector3(32, 54, 72));
    } else if (preset === 'fuelfarm') {
      moveCameraTo(new THREE.Vector3(70, 2.5, -22), new THREE.Vector3(-16, 24, 32));
    }
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);
  resize();

  function syncScene(nowMs) {
    if (camAnim) {
      const u = Math.min(1, (nowMs - camAnim.t0) / camAnim.dur);
      const ease = 1 - Math.pow(1 - u, 3);
      controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, ease);
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, ease);
      if (u >= 1) camAnim = null;
    }
    controls.update();

    const tSec = nowMs * 0.001;

    // 1. 航廈波浪屋頂透視動畫與 2F 候機大廳行走旅客動畫
    const targetRoofY = envState.terminalCutaway ? 4.2 : 0.0;
    const targetRoofAlpha = envState.terminalCutaway ? 0.16 : 1.0;
    terminalRoofObj.position.y += (targetRoofY - terminalRoofObj.position.y) * 0.14;
    for (const rm of roofMaterials) {
      rm.opacity += (targetRoofAlpha - rm.opacity) * 0.14;
      rm.depthWrite = rm.opacity > 0.85;
    }

    for (const pa of paxAgents) {
      const dx = Math.sin(tSec * 0.35 * pa.speed + pa.phase) * 9.5;
      const bob = Math.abs(Math.sin(tSec * 6.5 + pa.phase)) * 0.08;
      pa.mesh.position.set(pa.baseX + dx, bob, pa.laneZ);
      pa.mesh.rotation.y = Math.cos(tSec * 0.35 * pa.speed + pa.phase) * pa.speed > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    }

    // 2. 航管塔台雷達旋轉與全場雷達掃描波
    towerRadarObj.rotation.y = tSec * (nowMs < envState.radarBoostUntil ? 4.2 : 1.35);
    if (nowMs < envState.radarBoostUntil) {
      const wave = (tSec * 1.4) % 1;
      const scale = 1 + wave * 38;
      radarSweepRing.scale.set(scale, 1, scale);
      radarSweepMat.opacity = (1 - wave) * 0.55;
    } else {
      radarSweepMat.opacity = 0;
    }

    // 3. 油槽高壓供油脈衝環
    if (nowMs < envState.fuelBoostUntil) {
      const fw = (tSec * 1.8) % 1;
      const fs = 0.6 + fw * 1.6;
      fuelPulseRing.scale.set(fs, 1, fs);
      fuelPulseMat.opacity = (1 - fw) * 0.65;
    } else {
      fuelPulseMat.opacity = 0;
    }

    // 4. 更新 5 座空橋角度與伸縮
    GATES.forEach((g) => {
      const gm = gateMeshes[g.id];
      if (!gm) return;
      const activeF = world.flights.find((f) => f.gateId === g.id && f.state === 'active');
      const override = manualBridgeOverrides[g.id];
      const dockPct = override === 'undocked' ? 0 : activeF ? activeF.pose.jetbridgePct : 0;
      gm.arm.rotation.y = -0.34 + dockPct * 0.53;
      const ext = 0.68 + dockPct * 0.12;
      gm.arm.scale.set(1, 1, ext);
    });

    // 5. 更新所有飛機位置、旋轉渦扇葉片、閃光燈、開啟艙門、輪擋三角錐、動態行李輸送帶與加油管
    let selFlight = null;
    for (const f of world.flights) {
      const actor = ensureFlightActor(f);
      actor.root.visible = !!f.pose.visible;
      if (f.pose.visible) {
        actor.root.position.set(f.pose.x, 0, f.pose.z);
        actor.root.rotation.y = f.pose.yaw;
        actor.tug.visible = !!f.pose.pushbackTug;

        const d = actor.detail;
        const isParkedAtGate = f.state === 'active' && f.stepIndex >= 1 && f.stepIndex <= 4;
        const enginesRunning = !isParkedAtGate;

        // 渦扇葉片高速旋轉（滑行／進站／推出時高速轉動，停靠時慢速風轉）
        const spinRate = enginesRunning ? 18.0 : 1.5;
        d.leftFan.rotation.z = tSec * spinRate;
        d.rightFan.rotation.z = -tSec * spinRate;

        // 機背紅閃防撞燈與滑行頭燈光束
        const blink = Math.sin(tSec * 9.0 + f.sta) > 0.35;
        d.beaconBulb.visible = blink;
        d.taxiBeam.visible = enginesRunning || envState.nightMode;

        // 停靠登機門時展開地面安全三角錐、鼻輪輪擋與 GPU 電源車，並開啟客艙門／貨艙門
        d.safetyGroup.visible = isParkedAtGate;
        d.doorsGroup.visible = isParkedAtGate || (envState.inspectDoors && f.id === world.selectedFlightId);

        // 下客 (Step 1) 或 登機 (Step 4) 或 檢視模式時：顯示右前腹艙行李輸送帶車與滾動行李箱
        const showBelt =
          (f.state === 'active' && (f.stepIndex === 1 || f.stepIndex === 4)) ||
          (envState.inspectDoors && f.id === world.selectedFlightId);
        d.beltGroup.visible = showBelt;
        if (showBelt) {
          const dir = f.stepIndex === 1 ? 1 : -1; // 下客向外卸載，登機向內裝載
          d.movingBags.forEach((bag, idx) => {
            const u = ((tSec * 0.55 * dir + idx * 0.25) % 1 + 1) % 1;
            // 沿斜坡從機腹貨艙 (-1.6, 1.9) 移動至輸送車底端 (1.2, 0.72)
            bag.position.set(-1.55 + u * 2.75, 1.88 - u * 1.15, 0);
            bag.rotation.z = -0.42;
          });
        }

        // 加油 (Step 3) 時：顯示橘紅輸油軟管與流動光球
        const showFuelHose = f.state === 'active' && f.stepIndex === 3;
        d.fuelGroup.visible = showFuelHose;
        if (showFuelHose) {
          const u = (tSec * 1.25) % 1;
          d.hoseCurve.getPoint(u, d.pulseSphere.position);
        }
      }
      if (f.id === world.selectedFlightId) {
        selFlight = f;
      }
    }

    // 更新選中航班光環位置
    if (selFlight) {
      const gx = selFlight.pose.visible ? selFlight.pose.x : gateById(selFlight.gateId).x;
      const gz = selFlight.pose.visible ? selFlight.pose.z : gateById(selFlight.gateId).standZ;
      selectionRing.visible = true;
      selectionRing.position.set(gx, 0.08, gz);
      const isDelayed = selFlight.etd - selFlight.std > 3 || selFlight.cascadeDelay > 0;
      ringMat.color.setHex(isDelayed ? 0xe0634e : 0x1e6fd9);
      const pulse = 1 + Math.sin(nowMs * 0.005) * 0.035;
      selectionRing.scale.set(pulse, 1, pulse);
    } else {
      selectionRing.visible = false;
    }

    // 6. 更新所有地勤車輛位置、選中車輛光環與路徑線
    let selVehObj = null;
    for (const v of world.vehicles) {
      const va = vehicleActors.get(v.id);
      if (!va) continue;
      va.root.position.set(v.x, 0, v.z);
      va.root.rotation.y = v.yaw;
      if (v.id === envState.selectedVehicleId) {
        selVehObj = v;
      }

      if (v.waypoints && v.waypoints.length > 0) {
        const pts = [new THREE.Vector3(v.x, 0.14, v.z)];
        for (const wp of v.waypoints) {
          pts.push(new THREE.Vector3(wp.x, 0.14, wp.z));
        }
        va.routeLine.geometry.setFromPoints(pts);
        va.routeLine.visible = true;
      } else {
        va.routeLine.visible = false;
      }
    }

    if (selVehObj) {
      vehicleRing.visible = true;
      vehicleRing.position.set(selVehObj.x, 0.10, selVehObj.z);
      const vp = 1 + Math.sin(nowMs * 0.008) * 0.08;
      vehicleRing.scale.set(vp, 1, vp);
    } else {
      vehicleRing.visible = false;
    }

    renderer.render(scene, camera);
  }

  const projVec = new THREE.Vector3();
  function projectToScreen(x, y, z) {
    projVec.set(x, y, z);
    projVec.project(camera);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    return {
      x: (projVec.x * 0.5 + 0.5) * w,
      y: (-projVec.y * 0.5 + 0.5) * h,
      visible: projVec.z >= -1 && projVec.z <= 1,
    };
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    glbLoaded,
    loadedAssets: Object.keys(templates),
    envState,
    syncScene,
    focusGate,
    focusFlight,
    setCameraPreset,
    toggleTerminalCutaway,
    toggleNightMode,
    triggerTowerAction,
    triggerFuelBoost,
    toggleInspectDoors,
    projectToScreen,
    resize,
  };
}
