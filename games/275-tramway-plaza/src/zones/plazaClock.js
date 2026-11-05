// 區塊 1：中央鐘塔市政廳、圓形噴水池廣場、露天咖啡陽傘座與公園長椅
import * as THREE from 'three';
import { PLINTH, PLAZA } from '../config.js';
import { GeoKit } from '../kit.js';

export function buildPlazaAndClockTower(materials, decals) {
  const group = new THREE.Group();
  group.name = 'zone_plaza_clock';
  const kit = new GeoKit();
  const swY = PLINTH.sidewalkY;

  // ─────────────────────────────────────────────────────────────
  // 1. 中央暖灰米洞石廣場鋪面（X ∈ [-10.8, +9.6], Z ∈ [+1.4, +14.6]）
  // ─────────────────────────────────────────────────────────────
  const px0 = -10.6, px1 = 9.4, pz0 = 1.5, pz1 = 14.5;
  const pcx = (px0 + px1) * 0.5;
  const pcz = (pz0 + pz1) * 0.5;
  kit.boxBase('creamLight', pcx, swY, pcz, px1 - px0 + 0.45, 0.032, pz1 - pz0 + 0.45);
  kit.boxBase('plazaStone', pcx, swY + 0.008, pcz, px1 - px0, 0.034, pz1 - pz0);

  const plazaY = swY + 0.042;

  // ─────────────────────────────────────────────────────────────
  // 2. 圓形噴水池（外圈修剪綠籬環 + 點綴白花 + 奶油石池緣 + 雙層雕花噴泉塔 + 動態水珠）
  // ─────────────────────────────────────────────────────────────
  const fx = PLAZA.fountainX;
  const fz = PLAZA.fountainZ;

  // 綠籬外石圈與修剪圓環綠籬（以 Torus 壓扁切齊底部，呈現渾圓修剪灌木感）
  kit.cylBase('creamLight', fx, plazaY, fz, 4.28, 4.35, 0.14, 40);
  const hedgeTorus = new THREE.TorusGeometry(3.82, 0.42, 14, 44);
  hedgeTorus.rotateX(Math.PI * 0.5);
  hedgeTorus.scale(1, 0.92, 1);
  hedgeTorus.translate(fx, plazaY + 0.34, fz);
  kit.addGeo('hedge', hedgeTorus);

  // 綠籬上的細小白花叢
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 3.82 + ((i % 2) * 0.16 - 0.08);
    kit.cylBase('blossomWhite', fx + Math.cos(a) * r, plazaY + 0.68, fz + Math.sin(a) * r, 0.11, 0.14, 0.08, 6);
  }

  // 噴水池圓形石砌池壁（外環 + 池唇線腳 + 池底）
  const basinRing = new THREE.TorusGeometry(3.16, 0.22, 12, 44);
  basinRing.rotateX(Math.PI * 0.5);
  basinRing.scale(1, 1.15, 1);
  basinRing.translate(fx, plazaY + 0.34, fz);
  kit.addGeo('creamLight', basinRing);
  kit.cylBase('limestone', fx, plazaY, fz, 3.30, 3.38, 0.30, 40);
  kit.cylBase('rockStone', fx, plazaY, fz, 2.98, 2.98, 0.12, 36);

  // 水面圓盤（使用 TSL 即時波紋材質）
  const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.98, 2.98, 0.06, 40), materials.water);
  waterDisc.position.set(fx, plazaY + 0.36, fz);
  waterDisc.receiveShadow = true;
  group.add(waterDisc);

  // 噴泉中央雙層古典石雕柱盆（LatheGeometry 迴轉體）
  const lathePts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.62, 0.0),
    new THREE.Vector2(0.54, 0.25),
    new THREE.Vector2(0.28, 0.52),
    new THREE.Vector2(0.24, 0.86),
    new THREE.Vector2(0.88, 1.04),
    new THREE.Vector2(0.95, 1.16),
    new THREE.Vector2(0.20, 1.18),
    new THREE.Vector2(0.18, 1.56),
    new THREE.Vector2(0.50, 1.70),
    new THREE.Vector2(0.54, 1.78),
    new THREE.Vector2(0.12, 1.80),
    new THREE.Vector2(0.10, 2.02),
    new THREE.Vector2(0.001, 2.08),
  ];
  const centerSculpt = new THREE.LatheGeometry(lathePts, 24);
  centerSculpt.translate(fx, plazaY + 0.20, fz);
  kit.addGeo('creamLight', centerSculpt);
  decals.add(fx, plazaY + 0.01, fz, 9.4, 9.4, 0.34);

  // 動態噴泉水珠環（InstancedMesh 輕量拋物線水花）
  const dropCount = 36;
  const dropGeo = new THREE.SphereGeometry(0.065, 6, 6);
  const dropsMesh = new THREE.InstancedMesh(dropGeo, materials.waterFoam, dropCount);
  dropsMesh.castShadow = false;
  dropsMesh.receiveShadow = false;
  group.add(dropsMesh);

  // ─────────────────────────────────────────────────────────────
  // 3. 鐘塔市政廳大樓（Clock Tower Civic Hall，對齊參考圖右前景地標）
  // ─────────────────────────────────────────────────────────────
  const cx = PLAZA.clockHallX;
  const cz = PLAZA.clockHallZ;
  const cw = PLAZA.clockHallW; // 10.2
  const cd = PLAZA.clockHallD; // 6.4

  // 雙階石材台基
  kit.boxBase('limestone', cx, swY, cz, cw + 0.72, 0.16, cd + 0.72);
  kit.boxBase('creamLight', cx, swY + 0.16, cz, cw + 0.32, 0.16, cd + 0.32);
  decals.add(cx, swY + 0.015, cz, cw + 2.4, cd + 2.4, 0.42);

  const baseH = swY + 0.32;
  const hallH = 3.85;

  // 室內暖光核心盒（外露於壁柱凹間，從柱廊開口透出柔和琥珀室內光，重現參考圖一樓柱廊光感）
  kit.boxBase('creamMain', cx, baseH, cz, cw - 0.72, hallH, cd - 0.72);
  kit.boxBase('limestone', cx, baseH, cz, cw - 0.34, 0.34, cd - 0.34);
  kit.boxBase('windowWarm', cx, baseH + 0.34, cz, cw - 0.42, hallH - 0.96, cd - 0.42);

  // 正立面與背立面古典壁柱群（6 根方柱夾出 5 開間高窗）
  const pilasterCountX = 6;
  for (let i = 0; i < pilasterCountX; i++) {
    const px = cx - (cw * 0.5 - 0.36) + (i / (pilasterCountX - 1)) * (cw - 0.72);
    for (const side of [-1, 1]) {
      const pz = cz + side * (cd * 0.5 - 0.18);
      kit.boxBase('creamLight', px, baseH, pz, 0.62, hallH, 0.42);
      // 柱礎與柱頭線腳
      kit.boxBase('limestone', px, baseH, pz, 0.72, 0.24, 0.50);
      kit.boxBase('creamLight', px, baseH + hallH - 0.22, pz, 0.72, 0.22, 0.50);
    }
  }
  // 東西兩側立面壁柱（4 根夾出 3 開間）
  const pilasterCountZ = 4;
  for (let j = 1; j < pilasterCountZ - 1; j++) {
    const pz = cz - (cd * 0.5 - 0.36) + (j / (pilasterCountZ - 1)) * (cd - 0.72);
    for (const side of [-1, 1]) {
      const px = cx + side * (cw * 0.5 - 0.18);
      kit.boxBase('creamLight', px, baseH, pz, 0.42, hallH, 0.58);
      kit.boxBase('limestone', px, baseH, pz, 0.50, 0.24, 0.66);
      kit.boxBase('creamLight', px, baseH + hallH - 0.22, pz, 0.50, 0.22, 0.66);
    }
  }
  // 高窗細框橫樑與上楣牆
  kit.boxBase('creamMain', cx, baseH + hallH - 0.65, cz, cw + 0.04, 0.65, cd + 0.04);
  for (const hOff of [1.48, 2.58]) {
    kit.boxBase('wroughtIron', cx, baseH + hOff, cz, cw - 0.38, 0.06, cd - 0.38);
  }

  // 南向正門入口石材花台（參考圖鐘塔正前方低矮綠植花槽）
  kit.boxBase('creamLight', cx - 2.3, swY, cz + cd * 0.5 + 0.58, 3.2, 0.32, 0.72);
  kit.boxBase('hedge', cx - 2.3, swY + 0.28, cz + cd * 0.5 + 0.58, 2.9, 0.28, 0.50);
  for (let b = -1; b <= 1; b++) {
    kit.cylBase('blossomWhite', cx - 2.3 + b * 0.85, swY + 0.54, cz + cd * 0.5 + 0.58, 0.14, 0.16, 0.08, 6);
  }

  // 挑出古典簷口（Entablature + Stepped Cornice）與屋頂露台鋪面
  const roofY = baseH + hallH;
  kit.boxBase('creamLight', cx, roofY, cz, cw + 0.36, 0.20, cd + 0.36);
  kit.boxBase('creamLight', cx, roofY + 0.20, cz, cw + 0.68, 0.22, cd + 0.68);
  kit.boxBase('limestone', cx, roofY + 0.42, cz, cw + 0.16, 0.12, cd + 0.16);

  const terraceY = roofY + 0.54;
  // 屋頂鍛鐵欄杆（Stage 1 基礎圍欄結構，後續可針對欄杆區塊升級歐式雕花欄杆）
  const railW = cw - 0.15;
  const railD = cd - 0.15;
  const railH = 0.52;
  // 上扶手
  kit.boxBase('wroughtIron', cx, terraceY + railH, cz + railD * 0.5, railW, 0.05, 0.05);
  kit.boxBase('wroughtIron', cx, terraceY + railH, cz - railD * 0.5, railW, 0.05, 0.05);
  kit.boxBase('wroughtIron', cx + railW * 0.5, terraceY + railH, cz, 0.05, 0.05, railD);
  kit.boxBase('wroughtIron', cx - railW * 0.5, terraceY + railH, cz, 0.05, 0.05, railD);
  // 欄杆立柱
  for (let rx = -railW * 0.5; rx <= railW * 0.5 + 0.01; rx += 0.68) {
    kit.boxBase('wroughtIron', cx + rx, terraceY, cz + railD * 0.5, 0.04, railH, 0.04);
    kit.boxBase('wroughtIron', cx + rx, terraceY, cz - railD * 0.5, 0.04, railH, 0.04);
  }
  for (let rz = -railD * 0.5; rz <= railD * 0.5 + 0.01; rz += 0.68) {
    kit.boxBase('wroughtIron', cx + railW * 0.5, terraceY, cz + rz, 0.04, railH, 0.04);
    kit.boxBase('wroughtIron', cx - railW * 0.5, terraceY, cz + rz, 0.04, railH, 0.04);
  }

  // 屋頂轉角小矮燈與盆栽
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = cx + sx * (cw * 0.5 - 0.85);
      const pz = cz + sz * (cd * 0.5 - 0.85);
      kit.cylBase('limestone', px, terraceY, pz, 0.26, 0.20, 0.28, 10);
      kit.cylBase('hedge', px, terraceY + 0.26, pz, 0.24, 0.28, 0.30, 10);
    }
  }

  // ── 中央方形鐘塔（Tower Shaft + 4 面大鐘 + 深板岩四角尖頂） ──
  const tx = cx;
  const tz = cz + 0.25;
  const tw = 2.75;
  const th = 3.75;
  kit.boxBase('limestone', tx, terraceY, tz, tw + 0.28, 0.26, tw + 0.28);
  kit.boxBase('creamMain', tx, terraceY + 0.26, tz, tw, th, tw);
  // 四角壁柱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.boxBase('creamLight', tx + sx * (tw * 0.5 - 0.14), terraceY + 0.26, tz + sz * (tw * 0.5 - 0.14), 0.34, th, 0.34);
    }
  }
  // 鐘面下方百葉小窗（四面）
  kit.boxBase('windowDark', tx, terraceY + 0.58, tz, tw + 0.04, 0.82, 0.68);
  kit.boxBase('windowDark', tx, terraceY + 0.58, tz, 0.68, 0.82, tw + 0.04);

  // 鐘塔頂部挑簷與深灰綠四角金字塔尖頂
  const spireBaseY = terraceY + 0.26 + th;
  kit.boxBase('creamLight', tx, spireBaseY, tz, tw + 0.36, 0.22, tw + 0.36);
  const spireCone = new THREE.ConeGeometry((tw + 0.34) * Math.SQRT1_2, 2.55, 4);
  spireCone.rotateY(Math.PI * 0.25);
  spireCone.translate(tx, spireBaseY + 0.22 + 1.275, tz);
  kit.addGeo('slateSpire', spireCone);
  // 塔尖避雷針飾頂
  kit.cylBase('wroughtIron', tx, spireBaseY + 2.74, tz, 0.025, 0.06, 0.48, 8);

  // 四面圓形大鐘（含可動時針／分針 Group）
  const clockY = terraceY + 2.48;
  const clockRadius = 0.82;
  const clockHands = [];
  const faceDirs = [
    { nx: 0, nz: 1, ry: 0 },
    { nx: 1, nz: 0, ry: Math.PI * 0.5 },
    { nx: 0, nz: -1, ry: Math.PI },
    { nx: -1, nz: 0, ry: -Math.PI * 0.5 },
  ];

  for (const d of faceDirs) {
    const fxPos = tx + d.nx * (tw * 0.5 + 0.03);
    const fzPos = tz + d.nz * (tw * 0.5 + 0.03);
    // 鐘盤圓面與外鐵環
    const dialGeo = new THREE.CylinderGeometry(clockRadius, clockRadius, 0.06, 28);
    dialGeo.rotateX(Math.PI * 0.5);
    dialGeo.rotateY(d.ry);
    dialGeo.translate(fxPos, clockY, fzPos);
    kit.addGeo('clockFace', dialGeo);

    const rimGeo = new THREE.TorusGeometry(clockRadius, 0.055, 8, 28);
    rimGeo.rotateY(d.ry);
    rimGeo.translate(fxPos + d.nx * 0.02, clockY, fzPos + d.nz * 0.02);
    kit.addGeo('wroughtIron', rimGeo);

    // 12 刻度點
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const rTick = clockRadius * 0.80;
      const tickGeo = new THREE.BoxGeometry(k % 3 === 0 ? 0.06 : 0.035, k % 3 === 0 ? 0.14 : 0.08, 0.03);
      const m = new THREE.Matrix4()
        .makeTranslation(fxPos + d.nx * 0.04, clockY, fzPos + d.nz * 0.04)
        .multiply(new THREE.Matrix4().makeRotationY(d.ry))
        .multiply(new THREE.Matrix4().makeRotationZ(ang))
        .multiply(new THREE.Matrix4().makeTranslation(0, rTick, 0));
      kit.addGeo('wroughtIron', tickGeo, m);
    }

    // 動態指針樞紐
    const pivot = new THREE.Group();
    pivot.position.set(fxPos + d.nx * 0.055, clockY, fzPos + d.nz * 0.055);
    pivot.rotation.y = d.ry;

    const hourPivot = new THREE.Group();
    const hourMesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.025), materials.wroughtIron);
    hourMesh.position.y = 0.17;
    hourPivot.add(hourMesh);

    const minPivot = new THREE.Group();
    const minMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.025), materials.wroughtIron);
    minMesh.position.y = 0.26;
    minPivot.add(minMesh);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), materials.wroughtIron);
    cap.rotation.x = Math.PI * 0.5;
    pivot.add(hourPivot, minPivot, cap);
    group.add(pivot);
    clockHands.push({ hourPivot, minPivot });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. 露天咖啡圓桌、座椅、奶油八角陽傘與公園長椅（重現參考圖廣場生活氛圍）
  // ─────────────────────────────────────────────────────────────
  const addCafeUmbrellaSet = (ux, uz, baseY = plazaY, hasUmbrella = true) => {
    // 圓木桌
    kit.cylBase('wroughtIron', ux, baseY, uz, 0.05, 0.22, 0.72, 8);
    kit.cylBase('woodWarm', ux, baseY + 0.72, uz, 0.62, 0.62, 0.06, 14);
    // 四張環繞咖啡椅
    for (let c = 0; c < 4; c++) {
      const a = c * Math.PI * 0.5 + 0.35;
      const chx = ux + Math.cos(a) * 0.92;
      const chz = uz + Math.sin(a) * 0.92;
      kit.boxBase('woodWarm', chx, baseY + 0.40, chz, 0.38, 0.05, 0.38, -a);
      kit.boxBase('wroughtIron', chx, baseY, chz, 0.30, 0.40, 0.30, -a);
      // 椅背
      const bx = chx + Math.cos(a) * 0.16;
      const bz = chz + Math.sin(a) * 0.16;
      kit.boxBase('woodWarm', bx, baseY + 0.42, bz, 0.05, 0.42, 0.36, -a);
    }
    if (hasUmbrella) {
      kit.cylBase('wroughtIron', ux, baseY + 0.75, uz, 0.035, 0.035, 1.58, 8);
      const umb = new THREE.ConeGeometry(1.38, 0.52, 8, 1, true);
      umb.translate(ux, baseY + 2.15, uz);
      kit.addGeo('fabricCream', umb);
      kit.cylBase('woodWarm', ux, baseY + 2.40, uz, 0.05, 0.08, 0.10, 8);
    }
    decals.add(ux, baseY + 0.01, uz, 2.5, 2.5, 0.28);
  };

  // 對照參考圖配置露天傘座（街角咖啡館前、噴泉四周、鐘塔西側）
  addCafeUmbrellaSet(-8.8, 8.2, plazaY, true);
  addCafeUmbrellaSet(-5.6, 8.0, plazaY, true);
  addCafeUmbrellaSet(-6.6, 10.8, plazaY, true);
  addCafeUmbrellaSet(-1.8, 3.3, plazaY, true);
  addCafeUmbrellaSet(6.2, 6.2, plazaY, true);
  addCafeUmbrellaSet(5.8, 12.2, plazaY, false);
  addCafeUmbrellaSet(8.2, 12.6, plazaY, true);

  // 廣場木製長椅
  const addBench = (bx, bz, ry = 0) => {
    kit.boxBase('woodWarm', bx, plazaY + 0.38, bz, 1.45, 0.07, 0.46, ry);
    const sinR = Math.sin(ry), cosR = Math.cos(ry);
    kit.boxBase('woodWarm', bx - sinR * 0.19, plazaY + 0.44, bz - cosR * 0.19, 1.45, 0.42, 0.06, ry);
    kit.boxBase('wroughtIron', bx + cosR * 0.58, plazaY, bz - sinR * 0.58, 0.10, 0.42, 0.44, ry);
    kit.boxBase('wroughtIron', bx - cosR * 0.58, plazaY, bz + sinR * 0.58, 0.10, 0.42, 0.44, ry);
    decals.add(bx, plazaY + 0.01, bz, 1.8, 0.9, 0.26, ry);
  };

  addBench(-8.2, 13.0, 0);
  addBench(1.2, 13.5, 0);
  addBench(-9.6, 5.8, Math.PI * 0.5);
  addBench(8.4, 3.6, -Math.PI * 0.25);

  group.add(kit.build(materials));

  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();

  function update(elapsed) {
    // 時鐘走動（預設指向約 10:10 並隨時間緩慢推進，視覺優雅對稱）
    const baseMinutes = 10 * 60 + 10 + elapsed * 0.6;
    const minAngle = -((baseMinutes % 60) / 60) * Math.PI * 2;
    const hourAngle = -(((baseMinutes / 60) % 12) / 12) * Math.PI * 2;
    for (const h of clockHands) {
      h.minPivot.rotation.z = minAngle;
      h.hourPivot.rotation.z = hourAngle;
    }

    // 噴泉雙層水花粒子弧線
    for (let i = 0; i < dropCount; i++) {
      const phase = ((elapsed * 0.95 + i / dropCount) % 1);
      const ang = (i / dropCount) * Math.PI * 2 * 3.0 + i * 0.7;
      const isUpper = i % 2 === 0;
      const startY = plazaY + (isUpper ? 2.22 : 1.36);
      const maxR = isUpper ? 0.85 : 2.15;
      const r = (isUpper ? 0.06 : 0.46) + phase * maxR;
      const arcY = startY + (isUpper ? 0.52 : 0.34) * Math.sin(phase * Math.PI) - phase * phase * (isUpper ? 1.05 : 1.02);
      const sc = (1.0 - Math.abs(phase - 0.45)) * 0.95 + 0.25;
      _p.set(fx + Math.cos(ang) * r, Math.max(plazaY + 0.36, arcY), fz + Math.sin(ang) * r);
      _s.setScalar(sc);
      _m.compose(_p, _q, _s);
      dropsMesh.setMatrixAt(i, _m);
    }
    dropsMesh.instanceMatrix.needsUpdate = true;
  }

  update(0);
  return { group, update };
}
