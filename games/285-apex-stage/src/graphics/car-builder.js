// 高精細程序化 3D 車輛建模器（嚴禁方塊玩具感）
// 使用多截面樣條曲面（Lofted Cross-Section Surface）、輪拱外擴、引擎蓋折線、進氣壩、後擴散器、
// 獨立尾翼（GT 尾翼 / 拉力雙層尾翼 / 鴨尾）、透明車窗與內裝防滾籠、頭尾燈、排氣管火焰，
// 以及獨立轉向卡鉗 + 煞車碟盤 + 輪圈輻條 + 立體胎紋輪胎。

import * as THREE from 'three';

/**
 * 平滑 Hermite 步階
 */
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 生成車門賽車號碼牌貼圖
 */
function createDecalTexture(numberStr, brandStr, accentHex) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);

  // 斜切賽車號碼框
  ctx.save();
  ctx.transform(1, 0, -0.18, 1, 24, 12);
  ctx.fillStyle = 'rgba(12, 14, 18, 0.9)';
  ctx.fillRect(10, 8, 190, 96);
  ctx.lineWidth = 4;
  ctx.strokeStyle = accentHex || '#ff4800';
  ctx.strokeRect(10, 8, 190, 96);

  ctx.fillStyle = accentHex || '#ff4800';
  ctx.fillRect(10, 8, 190, 22);
  ctx.fillStyle = '#0b0d10';
  ctx.font = 'italic 900 13px "DIN Condensed", Impact, sans-serif';
  ctx.fillText((brandStr || 'APEX STAGE').slice(0, 18), 20, 24);

  ctx.fillStyle = '#f5f7fa';
  ctx.font = 'italic 900 64px "DIN Condensed", Impact, sans-serif';
  ctx.fillText(String(numberStr || '98'), 48, 88);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 使用多截面 Lofting 建立平滑流線型車殼幾何（含輪拱開孔、輪拱寬體暴龜、引擎蓋折線與腰線）
 */
function buildLoftedCarShellGeometry(spec) {
  const v = spec.visual;
  const p = spec.physics;
  const L = v.length;
  const W = v.width;
  const H = v.cabinHeight;
  const halfWB = p.wheelbase * 0.5;
  const style = v.bodyStyle; // 'hatch' | 'coupe' | 'rally' | 'supercar' | 'proto'

  const zSteps = 44;
  const uSteps = 28; // 從底盤中線 -> 外側底裙 -> 輪拱外擴 -> 腰線肩部 -> 引擎蓋折線 -> 中線

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // 定義縱向輪廓函數 (s in [-1, 1], -1 = 車尾, +1 = 車頭)
  function evalProfile(s) {
    const z = s * (L * 0.5);

    // 前後輪拱距離權重
    const dFront = Math.abs(z - halfWB) / (v.wheelRadius * 1.38);
    const dRear = Math.abs(z + halfWB) / (v.wheelRadius * 1.42);
    const archCutFront = dFront < 1.0 ? Math.sqrt(Math.max(0, 1 - dFront * dFront)) : 0;
    const archCutRear = dRear < 1.0 ? Math.sqrt(Math.max(0, 1 - dRear * dRear)) : 0;
    const archCut = Math.max(archCutFront, archCutRear);

    // 輪拱寬體外擴（Fender Flare）
    const flareStrength = style === 'rally' ? 0.085 : style === 'proto' ? 0.075 : style === 'supercar' ? 0.068 : 0.048;
    const archFlareFront = Math.exp(-Math.pow((z - halfWB) / (v.wheelRadius * 1.45), 2));
    const archFlareRear = Math.exp(-Math.pow((z + halfWB) / (v.wheelRadius * 1.55), 2));
    const flare = Math.max(archFlareFront, archFlareRear) * flareStrength;

    // 車頭與車尾平面收束
    let planTaper = 1.0;
    if (s > 0.65) {
      const t = (s - 0.65) / 0.35;
      planTaper = 1.0 - 0.24 * (t * t);
    } else if (s < -0.68) {
      const t = (-0.68 - s) / 0.32;
      planTaper = 1.0 - 0.16 * (t * t);
    }
    // 中段可樂瓶腰身內收（超跑與原型車特別明顯）
    const waistPinch = (style === 'supercar' || style === 'proto')
      ? -0.032 * Math.exp(-Math.pow(s / 0.35, 2))
      : 0;

    const halfWidth = (W * 0.5) * planTaper + flare + waistPinch;

    // 底部離地高度（含前下巴、側裙、後擴散器上揚與輪拱切口）
    let yBottom = 0.13;
    if (s < -0.72) {
      yBottom += ((-0.72 - s) / 0.28) * 0.12; // 後擴散器上揚
    } else if (s > 0.78) {
      yBottom += ((s - 0.78) / 0.22) * 0.03;
    }
    const yArchBottom = yBottom + archCut * (v.wheelRadius * 0.76);

    // 肩線（Beltline）高度：確保輪拱上方葉子板完整包覆輪胎頂緣
    let yBelt = H * 0.60;
    if (style === 'proto') {
      yBelt = H * 0.56 - Math.max(0, s) * 0.08 + archCut * 0.14;
    } else if (style === 'supercar') {
      yBelt = H * 0.58 - Math.max(0, s - 0.1) * 0.10 + archCut * 0.12;
    } else {
      yBelt = H * 0.60 - Math.max(0, s - 0.15) * 0.10 + archCut * 0.08;
    }
    if (s > 0.78) {
      yBelt -= ((s - 0.78) / 0.22) * 0.12; // 車頭鼻錐下掠
    }

    // 中線高度（車頂 / 前後擋風玻璃 / 引擎蓋 / 後廂蓋）
    let yCenter = yBelt + 0.05;
    let cabinFactor = 0;

    if (style === 'hatch' || style === 'rally') {
      // 掀背 / 拉力車：車艙一路延伸至車尾斜背
      const frontWindshield = smoothstep(0.32, 0.02, s);
      const rearHatch = smoothstep(-0.92, -0.52, s);
      cabinFactor = frontWindshield * rearHatch;
      const hoodSlope = s > 0.32 ? 1 - (s - 0.32) / 0.68 : 1;
      const hoodH = yBelt * (0.82 + 0.22 * hoodSlope);
      yCenter = hoodH + cabinFactor * (H - hoodH);
    } else if (style === 'coupe') {
      // 雙門跑車：流暢斜背 Fastback
      const frontWindshield = smoothstep(0.28, -0.02, s);
      const rearGlass = smoothstep(-0.72, -0.28, s);
      cabinFactor = frontWindshield * rearGlass;
      const deckH = s > 0 ? yBelt * (0.98 - Math.max(0, s - 0.25) * 0.25) : yBelt * 1.04;
      yCenter = deckH + cabinFactor * (H - deckH);
    } else if (style === 'supercar') {
      // 中置超跑：低扁前鼻、前移座艙、長斜背引擎蓋
      const frontWindshield = smoothstep(0.38, 0.06, s);
      const rearLouvers = smoothstep(-0.78, -0.18, s);
      cabinFactor = frontWindshield * rearLouvers;
      const noseH = s > 0.35 ? yBelt * (0.94 - (s - 0.35) * 0.34) : yBelt * 1.02;
      yCenter = noseH + cabinFactor * (H - noseH);
    } else {
      // Le Mans 原型車：水滴形座艙罩 + 隆起前後輪拱葉子板
      const frontCanopy = smoothstep(0.42, 0.08, s);
      const rearCanopy = smoothstep(-0.68, -0.12, s);
      cabinFactor = frontCanopy * rearCanopy;
      const deckH = yBelt * (0.90 - Math.max(0, s - 0.3) * 0.30);
      yCenter = deckH + cabinFactor * (H - deckH);
    }

    return {
      z,
      s,
      halfWidth,
      yBottom,
      yArchBottom,
      yBelt,
      yCenter,
      cabinFactor,
      archCut,
      flare
    };
  }

  // 對每一截面生成對稱的左右環狀頂點 (t in [0, 1] 從右側底盤繞過車頂到左側底盤)
  for (let iz = 0; iz <= zSteps; iz++) {
    const s = -1 + (2 * iz) / zSteps;
    const prof = evalProfile(s);

    // 頭尾端點極小收斂但保持平滑過渡
    const endCap = 1.0 - Math.pow(Math.abs(s), 18) * 0.85;

    for (let iu = 0; iu <= uSteps; iu++) {
      // u in [-1, 1] (-1 = 右側底部, 0 = 車頂/引擎蓋中線, +1 = 左側底部)
      const u = -1 + (2 * iu) / uSteps;
      const absU = Math.abs(u);
      const sign = u < 0 ? -1 : 1;

      let x = 0;
      let y = 0;

      if (absU > 0.72) {
        // 下半部：底裙 -> 輪拱外唇 -> 腰線最寬處
        const k = (1.0 - absU) / 0.28; // 0 at bottom rim, 1 at beltline
        const archBlend = Math.sin(k * Math.PI);
        x = sign * prof.halfWidth * (0.86 + 0.14 * Math.sin(k * Math.PI * 0.5) + archBlend * 0.03);
        y = prof.yArchBottom + k * (prof.yBelt - prof.yArchBottom);
      } else if (absU > 0.36) {
        // 肩部：腰線 -> 引擎蓋外折線 / 車窗下緣
        const k = (0.72 - absU) / 0.36; // 0 at outer belt, 1 at shoulder crease
        const cabinTaper = 1.0 - prof.cabinFactor * 0.22;
        const targetX = prof.halfWidth * (0.68 * cabinTaper);
        x = sign * (prof.halfWidth - k * (prof.halfWidth - targetX));
        // 引擎蓋折線微隆起
        const hoodCrease = (1 - prof.cabinFactor) * Math.sin(k * Math.PI) * 0.028;
        y = prof.yBelt + k * 0.055 + hoodCrease;
      } else {
        // 上半部：車窗 / 引擎蓋 / 車頂弧面
        const k = (0.36 - absU) / 0.36; // 0 at shoulder crease, 1 at centerline
        const cabinTaper = 1.0 - prof.cabinFactor * 0.22;
        const shoulderX = prof.halfWidth * (0.68 * cabinTaper);
        x = sign * shoulderX * (1 - k);

        const dome = Math.sin(k * Math.PI * 0.5);
        const shoulderY = prof.yBelt + 0.055;
        // 原型車與超跑前引擎蓋中央下凹導流槽
        const hoodChannel = (prof.s > 0.25 && prof.cabinFactor < 0.2) ? -0.022 * dome : 0;
        y = shoulderY + dome * (prof.yCenter - shoulderY) + hoodChannel;
      }

      positions.push(x * endCap, y, prof.z);
      uvs.push(iu / uSteps, iz / zSteps);
    }
  }

  const rowStride = uSteps + 1;
  for (let iz = 0; iz < zSteps; iz++) {
    for (let iu = 0; iu < uSteps; iu++) {
      const a = iz * rowStride + iu;
      const b = (iz + 1) * rowStride + iu;
      const c = (iz + 1) * rowStride + (iu + 1);
      const d = iz * rowStride + (iu + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 建立流線型透明反光車窗玻璃罩（Windshield + Side Windows + Rear Glass）
 */
function buildCabinGlassGeometry(spec) {
  const v = spec.visual;
  const L = v.length;
  const W = v.width;
  const H = v.cabinHeight;
  const style = v.bodyStyle;

  const zSteps = 18;
  const uSteps = 16;
  const positions = [];
  const uvs = [];
  const indices = [];

  const sStart = (style === 'hatch' || style === 'rally') ? -0.84 : -0.62;
  const sEnd = style === 'proto' ? 0.36 : 0.28;

  for (let iz = 0; iz <= zSteps; iz++) {
    const tZ = iz / zSteps;
    const s = sStart + (sEnd - sStart) * tZ;
    const z = s * (L * 0.5);

    const archProfile = Math.sin(tZ * Math.PI);
    const halfW = W * (style === 'proto' ? 0.31 : 0.36) * (0.78 + 0.22 * archProfile);
    const yBase = H * 0.58;
    const yTop = yBase + (H - yBase) * Math.pow(archProfile, 0.65) + 0.012;

    for (let iu = 0; iu <= uSteps; iu++) {
      const u = -1 + (2 * iu) / uSteps;
      const absU = Math.abs(u);
      const x = u * halfW;
      const dome = Math.cos(absU * Math.PI * 0.5);
      const y = yBase + dome * (yTop - yBase);
      positions.push(x, y, z);
      uvs.push(iu / uSteps, tZ);
    }
  }

  const stride = uSteps + 1;
  for (let iz = 0; iz < zSteps; iz++) {
    for (let iu = 0; iu < uSteps; iu++) {
      const a = iz * stride + iu;
      const b = (iz + 1) * stride + iu;
      const c = (iz + 1) * stride + (iu + 1);
      const d = iz * stride + (iu + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 建立高精細單輪總成（含轉向節、不隨車輪滾動的煞車卡鉗、通風煞車碟盤、多輻式金屬輪圈與立體胎紋輪胎）
 */
function buildWheelAssembly(spec, textures, isLeft) {
  const v = spec.visual;
  const r = v.wheelRadius;
  const w = v.wheelWidth;

  const root = new THREE.Group();
  const steerPivot = new THREE.Group();
  const spinGroup = new THREE.Group();
  root.add(steerPivot);
  steerPivot.add(spinGroup);

  // 1. 輪胎本體（LatheGeometry 打造圓潤胎肩與深輪框槽）
  const tirePoints = [
    new THREE.Vector2(r * 0.68, -w * 0.48),
    new THREE.Vector2(r * 0.94, -w * 0.50),
    new THREE.Vector2(r * 1.00, -w * 0.40),
    new THREE.Vector2(r * 1.00, w * 0.40),
    new THREE.Vector2(r * 0.94, w * 0.50),
    new THREE.Vector2(r * 0.68, w * 0.48)
  ];
  const tireGeo = new THREE.LatheGeometry(tirePoints, 32);
  tireGeo.rotateZ(Math.PI * 0.5);

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x22252a,
    map: textures?.tire?.treadMap || null,
    normalMap: textures?.tire?.treadNormal || null,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.78,
    metalness: 0.08
  });
  const tireMesh = new THREE.Mesh(tireGeo, tireMat);
  tireMesh.castShadow = true;
  tireMesh.receiveShadow = true;
  spinGroup.add(tireMesh);

  // 胎壁字樣圓環
  if (textures?.tire?.sidewallMap) {
    const swGeo = new THREE.RingGeometry(r * 0.67, r * 0.95, 28);
    const swMat = new THREE.MeshStandardMaterial({
      map: textures.tire.sidewallMap,
      roughness: 0.68,
      metalness: 0.1
    });
    const swOut = new THREE.Mesh(swGeo, swMat);
    const outSign = isLeft ? 1 : -1;
    swOut.position.x = outSign * (w * 0.495);
    swOut.rotation.y = isLeft ? Math.PI * 0.5 : -Math.PI * 0.5;
    spinGroup.add(swOut);
  }

  // 2. 金屬輪圈外桶（Alloy Rim Barrel）
  const rimRadius = r * 0.70;
  const rimColors = {
    te37: 0xc29b61, // 古銅色鍛造框
    bbs: 0xd8dde6,  // 拋光銀網狀框
    oz: 0xf0f2f5,   // 拉力白輪框
    gt5: 0xccd4de,  // 超跑五爪亮銀框
    aero: 0x242830  // 碳黑空力輪框
  };
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: rimColors[v.rimStyle] || 0xd0d6de,
    metalness: 0.86,
    roughness: 0.18,
    clearcoat: 0.8
  });

  const lipGeo = new THREE.CylinderGeometry(rimRadius, rimRadius * 0.94, w * 0.86, 28, 1, true);
  lipGeo.rotateZ(Math.PI * 0.5);
  const lipMesh = new THREE.Mesh(lipGeo, rimMat);
  spinGroup.add(lipMesh);

  // 輪圈中心軸蓋與螺母
  const hubGeo = new THREE.CylinderGeometry(rimRadius * 0.24, rimRadius * 0.28, w * 0.72, 16);
  hubGeo.rotateZ(Math.PI * 0.5);
  spinGroup.add(new THREE.Mesh(hubGeo, rimMat));

  // 3. 輪圈輻條（依 rimStyle 區分 5 爪 / 6 爪 TE37 / 10 爪 BBS / 拉力多輻）
  const spokeCount = v.rimStyle === 'te37' ? 6 : v.rimStyle === 'gt5' ? 5 : v.rimStyle === 'bbs' ? 10 : 8;
  const spokeThickness = v.rimStyle === 'bbs' ? 0.022 : 0.042;
  const spokeDepth = 0.028;
  const spokeLen = rimRadius * 0.88;
  const spokeGeo = new THREE.BoxGeometry(spokeDepth, spokeLen, spokeThickness);
  const outX = (isLeft ? 1 : -1) * (w * 0.34);

  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.position.set(outX, Math.cos(angle) * (rimRadius * 0.44), Math.sin(angle) * (rimRadius * 0.44));
    spoke.rotation.x = -angle;
    spinGroup.add(spoke);
  }

  // 4. 劃線打孔煞車碟盤（Brake Disc Rotor — 隨輪胎旋轉）
  const discRadius = rimRadius * 0.78;
  const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.026, 24);
  discGeo.rotateZ(Math.PI * 0.5);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x8d96a0,
    metalness: 0.88,
    roughness: 0.32
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.position.x = (isLeft ? 1 : -1) * (w * 0.14);
  spinGroup.add(discMesh);

  // 5. 煞車卡鉗（Brake Caliper — 固定在 steerPivot 上，隨轉向擺動但不隨輪胎滾動！）
  const caliperGeo = new THREE.BoxGeometry(0.068, discRadius * 0.62, discRadius * 0.38);
  const caliperMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(v.caliperColor || '#ff2a2a'),
    metalness: 0.45,
    roughness: 0.22,
    clearcoat: 0.9
  });
  const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
  // 安裝於碟盤後方 35 度位置
  caliperMesh.position.set((isLeft ? 1 : -1) * (w * 0.16), discRadius * 0.22, -discRadius * 0.68);
  caliperMesh.rotation.x = 0.32;
  steerPivot.add(caliperMesh);

  return {
    root,
    steerPivot,
    spinGroup
  };
}

/**
 * 建立完整高擬真車輛 3D 模型總成
 */
export function buildCarModel(spec, textures, paintOverride = null) {
  const v = spec.visual;
  const p = spec.physics;
  const L = v.length;
  const W = v.width;
  const H = v.cabinHeight;

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group(); // 隨懸吊俯仰與側傾晃動的車體群組
  root.add(bodyGroup);

  // 1. 車漆 PBR 材質（MeshPhysicalMaterial, clearcoat: 1.0, clearcoatRoughness: 0.08）
  const paintHex = paintOverride?.hex || v.defaultPaint || '#ff4800';
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    metalness: paintOverride?.metalness ?? 0.68,
    roughness: paintOverride?.roughness ?? 0.20,
    clearcoat: paintOverride?.clearcoat ?? 1.0,
    clearcoatRoughness: paintOverride?.clearcoatRoughness ?? 0.08,
    envMapIntensity: 1.45
  });

  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1d22,
    map: textures?.carbon?.map || null,
    metalness: 0.35,
    roughness: 0.28,
    clearcoat: 0.75,
    clearcoatRoughness: 0.12
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    metalness: 0.25,
    roughness: 0.65
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1522,
    metalness: 0.15,
    roughness: 0.05,
    transmission: 0.55,
    transparent: true,
    opacity: 0.84,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.8
  });

  // 2. 流線型主車殼 + 封閉式車底平整化底板與車尾飾板
  const shellGeo = buildLoftedCarShellGeometry(spec);
  const shellMesh = new THREE.Mesh(shellGeo, bodyMat);
  shellMesh.castShadow = true;
  shellMesh.receiveShadow = true;
  bodyGroup.add(shellMesh);

  const floorPan = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.04, L * 0.90), darkTrimMat);
  floorPan.position.set(0, 0.14, 0);
  bodyGroup.add(floorPan);

  const rearFascia = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, H * 0.34, 0.12), bodyMat);
  rearFascia.position.set(0, H * 0.34, -L * 0.465);
  rearFascia.castShadow = true;
  bodyGroup.add(rearFascia);

  const rearGrille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, H * 0.14, 0.13), darkTrimMat);
  rearGrille.position.set(0, H * 0.42, -L * 0.468);
  bodyGroup.add(rearGrille);

  // 3. 透明反光車窗罩 + 車艙內部賽車桶椅、方向盤與防滾籠（透過車窗可見）
  const glassGeo = buildCabinGlassGeometry(spec);
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  bodyGroup.add(glassMesh);

  // 內裝座艙桶椅與防滾架
  const interiorGroup = new THREE.Group();
  const seatGeo = new THREE.BoxGeometry(0.38, 0.52, 0.42);
  for (const side of [-1, 1]) {
    const seat = new THREE.Mesh(seatGeo, darkTrimMat);
    seat.position.set(side * (W * 0.18), H * 0.46, -0.08);
    seat.rotation.x = -0.22;
    interiorGroup.add(seat);
  }
  const dashGeo = new THREE.BoxGeometry(W * 0.64, 0.22, 0.36);
  const dash = new THREE.Mesh(dashGeo, darkTrimMat);
  dash.position.set(0, H * 0.52, L * 0.14);
  interiorGroup.add(dash);
  bodyGroup.add(interiorGroup);

  // 4. 前保險桿進氣壩（Front Air Dam）、前下巴（Splitter）與中冷器（Intercooler）
  const splitterGeo = new THREE.BoxGeometry(W * 0.92, 0.036, 0.34);
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.135, L * 0.46);
  splitter.castShadow = true;
  bodyGroup.add(splitter);

  const grilleGeo = new THREE.BoxGeometry(W * 0.58, 0.17, 0.08);
  const grille = new THREE.Mesh(grilleGeo, darkTrimMat);
  grille.position.set(0, 0.24, L * 0.485);
  bodyGroup.add(grille);

  // 渦輪車款外露鋁製中冷器細節
  if (spec.audio.hasTurbo) {
    const icGeo = new THREE.BoxGeometry(W * 0.42, 0.12, 0.09);
    const icMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 0.85, roughness: 0.3 });
    const ic = new THREE.Mesh(icGeo, icMat);
    ic.position.set(0, 0.23, L * 0.488);
    bodyGroup.add(ic);
  }

  // 兩側進氣口風刀（Front Canards）
  for (const side of [-1, 1]) {
    const canardGeo = new THREE.BoxGeometry(0.18, 0.018, 0.24);
    const canard = new THREE.Mesh(canardGeo, carbonMat);
    canard.position.set(side * (W * 0.44), 0.23, L * 0.44);
    canard.rotation.z = side * -0.18;
    canard.rotation.x = 0.15;
    bodyGroup.add(canard);
  }

  // 5. 側裙（Side Skirts）與車側後視鏡（Wing Mirrors）
  const skirtLen = p.wheelbase * 0.62;
  const skirtGeo = new THREE.BoxGeometry(0.08, 0.065, skirtLen);
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtGeo, carbonMat);
    skirt.position.set(side * (W * 0.475), 0.15, 0);
    bodyGroup.add(skirt);

    // 空氣力學車外後視鏡
    const mirrorGroup = new THREE.Group();
    const stalkGeo = new THREE.BoxGeometry(0.11, 0.025, 0.04);
    const stalk = new THREE.Mesh(stalkGeo, darkTrimMat);
    const housingGeo = new THREE.BoxGeometry(0.14, 0.075, 0.10);
    const housing = new THREE.Mesh(housingGeo, bodyMat);
    housing.position.set(side * 0.06, 0.02, -0.01);
    mirrorGroup.add(stalk, housing);
    mirrorGroup.position.set(side * (W * 0.42), H * 0.61, L * 0.12);
    bodyGroup.add(mirrorGroup);
  }

  // 6. 後擴散器（Rear Venturi Diffuser）與雙出/四出金屬排氣管 + 回火火焰
  const diffGroup = new THREE.Group();
  const diffBaseGeo = new THREE.BoxGeometry(W * 0.82, 0.09, 0.32);
  const diffBase = new THREE.Mesh(diffBaseGeo, carbonMat);
  diffBase.position.set(0, 0.19, -L * 0.465);
  diffBase.rotation.x = -0.18;
  diffGroup.add(diffBase);

  // 5 片垂直擴散器導流鰭片（Diffuser Strakes）
  const finGeo = new THREE.BoxGeometry(0.018, 0.13, 0.30);
  for (let i = -2; i <= 2; i++) {
    const fin = new THREE.Mesh(finGeo, carbonMat);
    fin.position.set(i * (W * 0.15), 0.17, -L * 0.47);
    diffGroup.add(fin);
  }
  bodyGroup.add(diffGroup);

  // 排氣管與回火火焰模型
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xc8d2dc, metalness: 0.92, roughness: 0.20 });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xff7700,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const exhaustFlames = [];
  const pipeOffsets = (v.bodyStyle === 'supercar' || v.bodyStyle === 'proto')
    ? [-W * 0.24, -W * 0.17, W * 0.17, W * 0.24]
    : [-W * 0.26, W * 0.26];

  const pipeGeo = new THREE.CylinderGeometry(0.042, 0.045, 0.22, 16);
  pipeGeo.rotateX(Math.PI * 0.5);
  const flameGeo = new THREE.ConeGeometry(0.065, 0.42, 12);
  flameGeo.rotateX(-Math.PI * 0.5);

  for (const px of pipeOffsets) {
    const pipe = new THREE.Mesh(pipeGeo, exhaustMat);
    pipe.position.set(px, 0.21, -L * 0.49);
    bodyGroup.add(pipe);

    const flame = new THREE.Mesh(flameGeo, flameMat.clone());
    flame.position.set(px, 0.21, -L * 0.49 - 0.24);
    flame.visible = false;
    bodyGroup.add(flame);
    exhaustFlames.push(flame);
  }

  // 7. 獨立尾翼（依 wingType 區分：'ducktail' | 'rally' | 'gt' | 'proto' | 'none'）
  const wingY = H * 0.62;
  const wingZ = -L * 0.44;
  if (v.wingType === 'ducktail') {
    const duckGeo = new THREE.BoxGeometry(W * 0.78, 0.075, 0.18);
    const duck = new THREE.Mesh(duckGeo, bodyMat);
    duck.position.set(0, wingY + 0.04, wingZ);
    duck.rotation.x = 0.35;
    duck.castShadow = true;
    bodyGroup.add(duck);
  } else if (v.wingType === 'rally') {
    // 雙層拉力車頂大尾翼
    const rallyWing = new THREE.Group();
    const topBlade = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 0.032, 0.26), bodyMat);
    topBlade.position.set(0, H * 0.96, -L * 0.42);
    topBlade.rotation.x = 0.14;
    const midBlade = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.028, 0.22), carbonMat);
    midBlade.position.set(0, H * 0.83, -L * 0.44);
    for (const side of [-1, 1]) {
      const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.26, 0.30), bodyMat);
      sidePlate.position.set(side * (W * 0.41), H * 0.86, -L * 0.43);
      rallyWing.add(sidePlate);
    }
    rallyWing.add(topBlade, midBlade);
    bodyGroup.add(rallyWing);
  } else if (v.wingType === 'gt' || v.wingType === 'proto') {
    // 鵝頸式 GT 碳纖維大尾翼 + 垂直端板
    const gtGroup = new THREE.Group();
    const bladeW = W * (v.wingType === 'proto' ? 0.96 : 0.88);
    const bladeH = v.wingType === 'proto' ? H * 0.88 : wingY + 0.24;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(bladeW, 0.032, 0.28), carbonMat);
    blade.position.set(0, bladeH, wingZ - 0.03);
    blade.rotation.x = 0.16;
    blade.castShadow = true;
    gtGroup.add(blade);

    // 雙鵝頸支架（Swan-neck Uprights）
    const strutGeo = new THREE.BoxGeometry(0.022, 0.26, 0.16);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(strutGeo, carbonMat);
      strut.position.set(side * (W * 0.22), bladeH - 0.12, wingZ);
      strut.rotation.x = -0.22;
      gtGroup.add(strut);

      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.18, 0.34), bodyMat);
      endplate.position.set(side * (bladeW * 0.5), bladeH, wingZ - 0.03);
      gtGroup.add(endplate);
    }

    // 原型車專屬中央鯊魚鰭穩定翼（Le Mans Shark Fin）與車頂進氣口（Roof Scoop）
    if (v.wingType === 'proto') {
      const finGeo2 = new THREE.BoxGeometry(0.024, 0.22, L * 0.28);
      const sharkFin = new THREE.Mesh(finGeo2, carbonMat);
      sharkFin.position.set(0, bladeH - 0.06, -L * 0.28);
      gtGroup.add(sharkFin);

      const scoopGeo = new THREE.BoxGeometry(0.24, 0.11, 0.42);
      const scoop = new THREE.Mesh(scoopGeo, bodyMat);
      scoop.position.set(0, H * 0.99, -0.05);
      gtGroup.add(scoop);
    }
    bodyGroup.add(gtGroup);
  }

  // 8. 獨立發光頭燈（Headlights + Ground Beam Cones）与煞車 LED 尾燈（Taillights）
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xd8f0ff,
    emissiveIntensity: 3.2,
    roughness: 0.1
  });
  const hlGeo = new THREE.BoxGeometry(W * 0.20, 0.065, 0.12);
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(hlGeo, headlightMat);
    hl.position.set(side * (W * 0.31), H * 0.44, L * 0.465);
    hl.rotation.y = side * 0.18;
    hl.rotation.x = 0.22;
    bodyGroup.add(hl);
  }

  // 頭燈地面投射光束錐
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xd8f2ff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const beamGeo = new THREE.ConeGeometry(1.6, 9.5, 16, 1, true);
  beamGeo.rotateX(Math.PI * 0.5);
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(side * (W * 0.30), 0.32, L * 0.5 + 4.6);
    bodyGroup.add(beam);
  }

  // 煞車 LED 尾燈（平時微亮紅光，煞車時高亮度發光）
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff1122,
    emissive: 0xff0a1e,
    emissiveIntensity: 1.2,
    roughness: 0.15
  });
  const tailGeo = new THREE.BoxGeometry(W * 0.24, 0.068, 0.06);
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(tailGeo, tailMat);
    tl.position.set(side * (W * 0.28), H * 0.50, -L * 0.485);
    bodyGroup.add(tl);
  }
  // 中央第三煞車燈條
  const centerBrakeGeo = new THREE.BoxGeometry(W * 0.36, 0.025, 0.04);
  const centerBrake = new THREE.Mesh(centerBrakeGeo, tailMat);
  centerBrake.position.set(0, H * 0.56, -L * 0.482);
  bodyGroup.add(centerBrake);

  // 倒車白燈
  const revMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.2
  });
  const revGeo = new THREE.BoxGeometry(0.10, 0.035, 0.04);
  for (const side of [-1, 1]) {
    const rl = new THREE.Mesh(revGeo, revMat);
    rl.position.set(side * (W * 0.20), H * 0.44, -L * 0.488);
    bodyGroup.add(rl);
  }

  // 9. 車側與引擎蓋賽車號碼牌塗裝（Racing Number Plate）
  const decalTex = createDecalTexture(v.number, spec.brand, v.caliperColor);
  const decalMat = new THREE.MeshBasicMaterial({
    map: decalTex,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
  const hoodDecalGeo = new THREE.PlaneGeometry(0.62, 0.32);
  hoodDecalGeo.rotateX(-Math.PI * 0.5 + 0.16);
  const hoodDecal = new THREE.Mesh(hoodDecalGeo, decalMat);
  hoodDecal.position.set(0, H * 0.53, L * 0.28);
  bodyGroup.add(hoodDecal);

  // 10. 建立四輪獨立總成
  const wheelMeshes = [
    buildWheelAssembly(spec, textures, true),  // 0: FL
    buildWheelAssembly(spec, textures, false), // 1: FR
    buildWheelAssembly(spec, textures, true),  // 2: RL
    buildWheelAssembly(spec, textures, false)  // 3: RR
  ];
  for (const wm of wheelMeshes) {
    root.add(wm.root);
  }

  // 預設靜態輪位（供車庫展示台使用：對齊車殼輪拱中心）
  const halfTrack = p.trackWidth * 0.5;
  const halfWB = p.wheelbase * 0.5;
  const staticWheelY = v.wheelRadius * 0.78;
  const staticWheelCoords = [
    [halfTrack, staticWheelY, halfWB],
    [-halfTrack, staticWheelY, halfWB],
    [halfTrack, staticWheelY, -halfWB],
    [-halfTrack, staticWheelY, -halfWB]
  ];
  for (let i = 0; i < 4; i++) {
    wheelMeshes[i].root.position.set(...staticWheelCoords[i]);
  }

  return {
    root,
    bodyGroup,
    bodyMat,
    tailMat,
    revMat,
    wheelMeshes,
    exhaustFlames,
    setPaint(paintObj) {
      if (paintObj.hex) bodyMat.color.set(paintObj.hex);
      if (paintObj.metalness !== undefined) bodyMat.metalness = paintObj.metalness;
      if (paintObj.roughness !== undefined) bodyMat.roughness = paintObj.roughness;
      if (paintObj.clearcoat !== undefined) bodyMat.clearcoat = paintObj.clearcoat;
      if (paintObj.clearcoatRoughness !== undefined) bodyMat.clearcoatRoughness = paintObj.clearcoatRoughness;
      bodyMat.needsUpdate = true;
    },
    setBraking(brakeAmount, isReverse = false) {
      tailMat.emissiveIntensity = brakeAmount > 0.05 ? 4.8 : 1.2;
      revMat.emissiveIntensity = isReverse ? 3.5 : 0.0;
    },
    setBackfire(active) {
      for (const f of exhaustFlames) {
        f.visible = active;
        if (active) {
          f.material.opacity = 0.75 + Math.random() * 0.25;
          const s = 0.8 + Math.random() * 0.5;
          f.scale.set(s, s, 0.7 + Math.random() * 0.7);
        }
      }
    },
    syncFromPhysics(simVehicle) {
      // 同步車身剛體座標與旋轉，並疊加懸吊動態俯仰（Pitch）與側傾（Roll）
      const pos = simVehicle.chassisBody.position;
      const quat = simVehicle.chassisBody.quaternion;
      root.position.set(pos.x, pos.y, pos.z);
      root.quaternion.set(quat.x, quat.y, quat.z, quat.w);

      // 車殼相對於底盤的微幅動態重量轉移姿態
      bodyGroup.rotation.x = -simVehicle.bodyPitch;
      bodyGroup.rotation.z = simVehicle.bodyRoll;
      bodyGroup.position.y = -0.22;

      // 四輪獨立懸吊位置、前輪與卡鉗轉向、輪胎與碟盤滾動
      for (let i = 0; i < 4; i++) {
        const wInfo = simVehicle.raycastVehicle.wheelInfos[i];
        const wState = simVehicle.wheels[i];
        const wm = wheelMeshes[i];

        // 將世界座標輪心轉回 root 局部座標以精準對齊懸吊壓縮高度
        const localX = wInfo.chassisConnectionPointLocal.x;
        const localZ = wInfo.chassisConnectionPointLocal.z;
        const localY = wInfo.chassisConnectionPointLocal.y - wInfo.suspensionLength;

        wm.root.position.set(localX, localY, localZ);
        wm.steerPivot.rotation.y = wState.steering;
        wm.spinGroup.rotation.x = wState.rotation;
      }

      this.setBraking(simVehicle.brake, simVehicle.gear === -1);
      this.setBackfire(simVehicle.backfireTimer > 0);
    }
  };
}
