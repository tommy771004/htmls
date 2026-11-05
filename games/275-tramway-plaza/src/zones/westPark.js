// 區塊 4：西側自然水景公園、有機曲線池塘、岸邊景石與八角木造涼亭
import * as THREE from 'three';
import { PLINTH } from '../config.js';
import { GeoKit, normalizeGeo } from '../kit.js';

function makeRoundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  const hw = w * 0.5, hd = d * 0.5;
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}

function makeKidneyPondShape() {
  const s = new THREE.Shape();
  s.moveTo(-3.6, -2.2);
  s.bezierCurveTo(-1.2, -3.4, 2.6, -3.1, 3.8, -1.2);
  s.bezierCurveTo(4.6, 0.2, 3.5, 2.4, 1.4, 2.7);
  s.bezierCurveTo(-0.4, 2.9, -1.1, 1.8, -2.4, 2.2);
  s.bezierCurveTo(-4.1, 2.6, -4.8, 0.4, -3.6, -2.2);
  return s;
}

export function buildWestPark(materials, decals, treeSlots, shrubSlots) {
  const group = new THREE.Group();
  group.name = 'zone_west_park';
  const kit = new GeoKit();
  const swY = PLINTH.sidewalkY;

  const parkX = -23.8;
  const parkZ = -4.6;
  const parkW = 11.4;
  const parkD = 20.6;

  // 1. 圓角石砌路緣與綠茵草坪島
  const curbGeo = new THREE.ExtrudeGeometry(makeRoundedRectShape(parkW + 0.44, parkD + 0.44, 2.4), {
    depth: 0.13,
    bevelEnabled: false,
    curveSegments: 16,
  });
  curbGeo.rotateX(-Math.PI * 0.5);
  curbGeo.translate(parkX, swY, parkZ);
  kit.addGeo('limestone', curbGeo);

  const lawnGeo = new THREE.ExtrudeGeometry(makeRoundedRectShape(parkW, parkD, 2.2), {
    depth: 0.15,
    bevelEnabled: false,
    curveSegments: 16,
  });
  lawnGeo.rotateX(-Math.PI * 0.5);
  lawnGeo.translate(parkX, swY, parkZ);
  kit.addGeo('grass', lawnGeo);

  const lawnY = swY + 0.15;

  // 2. 有機曲線景觀水池（池岸石框 + 動態波紋水面 + 池畔鵝卵石群）
  const pondX = -24.2;
  const pondZ = -1.6;
  const pondShape = makeKidneyPondShape();

  const pondRim = new THREE.ExtrudeGeometry(pondShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.24,
    bevelSegments: 2,
    curveSegments: 20,
  });
  pondRim.rotateX(-Math.PI * 0.5);
  pondRim.translate(pondX, lawnY - 0.015, pondZ);
  kit.addGeo('rockStone', pondRim);

  const pondWaterGeo = normalizeGeo(new THREE.ShapeGeometry(pondShape, 24));
  pondWaterGeo.rotateX(-Math.PI * 0.5);
  pondWaterGeo.scale(0.97, 1, 0.97);
  pondWaterGeo.translate(pondX, lawnY + 0.055, pondZ);
  const pondWater = new THREE.Mesh(pondWaterGeo, materials.water);
  pondWater.receiveShadow = true;
  group.add(pondWater);

  // 池岸自然景石與灌木叢（對齊參考圖左側水池周圍錯落石塊與綠叢）
  const pts = pondShape.getSpacedPoints(26);
  pts.forEach((pt, idx) => {
    const rx = pondX + pt.x * 1.04;
    const rz = pondZ - pt.y * 1.04; // rotateX(π/2) 對應 Z 符號
    if (idx % 2 === 0) {
      const rScale = 0.22 + ((idx * 17) % 7) * 0.045;
      const rock = new THREE.DodecahedronGeometry(rScale, 0);
      rock.scale(1.25, 0.62, 0.95);
      rock.rotateY(idx * 0.9);
      rock.translate(rx, lawnY + rScale * 0.25, rz);
      kit.addGeo('rockStone', rock);
    }
    if (idx % 3 === 0) {
      shrubSlots.push({ x: pondX + pt.x * 1.15, y: lawnY, z: pondZ - pt.y * 1.15, scale: 0.85 + (idx % 3) * 0.16 });
    }
  });

  // 3. 池畔八角木造涼亭（Octagonal Timber Gazebo，對應參考圖水池右上方暖光木亭！）
  const gx = -20.9;
  const gz = -8.1;
  const gR = 1.82;

  // 八角木平台與石礎
  kit.cylBase('limestone', gx, lawnY, gz, gR + 0.16, gR + 0.22, 0.16, 8);
  kit.cylBase('woodWarm', gx, lawnY + 0.16, gz, gR, gR, 0.12, 8);
  decals.add(gx, lawnY + 0.01, gz, 4.6, 4.6, 0.36);

  const deckTop = lawnY + 0.28;
  const postH = 2.05;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = gx + Math.cos(a) * (gR - 0.20);
    const pz = gz + Math.sin(a) * (gR - 0.20);
    kit.cylBase('woodWarm', px, deckTop, pz, 0.075, 0.085, postH, 8);

    // 除朝向水池與步道兩面開口外，其餘六面設木欄杆與長凳
    if (i !== 1 && i !== 5) {
      const aNext = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
      const mx = gx + ((Math.cos(a) + Math.cos(aNext)) * 0.5) * (gR - 0.20);
      const mz = gz + ((Math.sin(a) + Math.sin(aNext)) * 0.5) * (gR - 0.20);
      const segLen = 2 * (gR - 0.20) * Math.sin(Math.PI / 8);
      const yaw = -((a + aNext) * 0.5);
      kit.boxBase('woodWarm', mx, deckTop + 0.62, mz, 0.06, 0.06, segLen, yaw);
      kit.boxBase('woodWarm', mx, deckTop + 0.34, mz, 0.26, 0.05, segLen * 0.92, yaw);
    }
  }

  // 涼亭內暖光吊燈（營造參考圖中涼亭內溫暖橘黃光暈）
  kit.cylBase('lampGlow', gx, deckTop + postH - 0.38, gz, 0.22, 0.16, 0.28, 10);

  // 雙層八角深木瓦攢尖頂
  const roof1 = new THREE.ConeGeometry(gR + 0.42, 0.98, 8);
  roof1.rotateY(Math.PI / 8);
  roof1.translate(gx, deckTop + postH + 0.46, gz);
  kit.addGeo('woodDark', roof1);

  const roof2 = new THREE.ConeGeometry(0.76, 0.56, 8);
  roof2.rotateY(Math.PI / 8);
  roof2.translate(gx, deckTop + postH + 1.02, gz);
  kit.addGeo('woodDark', roof2);
  kit.cylBase('wroughtIron', gx, deckTop + postH + 1.28, gz, 0.03, 0.06, 0.26, 8);

  // 4. 公園周邊喬木配置（環繞水池西側與北側，保留等角主視角對藍色水池與涼亭的清晰通透視線）
  const parkTrees = [
    [-28.2, -13.6, 1.08],
    [-23.8, -14.2, 1.02],
    [-19.6, -13.6, 1.12],
    [-18.6, -3.6, 1.08],
    [-28.6, -5.8, 0.98],
    [-28.5, 0.6, 0.96],
    [-28.0, 4.4, 1.04],
  ];
  for (const [tx, tz, sc] of parkTrees) {
    treeSlots.push({ x: tx, y: lawnY, z: tz, scale: sc, kind: 'park' });
    decals.add(tx, lawnY + 0.01, tz, 2.5 * sc, 2.5 * sc, 0.28);
  }

  group.add(kit.build(materials));
  return group;
}
