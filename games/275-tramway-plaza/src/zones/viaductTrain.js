// 區塊 3：環形高架軌道、圓柱橋墩、道碴雙軌、架空電車線、拱頂玻璃車站、雙段大階梯與雙節歐風電車
import * as THREE from 'three';
import { PLINTH, LOOP, LOOP_TOTAL_LENGTH, sampleLoop } from '../config.js';
import { GeoKit, normalizeGeo } from '../kit.js';

/**
 * 沿封閉跑道曲線掃掠任意 2D 橫斷面（pts: Array<[offsetRight, offsetUp]>），精確生成無縫閉合環形網格
 */
function sweepClosedLoopProfile(profile2D, radialOffset = 0, segments = 180) {
  const nProf = profile2D.length;
  const positions = [];
  const uvs = [];

  const p0 = new THREE.Vector3();
  const t0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const t1 = new THREE.Vector3();

  for (let i = 0; i < segments; i++) {
    const uA = i / segments;
    const uB = (i + 1) / segments;
    sampleLoop(uA, radialOffset, p0, t0);
    sampleLoop(uB, radialOffset, p1, t1);

    // 向外法線（在 XZ 平面：tan = (tx, 0, tz)，右側朝外法線為 (-tz, 0, tx)？驗證：
    // 前直線 tan=(1,0,0)，外側為 +Z => (0, 0, 1) = (-tz, 0, tx)！完全正確！）
    const n0x = -t0.z, n0z = t0.x;
    const n1x = -t1.z, n1z = t1.x;

    for (let j = 0; j < nProf; j++) {
      const [rA, yA] = profile2D[j];
      const [rB, yB] = profile2D[(j + 1) % nProf];

      const ax0 = p0.x + n0x * rA, ay0 = p0.y + yA, az0 = p0.z + n0z * rA;
      const bx0 = p0.x + n0x * rB, by0 = p0.y + yB, bz0 = p0.z + n0z * rB;
      const ax1 = p1.x + n1x * rA, ay1 = p1.y + yA, az1 = p1.z + n1z * rA;
      const bx1 = p1.x + n1x * rB, by1 = p1.y + yB, bz1 = p1.z + n1z * rB;

      // 兩個三角形（確保法線朝外，依逆時針順序排列剖面點）
      positions.push(
        ax0, ay0, az0,
        ax1, ay1, az1,
        bx1, by1, bz1,

        ax0, ay0, az0,
        bx1, by1, bz1,
        bx0, by0, bz0,
      );
      uvs.push(
        uA, j / nProf,
        uB, j / nProf,
        uB, (j + 1) / nProf,
        uA, j / nProf,
        uB, (j + 1) / nProf,
        uA, (j + 1) / nProf,
      );
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return normalizeGeo(geo);
}

export function buildViaductAndTrain(materials, decals, treeSlots) {
  const group = new THREE.Group();
  group.name = 'zone_viaduct_train';
  const kit = new GeoKit();
  const swY = PLINTH.sidewalkY;
  const deckY = LOOP.deckY;
  const hw = LOOP.deckWidth * 0.5; // 1.55

  // ─────────────────────────────────────────────────────────────
  // 1. 環形高架橋箱樑結構、側緣護欄石、道碴床與雙鋼軌
  // ─────────────────────────────────────────────────────────────
  // 奶油白混凝土橋面箱樑剖面（上寬 3.16、底收窄為 2.15 的優雅斜腹箱樑）
  const girderProfile = [
    [-hw, 0.04],
    [hw, 0.04],
    [hw, -0.22],
    [hw * 0.72, -0.56],
    [-hw * 0.72, -0.56],
    [-hw, -0.22],
  ];
  kit.addGeo('creamLight', sweepClosedLoopProfile(girderProfile, 0, 192));

  // 兩側低矮石材邊樑（Curb Parapets）
  for (const side of [-1, 1]) {
    const curbProf = [
      [side * (hw - 0.20), 0.22],
      [side * hw, 0.22],
      [side * hw, 0.03],
      [side * (hw - 0.20), 0.03],
    ];
    kit.addGeo('creamMain', sweepClosedLoopProfile(curbProf, 0, 192));
  }

  // 道碴碎石床剖面
  const balProf = [
    [-0.98, 0.16],
    [0.98, 0.16],
    [1.18, 0.04],
    [-1.18, 0.04],
  ];
  kit.addGeo('ballast', sweepClosedLoopProfile(balProf, 0, 192));

  // 內外雙鋼軌掃掠
  const halfGauge = LOOP.gauge * 0.5;
  for (const rOff of [-halfGauge, halfGauge]) {
    const railProf = [
      [-0.045, 0.26],
      [0.045, 0.26],
      [0.055, 0.15],
      [-0.055, 0.15],
    ];
    kit.addGeo('steelRail', sweepClosedLoopProfile(railProf, rOff, 192));
  }

  // 高架兩側細鍛鐵安全欄杆（上扶手掃掠 + 柱列）
  for (const side of [-1, 1]) {
    const railBarProf = [
      [side * (hw - 0.08) - 0.022, 0.62],
      [side * (hw - 0.08) + 0.022, 0.62],
      [side * (hw - 0.08) + 0.022, 0.57],
      [side * (hw - 0.08) - 0.022, 0.57],
    ];
    kit.addGeo('wroughtIron', sweepClosedLoopProfile(railBarProf, 0, 160));
  }

  // ─────────────────────────────────────────────────────────────
  // 2. 枕木（InstancedMesh）與外側架空電車線桿（Catenary Masts + 接觸網線）
  // ─────────────────────────────────────────────────────────────
  const sleeperCount = 228;
  const sleeperGeo = new THREE.BoxGeometry(1.62, 0.07, 0.18);
  const sleepers = new THREE.InstancedMesh(sleeperGeo, materials.woodDark, sleeperCount);
  sleepers.castShadow = false;
  sleepers.receiveShadow = true;

  const _p = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3(1, 1, 1);
  const _e = new THREE.Euler();

  for (let i = 0; i < sleeperCount; i++) {
    sampleLoop(i / sleeperCount, 0, _p, _t);
    const yaw = Math.atan2(_t.x, _t.z);
    _p.y = deckY + 0.155;
    _e.set(0, yaw, 0);
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    sleepers.setMatrixAt(i, _m);
  }
  sleepers.instanceMatrix.needsUpdate = true;
  group.add(sleepers);

  // 架空接觸網線與外圈懸臂電桿（重現參考圖環繞高架上方的細緻電車線網！）
  const mastCount = 24;
  const contactWirePts = [];
  for (let i = 0; i < mastCount; i++) {
    const u = i / mastCount;
    sampleLoop(u, 0, _p, _t);
    // 避開拱頂車站範圍（車站內電車線整合於拱肋內）
    const inStation = Math.abs(_p.z - (LOOP.cz + LOOP.radius)) < 1.2 && _p.x > LOOP.stationX - 5.4 && _p.x < LOOP.stationX + 5.4;
    const nx = -_t.z, nz = _t.x;
    const yaw = Math.atan2(nx, nz);

    if (!inStation) {
      const mx = _p.x + nx * (hw - 0.08);
      const mz = _p.z + nz * (hw - 0.08);
      kit.cylBase('wroughtIron', mx, deckY + 0.22, mz, 0.032, 0.042, 2.55, 6);
      // 向軌道中心伸出的懸臂橫桿
      const armX = _p.x + nx * (hw * 0.5 - 0.05);
      const armZ = _p.z + nz * (hw * 0.5 - 0.05);
      kit.boxBase('wroughtIron', armX, deckY + 2.66, armZ, 0.025, 0.025, hw + 0.05, yaw);
    }
    contactWirePts.push(new THREE.Vector3(_p.x, deckY + 2.64, _p.z));
  }
  contactWirePts.push(contactWirePts[0].clone());
  const wireCurve = new THREE.CatmullRomCurve3(contactWirePts, true);
  const wireGeo = new THREE.TubeGeometry(wireCurve, 160, 0.016, 4, true);
  kit.addGeo('wroughtIron', wireGeo);

  // ─────────────────────────────────────────────────────────────
  // 3. 高架圓柱橋墩（全部精確落在人行道／綠帶路緣，絕不阻擋車道或穿模建築）
  // ─────────────────────────────────────────────────────────────
  const addViaductPier = (px, pz, groundY = swY) => {
    const pierTop = deckY - 0.54;
    const h = pierTop - groundY;
    // 方形柱礎 + 圓柱墩身 + 柱頭托座
    kit.boxBase('limestone', px, groundY, pz, 1.02, 0.26, 1.02);
    kit.cylBase('creamLight', px, groundY + 0.26, pz, 0.36, 0.41, h - 0.52, 16);
    kit.boxBase('creamLight', px, pierTop - 0.26, pz, 1.24, 0.28, 1.24);
    decals.add(px, groundY + 0.015, pz, 2.2, 2.2, 0.36);
  };

  // 前側直線段橋墩（沿 Z = -0.35 南側人行道邊緣排列，車站段改由車站八柱承重）
  for (const x of [-5.0, -0.4, 4.2, 8.8, 13.4]) {
    addViaductPier(x, -0.42, swY);
  }
  // 後側直線段橋墩（沿 Z = -16.55 北側公寓街廓北緣與 -20.9 外緣交錯）
  for (const x of [-5.0, 0.5, 6.0, 11.5, 17.0, 21.5]) {
    addViaductPier(x, -16.65, swY);
  }
  // 西側半圓彎道橋墩（跨過西中縱向道 [-17.0, -12.6]，落於兩側人行道）
  addViaductPier(-9.3, -17.15, swY);
  addViaductPier(-12.2, -14.3, swY);
  addViaductPier(-17.3, -9.9, swY); // 西中道西側公園人行道緣
  addViaductPier(-12.1, -5.3, swY);

  // 東側半圓彎道橋墩（跨過東外環道 [25.8, 30.2]，外柱落於東側最外人行道 X=30.4，重現參考圖右側高架立柱！）
  addViaductPier(25.5, -4.6, swY);
  addViaductPier(30.45, -7.2, swY);
  addViaductPier(30.45, -12.6, swY);
  addViaductPier(25.5, -15.2, swY);

  // ─────────────────────────────────────────────────────────────
  // 4. 東南高架拱頂車站（Vaulted Conservatory Station）與雙段石造大階梯
  // ─────────────────────────────────────────────────────────────
  const stX = LOOP.stationX; // 20.4
  const stZ = LOOP.cz + LOOP.radius; // -1.5
  const stLen = 9.4;
  const stWid = 6.2;

  // 加寬車站月台底板與奶油白托樑
  kit.boxBase('creamLight', stX, deckY - 0.42, stZ, stLen, 0.46, stWid);
  kit.boxBase('sidewalk', stX, deckY + 0.04, stZ + 2.05, stLen - 0.3, 0.14, 1.85); // 南側候車月台
  kit.boxBase('sidewalk', stX, deckY + 0.04, stZ - 2.05, stLen - 0.3, 0.14, 1.85); // 北側候車月台

  // 車站承重八方柱（南北各四根古典帶柱頭方柱，跨過下方車道）
  for (const dx of [-4.1, -1.4, 1.4, 4.1]) {
    for (const pz of [stZ + 2.65, stZ - 3.35]) {
      const px = stX + dx;
      kit.boxBase('limestone', px, swY, pz, 0.88, 0.28, 0.88);
      kit.boxBase('creamLight', px, swY + 0.28, pz, 0.62, deckY - 0.70 - swY, 0.62);
      kit.boxBase('creamLight', px, deckY - 0.68, pz, 0.92, 0.28, 0.92);
      decals.add(px, swY + 0.015, pz, 2.0, 2.0, 0.36);
    }
  }

  // 標誌性深古銅色半圓拱肋天棚（8 道拱形鋼肋 + 縱向繫桿，完全重現參考圖右方車站造型！）
  const archCount = 8;
  const archSpanR = stWid * 0.48; // 2.98
  for (let i = 0; i < archCount; i++) {
    const ax = stX - (stLen * 0.46) + (i / (archCount - 1)) * (stLen * 0.92);
    // 兩側垂直立柱段
    for (const s of [-1, 1]) {
      kit.boxBase('wroughtIron', ax, deckY + 0.16, stZ + s * archSpanR, 0.09, 1.35, 0.09);
    }
    // 上半部半圓拱肋
    const archTorus = new THREE.TorusGeometry(archSpanR, 0.055, 8, 28, Math.PI);
    archTorus.rotateY(Math.PI * 0.5);
    archTorus.translate(ax, deckY + 1.50, stZ);
    kit.addGeo('wroughtIron', archTorus);
  }
  // 拱頂縱向鋼檁條（7 道貫穿全站長）
  for (const aDeg of [15, 42, 68, 90, 112, 138, 165]) {
    const rad = (aDeg * Math.PI) / 180;
    const py = deckY + 1.50 + Math.sin(rad) * archSpanR;
    const pz = stZ + Math.cos(rad) * archSpanR;
    kit.box('wroughtIron', stX, py, pz, stLen * 0.94, 0.045, 0.045);
  }

  // 月台候車木長椅與防護欄杆（預留東側階梯開口）
  kit.boxBase('woodWarm', stX - 1.8, deckY + 0.48, stZ + 2.25, 2.1, 0.07, 0.42);
  kit.boxBase('wroughtIron', stX - 1.8, deckY + 0.18, stZ + 2.25, 1.8, 0.30, 0.34);
  kit.boxBase('wroughtIron', stX - 1.4, deckY + 0.72, stZ + stWid * 0.5 - 0.08, 6.2, 0.05, 0.05);
  kit.boxBase('wroughtIron', stX, deckY + 0.72, stZ - stWid * 0.5 + 0.08, stLen - 0.2, 0.05, 0.05);

  // ── 雙段式石造大階梯（位於 X = 22.8，鐘塔東側至東外環道之間，中段平台旁種一株綠樹！） ──
  const stairX = LOOP.stairX; // 22.8
  const stairW = 2.35;
  const landZ0 = 4.6, landZ1 = 6.5;
  const landY = 3.12;

  // 車站延伸出挑接台（Z: 1.55 -> 2.15）
  kit.boxBase('creamLight', stairX, deckY - 0.32, 1.80, stairW + 0.36, 0.50, 1.15);

  // 上段階梯（Z: 2.25 -> 4.60, Y: 6.17 -> 3.12，12 級踏步）
  const steps1 = 12;
  const z1Start = 2.25, z1End = landZ0;
  const y1Start = deckY + 0.02, y1End = landY;
  for (let s = 0; s < steps1; s++) {
    const t = s / steps1;
    const szPos = z1Start + t * (z1End - z1Start);
    const syPos = THREE.MathUtils.lerp(y1Start, y1End, (s + 1) / steps1);
    kit.boxBase('limestone', stairX, syPos - 0.26, szPos, stairW, 0.28, 0.28);
    kit.boxBase('creamLight', stairX, syPos - 0.02, szPos, stairW - 0.14, 0.05, 0.26);
  }
  const dz1 = z1End - z1Start;
  const dy1 = y1Start - y1End;
  const len1 = Math.hypot(dy1, dz1);
  const rx1 = Math.atan2(dy1, dz1);
  const z1Mid = (z1Start + z1End) * 0.5;
  const y1Mid = (y1Start + y1End) * 0.5;
  // 上段斜向底樑與兩側精確等斜率扶手
  kit.box('creamLight', stairX, y1Mid - 0.32, z1Mid, stairW + 0.24, 0.30, len1 + 0.2, rx1, 0, 0);
  for (const s of [-1, 1]) {
    const hx = stairX + s * (stairW * 0.5 - 0.06);
    kit.box('wroughtIron', hx, y1Mid + 0.68, z1Mid, 0.05, 0.05, len1, rx1, 0, 0);
    kit.boxBase('wroughtIron', hx, deckY + 0.02, z1Start, 0.05, 0.70, 0.05);
    kit.boxBase('wroughtIron', hx, landY, z1End, 0.05, 0.68, 0.05);
  }

  // 中段轉折平台（Mid-landing）、承重雙柱與平台水平欄杆
  const landCenterZ = (landZ0 + landZ1) * 0.5;
  kit.boxBase('creamLight', stairX, landY - 0.32, landCenterZ, stairW + 0.36, 0.36, landZ1 - landZ0 + 0.2);
  for (const s of [-1, 1]) {
    const cpx = stairX + s * (stairW * 0.5 - 0.22);
    kit.boxBase('creamLight', cpx, swY, landCenterZ, 0.44, landY - 0.30 - swY, 0.44);
    decals.add(cpx, swY + 0.015, landCenterZ, 1.2, 1.2, 0.30);
    const hx = stairX + s * (stairW * 0.5 - 0.06);
    kit.boxBase('wroughtIron', hx, landY + 0.655, landCenterZ, 0.05, 0.05, landZ1 - landZ0 + 0.06);
    kit.boxBase('wroughtIron', hx, landY, landZ1, 0.05, 0.68, 0.05);
  }
  // 中段平台西側緊鄰的一株綠樹（精確重現參考圖階梯中段旁的綠樹！）
  treeSlots.push({ x: stairX - 1.85, y: swY + 0.05, z: landCenterZ + 0.2, scale: 0.92, kind: 'street' });

  // 下段階梯（Z: 6.50 -> 9.65, Y: 3.12 -> swY+0.04，13 級踏步）
  const steps2 = 13;
  const z2Start = landZ1, z2End = 9.65;
  const y2Start = landY, y2End = swY + 0.04;
  for (let s = 0; s < steps2; s++) {
    const t = s / steps2;
    const szPos = z2Start + t * (z2End - z2Start);
    const syPos = THREE.MathUtils.lerp(y2Start, y2End, (s + 1) / steps2);
    kit.boxBase('limestone', stairX, Math.max(swY, syPos - 0.26), szPos, stairW, 0.26, 0.30);
    kit.boxBase('creamLight', stairX, syPos, szPos, stairW - 0.14, 0.05, 0.28);
  }
  const dz2 = z2End - z2Start;
  const dy2 = y2Start - y2End;
  const len2 = Math.hypot(dy2, dz2);
  const rx2 = Math.atan2(dy2, dz2);
  const z2Mid = (z2Start + z2End) * 0.5;
  const y2Mid = (y2Start + y2End) * 0.5;
  kit.box('creamLight', stairX, y2Mid - 0.26, z2Mid, stairW + 0.24, 0.28, len2 + 0.15, rx2, 0, 0);
  for (const s of [-1, 1]) {
    const hx = stairX + s * (stairW * 0.5 - 0.06);
    kit.box('wroughtIron', hx, y2Mid + 0.68, z2Mid, 0.05, 0.05, len2, rx2, 0, 0);
    kit.boxBase('wroughtIron', hx, swY, z2End, 0.06, 0.72, 0.06);
  }
  decals.add(stairX, swY + 0.015, 8.3, 3.2, 4.2, 0.36);

  group.add(kit.build(materials));

  // ─────────────────────────────────────────────────────────────
  // 5. 持續行駛的雙節奶油色歐風輕軌電車（2-Car Articulated European Tram）
  // ─────────────────────────────────────────────────────────────
  const buildTramCar = (isFront, hasPantograph) => {
    const carKit = new GeoKit();
    const cw = 1.56;
    const ch = 1.82;
    const cl = 4.35;

    // 底盤轉向架深色裙板
    carKit.box('wroughtIron', 0, 0.24, 0, cw * 0.88, 0.32, cl * 0.92);
    // 奶油白流線車身下段與車頂弧邊
    carKit.box('creamLight', 0, 0.68, 0, cw, 0.64, cl);
    carKit.box('creamLight', 0, 1.86, 0, cw * 0.96, 0.26, cl * 0.98);
    carKit.box('creamMain', 0, 2.02, 0, cw * 0.78, 0.14, cl * 0.86);

    // 觀景窗帶（深色窗框 + 暖光車廂內裝透光）
    carKit.box('windowDark', 0, 1.36, 0, cw + 0.02, 0.74, cl * 0.90);
    carKit.box('windowWarm', 0, 1.36, 0, cw - 0.14, 0.62, cl * 0.82);

    // 車側窗柱分隔與雙開門線條
    for (const zOff of [-1.45, -0.48, 0.48, 1.45]) {
      carKit.box('creamLight', 0, 1.36, zOff, cw + 0.05, 0.76, 0.12);
    }

    // 車頭／車尾斜向擋風玻璃與頭尾燈（+Z 為車頭前進方向）
    const endSign = isFront ? 1 : -1;
    carKit.box('creamLight', 0, 0.66, endSign * (cl * 0.5 + 0.16), cw * 0.94, 0.62, 0.36);
    carKit.box('windowDark', 0, 1.35, endSign * (cl * 0.5 + 0.08), cw * 0.88, 0.74, 0.22, endSign * -0.18, 0, 0);

    const lightMat = isFront ? 'lampGlow' : 'tailRed';
    for (const sx of [-0.52, 0.52]) {
      carKit.cyl(lightMat, sx, 0.62, endSign * (cl * 0.5 + 0.35), 0.085, 0.085, 0.05, 10, Math.PI * 0.5, 0, 0);
    }

    // 車頂空調箱與集電弓（Pantograph）
    carKit.box('limestone', 0, 2.13, -endSign * 0.75, 0.92, 0.16, 1.15);
    if (hasPantograph) {
      carKit.box('wroughtIron', 0, 2.14, 0.55, 0.68, 0.06, 0.68);
      carKit.box('wroughtIron', 0, 2.28, 0.32, 0.04, 0.04, 0.62, 0.45, 0, 0);
      carKit.box('wroughtIron', 0, 2.48, 0.32, 0.04, 0.04, 0.62, -0.45, 0, 0);
      carKit.box('wroughtIron', 0, 2.60, 0.56, 0.92, 0.035, 0.06);
    }

    return carKit.build(materials);
  };

  const carA = buildTramCar(true, true);
  const carB = buildTramCar(false, false);

  // 中央風琴式鉸接連通道（Articulated Bellows）
  const bellowsKit = new GeoKit();
  bellowsKit.box('wroughtIron', 0, 1.14, 0, 1.40, 1.66, 0.78);
  for (const zf of [-0.24, 0, 0.24]) {
    bellowsKit.box('windowDark', 0, 1.14, zf, 1.44, 1.70, 0.08);
  }
  const bellows = bellowsKit.build(materials);

  const trainGroup = new THREE.Group();
  trainGroup.name = 'articulated_tram';
  trainGroup.add(carA, bellows, carB);
  group.add(trainGroup);

  // 預設初始位置放在東側彎道（u ≈ 0.34，截圖時正好出現在參考圖右方彎道上！）
  let trainU = 0.345;
  const baseSpeed = 8.4; // m/s 微縮比例換算後優雅滑順的巡航車速
  const carSpacingU = 5.05 / LOOP_TOTAL_LENGTH;

  const posA = new THREE.Vector3(), tanA = new THREE.Vector3();
  const posB = new THREE.Vector3(), tanB = new THREE.Vector3();
  const posMid = new THREE.Vector3(), tanMid = new THREE.Vector3();
  const focusOut = new THREE.Vector3();

  function placeSegment(obj, uVal, posVec, tanVec) {
    sampleLoop(uVal, 0, posVec, tanVec);
    obj.position.set(posVec.x, LOOP.railY - 0.02, posVec.z);
    obj.rotation.set(0, Math.atan2(tanVec.x, tanVec.z), 0);
  }

  function updateTrain(dt, speedMultiplier = 1.0) {
    trainU = (trainU + (dt * baseSpeed * speedMultiplier) / LOOP_TOTAL_LENGTH) % 1;
    placeSegment(carA, trainU, posA, tanA);
    placeSegment(bellows, trainU - carSpacingU * 0.5, posMid, tanMid);
    placeSegment(carB, trainU - carSpacingU, posB, tanB);
    focusOut.copy(posMid).setY(LOOP.railY + 1.1);
    return focusOut;
  }

  updateTrain(0, 1.0);
  return {
    group,
    updateTrain,
    getTrainU: () => trainU,
    setTrainU: (u) => {
      trainU = ((u % 1) + 1) % 1;
      return updateTrain(0, 0);
    },
    getFocusPosition: () => focusOut,
  };
}
