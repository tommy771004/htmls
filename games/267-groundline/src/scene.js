// Groundline（267）Three.js 等角停機坪 3D 場景、Blender glTF 解壓載入與動態視覺化

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

  // 世界範圍對應：X ∈ [-100, +100] -> u ∈ [0, 2048]；Z ∈ [-50, +65] -> v ∈ [0, 1024]
  const toU = (x) => ((x + 100) / 200) * canvas.width;
  const toV = (z) => ((z + 50) / 115) * canvas.height;

  // 1. 柔和草地底色
  ctx.fillStyle = '#cad8be';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 草地柔和條紋細節
  ctx.fillStyle = 'rgba(182, 201, 166, 0.38)';
  for (let i = 0; i < 20; i++) {
    ctx.fillRect(0, i * 52, canvas.width, 26);
  }

  // 2. 停機坪混凝土地面 (X: -86..+88, Z: -28..+16)
  ctx.fillStyle = '#e3ded4';
  ctx.fillRect(toU(-86), toV(-28), toU(88) - toU(-86), toV(16) - toV(-28));

  // 混凝土分塊伸縮縫
  ctx.strokeStyle = 'rgba(160, 152, 138, 0.35)';
  ctx.lineWidth = 1.5;
  for (let x = -84; x <= 86; x += 6) {
    ctx.beginPath();
    ctx.moveTo(toU(x), toV(-28));
    ctx.lineTo(toU(x), toV(16));
    ctx.stroke();
  }
  for (let z = -26; z <= 16; z += 6) {
    ctx.beginPath();
    ctx.moveTo(toU(-86), toV(z));
    ctx.lineTo(toU(88), toV(z));
    ctx.stroke();
  }

  // 3. 主平行滑行道 TWY A (Z: 19..29) 與快速脫離滑行道
  ctx.fillStyle = '#3d434d';
  ctx.fillRect(toU(-92), toV(18.5), toU(92) - toU(-92), toV(29.5) - toV(18.5));

  // 連接各登機門與滑行道的瀝青過渡帶
  ctx.fillStyle = '#474e58';
  ctx.fillRect(toU(-78), toV(14.5), toU(78) - toU(-78), toV(19.0) - toV(14.5));

  // 快速脫離滑行道與跑道頭聯絡道 (West E1, Center E2, East E3)
  const drawTurnoff = (x1, z1, x2, z2, w) => {
    ctx.save();
    ctx.strokeStyle = '#3d434d';
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
  ctx.fillStyle = '#343942';
  ctx.fillRect(toU(-96), toV(42), toU(96) - toU(-96), toV(58) - toV(42));

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

  // 跑道頭斑馬線 (Piano keys) 與跑道編號
  ctx.fillStyle = '#f2efe8';
  for (let side of [-1, 1]) {
    const bx = side * 88;
    for (let k = -5.5; k <= 5.5; k += 2.2) {
      ctx.fillRect(toU(bx - 3.5), toV(50 + k - 0.55), 36, 5);
    }
    // 瞄準點塊 (Aiming point)
    ctx.fillRect(toU(side * 58 - 5), toV(45.2), 48, 12);
    ctx.fillRect(toU(side * 58 - 5), toV(52.8), 48, 12);
  }

  // 5. 地勤服務車道（白色雙虛線車道 Z = -18.2）
  ctx.save();
  ctx.fillStyle = '#d4cfc4';
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

  // 6. 滑行道與停機坪黃色標線（航空黃 #f3be36 附黑邊襯底）
  const strokeYellow = (drawFn, width = 4.5) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#22262c';
    ctx.lineWidth = width + 3;
    drawFn();
    ctx.stroke();
    ctx.strokeStyle = '#f4c038';
    ctx.lineWidth = width;
    drawFn();
    ctx.stroke();
    ctx.restore();
  };

  // TWY A 主黃色中心線與雙黃邊線
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

  // 快速脫離滑行道黃色導引曲線
  strokeYellow(() => {
    ctx.beginPath();
    ctx.moveTo(toU(-36), toV(50));
    ctx.quadraticCurveTo(toU(-46), toV(50), toU(-58), toV(24));
    ctx.moveTo(toU(22), toV(50));
    ctx.quadraticCurveTo(toU(12), toV(50), toU(0), toV(24));
    ctx.moveTo(toU(68), toV(24));
    ctx.quadraticCurveTo(toU(80), toV(24), toU(82), toV(50));
  }, 4.2);

  // 5 座登機門 (G1–G5) 機坪紅色警戒框、引導黃線、停止線與地面門號標記
  GATES.forEach((g) => {
    // 紅色斜紋機坪安全警戒區 (ERA Box)
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

    // 從 TWY A 彎入登機門的黃色引導中心線 (Lead-in line)
    strokeYellow(() => {
      ctx.beginPath();
      ctx.moveTo(toU(g.x - 10), toV(24));
      ctx.quadraticCurveTo(toU(g.x), toV(24), toU(g.x), toV(12));
      ctx.lineTo(toU(g.x), toV(g.standZ - 10.5));
    }, 4.5);

    // 鼻輪 T 字停止線 (Stop Bar)
    strokeYellow(() => {
      ctx.beginPath();
      ctx.moveTo(toU(g.x - 2.6), toV(g.standZ - 9.8));
      ctx.lineTo(toU(g.x + 2.6), toV(g.standZ - 9.8));
      ctx.moveTo(toU(g.x - 1.8), toV(g.standZ - 7.8));
      ctx.lineTo(toU(g.x + 1.8), toV(g.standZ - 7.8));
    }, 3.5);

    // 地面黑底黃字登機門編號牌 (G1..G5)
    const bx = toU(g.x + 5.2);
    const by = toV(g.standZ - 10.6);
    ctx.fillStyle = '#20252b';
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
  // 若未嵌入 GLB 時的極簡低多邊形備援模板
  const matBody = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.4, flatShading: true });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0x2d8a8a, roughness: 0.4, flatShading: true });
  const ac = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 24, 10), matBody);
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
    FuelTankFarm: new THREE.Group(),
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
  scene.fog = new THREE.FogExp2(0xdce6ee, 0.0024);

  // 等角透視相機（低 FOV 呈現建築模型等角感，支援自由旋轉縮放）
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 1.0, 520);
  camera.position.set(18, 86, 114);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(2, 0, -2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 28;
  controls.maxDistance = 240;
  controls.maxPolarAngle = Math.PI * 0.45;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.update();

  // 柔和晨間日光與天空半球光
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
    roughness: 0.86,
    metalness: 0.04,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 7.5);
  ground.receiveShadow = true;
  scene.add(ground);

  // 外圍柔和草地延伸基底
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

  // 放置主航廈（含弧形玻璃屋頂與塔台）
  const terminalObj = templates.Terminal.clone(true);
  terminalObj.position.set(0, 0, -38);
  scene.add(terminalObj);

  // 放置東側航空油槽區 (Fuel Tank Farm)
  const fuelFarmObj = templates.FuelTankFarm.clone(true);
  fuelFarmObj.position.set(73, 0, -25);
  scene.add(fuelFarmObj);

  // 西側地勤車調度站簡易遮棚與地坪裝飾
  const depotGroup = new THREE.Group();
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x618ea6, roughness: 0.35, flatShading: true });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xece7df, roughness: 0.6, flatShading: true });
  const depotRoof = new THREE.Mesh(new THREE.BoxGeometry(18, 0.45, 5.5), canopyMat);
  depotRoof.position.set(-69, 3.8, -24.5);
  depotRoof.castShadow = true;
  depotGroup.add(depotRoof);
  for (let px of [-76, -69, -62]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.8, 8), pillarMat);
    p.position.set(px, 1.9, -24.5);
    depotGroup.add(p);
  }
  scene.add(depotGroup);

  // 機坪高桿照明燈塔 (Apron Floodlights)
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x8b96a3, roughness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d1,
    emissive: new THREE.Color(0xffdfa0),
    emissiveIntensity: 1.5,
  });
  for (let lx of [-60, -36, -12, 12, 36, 60]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 11, 6), mastMat);
    mast.position.set(lx, 5.5, -22.8);
    mast.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.7), lampMat);
    head.position.set(lx, 11.0, -22.4);
    scene.add(mast, head);
  }

  // 5 座空橋（JetbridgeRotunda 固定塔座 + JetbridgeArm 可旋轉伸縮橋臂）
  const gateMeshes = {};
  GATES.forEach((g) => {
    const grp = new THREE.Group();
    grp.position.set(g.rotundaX, 0, g.rotundaZ);
    const rotunda = templates.JetbridgeRotunda.clone(true);
    rotunda.position.set(0, 0, 0);
    const arm = templates.JetbridgeArm.clone(true);
    arm.position.set(0, 0, 0);
    grp.add(rotunda, arm);
    grp.userData = { pickType: 'gate', gateId: g.id };
    scene.add(grp);
    gateMeshes[g.id] = { group: grp, arm };
  });

  // 選中航班的地面光環
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

  // 建立航班 3D 實例池
  const flightActors = new Map();
  const pickables = [];

  function ensureFlightActor(f) {
    if (flightActors.has(f.id)) return flightActors.get(f.id);
    const root = new THREE.Group();
    const tpl = templates[f.modelKey] || templates.Aircraft_A320;
    const mesh = tpl.clone(true);
    mesh.position.set(0, 0, 0);
    root.add(mesh);

    // 附屬後推車（僅於 Step 5 推出時顯示在鼻輪前方）
    const tug = templates.PushbackTug.clone(true);
    tug.position.set(0, 0, -14.2);
    tug.rotation.y = Math.PI; // 面向機鼻連接
    tug.visible = false;
    root.add(tug);

    root.traverse((o) => {
      if (o.isMesh) {
        o.userData = { pickType: 'flight', flightId: f.id };
        pickables.push(o);
      }
    });

    scene.add(root);
    const actor = { root, mesh, tug };
    flightActors.set(f.id, actor);
    return actor;
  }

  // 建立地勤車 3D 實例池與路徑導引虛線
  const vehicleActors = new Map();
  const routeLineMat = new THREE.LineBasicMaterial({ color: 0xe6783a, transparent: true, opacity: 0.65 });

  for (const v of world.vehicles) {
    const root = new THREE.Group();
    const tpl = templates[v.modelKey] || templates.FuelTruck;
    const mesh = tpl.clone(true);
    mesh.position.set(0, 0, 0);
    root.add(mesh);

    root.traverse((o) => {
      if (o.isMesh) {
        o.userData = { pickType: 'vehicle', vehicleId: v.id };
        pickables.push(o);
      }
    });

    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const routeLine = new THREE.Line(lineGeo, routeLineMat);
    routeLine.visible = false;
    scene.add(root, routeLine);
    vehicleActors.set(v.id, { root, mesh, routeLine });
  }

  // 滑鼠點擊 Raycasting 選取飛機或車輛
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos = { x: 0, y: 0 };

  canvas.addEventListener('pointerdown', (e) => {
    downPos = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    if (hits.length > 0) {
      const ud = hits[0].object.userData || {};
      if (ud.pickType === 'flight' && callbacks.onSelectFlight) {
        callbacks.onSelectFlight(ud.flightId);
      } else if (ud.pickType === 'vehicle' && callbacks.onSelectVehicle) {
        callbacks.onSelectVehicle(ud.vehicleId);
      }
    }
  });

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
    moveCameraTo(new THREE.Vector3(g.x, 1.5, g.standZ), new THREE.Vector3(16, 38, 46));
  }

  function focusFlight(flightId) {
    const f = world.flights.find((x) => x.id === flightId);
    if (!f) return;
    if (f.pose && f.pose.visible) {
      moveCameraTo(new THREE.Vector3(f.pose.x, 1.5, f.pose.z), new THREE.Vector3(16, 38, 46));
    } else {
      focusGate(f.gateId);
    }
  }

  function setCameraPreset(preset) {
    if (preset === 'overview') {
      moveCameraTo(new THREE.Vector3(2, 0, -2), new THREE.Vector3(16, 86, 116));
    } else if (preset === 'terminal') {
      moveCameraTo(new THREE.Vector3(0, 3, -12), new THREE.Vector3(-18, 36, 48));
    } else if (preset === 'runway') {
      moveCameraTo(new THREE.Vector3(0, 1, 34), new THREE.Vector3(32, 54, 72));
    } else if (preset === 'fuelfarm') {
      moveCameraTo(new THREE.Vector3(64, 2, -16), new THREE.Vector3(-18, 32, 42));
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

    // 1. 更新 5 座空橋角度與伸縮（對接停靠中的飛機 L1 艙門）
    GATES.forEach((g) => {
      const gm = gateMeshes[g.id];
      if (!gm) return;
      const activeF = world.flights.find((f) => f.gateId === g.id && f.state === 'active');
      const dockPct = activeF ? activeF.pose.jetbridgePct : 0;
      // 未對接時收攏於 -0.34 rad、縮短 0.68；對接時轉至 +0.19 rad、伸長 0.78
      gm.arm.rotation.y = -0.34 + dockPct * 0.53;
      const ext = 0.68 + dockPct * 0.12;
      gm.arm.scale.set(1, 1, ext);
    });

    // 2. 更新所有飛機位置與狀態
    let selFlight = null;
    for (const f of world.flights) {
      const actor = ensureFlightActor(f);
      actor.root.visible = !!f.pose.visible;
      if (f.pose.visible) {
        actor.root.position.set(f.pose.x, 0, f.pose.z);
        actor.root.rotation.y = f.pose.yaw;
        actor.tug.visible = !!f.pose.pushbackTug;
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
      const isDelayed = (selFlight.etd - selFlight.std) > 3 || selFlight.cascadeDelay > 0;
      ringMat.color.setHex(isDelayed ? 0xe0634e : 0x1e6fd9);
      const pulse = 1 + Math.sin(nowMs * 0.005) * 0.035;
      selectionRing.scale.set(pulse, 1, pulse);
    } else {
      selectionRing.visible = false;
    }

    // 3. 更新所有地勤車輛位置與路徑線
    for (const v of world.vehicles) {
      const va = vehicleActors.get(v.id);
      if (!va) continue;
      va.root.position.set(v.x, 0, v.z);
      va.root.rotation.y = v.yaw;

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

    renderer.render(scene, camera);
  }

  // 計算 3D 座標投影至螢幕像素（供機坪上的航班浮動標籤定位）
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
    syncScene,
    focusGate,
    focusFlight,
    setCameraPreset,
    projectToScreen,
    resize,
  };
}
