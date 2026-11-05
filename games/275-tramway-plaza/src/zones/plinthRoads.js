// 區塊 0：微縮模型底座、沉降式柏油街道、斑馬線、綠帶與古典街燈
import * as THREE from 'three';
import { PLINTH, ROADS } from '../config.js';
import { GeoKit } from '../kit.js';

export function buildPlinthAndRoads(materials, decals, treeSlots) {
  const group = new THREE.Group();
  group.name = 'zone_plinth_roads';
  const kit = new GeoKit();

  const hx = PLINTH.halfX;
  const hz = PLINTH.halfZ;
  const rY = PLINTH.roadY;
  const swY = PLINTH.sidewalkY;
  const swH = swY - rY;

  // 1. 桌面無縫柔光箱接觸陰影墊
  const shadowPad = new THREE.Mesh(new THREE.PlaneGeometry(132, 98), materials.tabletopShadow);
  shadowPad.rotation.x = -Math.PI * 0.5;
  shadowPad.position.set(3.0, -PLINTH.thickness + 0.02, -1.0);
  shadowPad.receiveShadow = false;
  shadowPad.castShadow = false;
  group.add(shadowPad);

  // 2. 微縮底座主體（石灰岩側邊 + 底層柏油高程）
  kit.box('limestone', 0, rY - PLINTH.thickness * 0.5, 0, hx * 2, PLINTH.thickness, hz * 2);
  // 底座底部一圈極細裝飾線腳
  kit.box('creamLight', 0, rY - PLINTH.thickness + 0.06, 0, hx * 2 + 0.18, 0.12, hz * 2 + 0.18);

  // 全幅柏油底層（人行道街廓會疊在上方形成 7cm 實體路緣石高低差）
  kit.box('asphalt', 0, rY - 0.01, 0, hx * 2 - 0.36, 0.025, hz * 2 - 0.36);

  // 3. 人行道街廓（精確切分，預留五條車道）
  const addSidewalkRect = (x0, z0, x1, z1) => {
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const w = x1 - x0;
    const d = z1 - z0;
    // 外圈奶油石材路緣 + 內側人行道鋪面
    kit.boxBase('limestone', cx, rY, cz, w, swH * 0.96, d);
    kit.boxBase('sidewalk', cx, rY + 0.004, cz, Math.max(0.2, w - 0.22), swH, Math.max(0.2, d - 0.22));
  };

  // 外環人行道邊帶
  addSidewalkRect(-hx, 20.4, hx, hz);          // 南側最外緣人行道
  addSidewalkRect(30.2, -hz, hx, 20.4);        // 東側最外緣人行道
  addSidewalkRect(-hx, -hz, -30.6, 16.0);      // 西側最外緣人行道
  addSidewalkRect(-30.6, -hz, 30.2, -20.8);    // 北側最外緣人行道

  // 三大核心街廓人行道基底
  // (A) 西側公園與轉角店街廓：X ∈ [-30.6, -17.0], Z ∈ [-16.4, +16.0]
  addSidewalkRect(-30.6, -16.4, -17.0, 16.0);
  // (B) 中央噴泉鐘塔廣場街廓：X ∈ [-12.6, +25.8], Z ∈ [-0.2, +16.0]
  addSidewalkRect(-12.6, -0.2, 25.8, 16.0);
  // (C) 北側環狀高架公寓群街廓：X ∈ [-12.6, +25.8], Z ∈ [-16.4, -4.6]
  addSidewalkRect(-12.6, -16.4, 25.8, -4.6);

  // 高架軌道下方的景觀綠帶花圃（對齊參考圖中央高架橋墩旁狹長植栽帶）
  const addGreenStrip = (x0, z0, x1, z1) => {
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const w = x1 - x0;
    const d = z1 - z0;
    kit.boxBase('creamLight', cx, swY, cz, w, 0.14, d);
    kit.boxBase('grass', cx, swY + 0.04, cz, w - 0.22, 0.13, d - 0.22);
  };
  addGreenStrip(-2.2, -0.05, 13.8, 1.05);
  addGreenStrip(-10.5, -6.1, 18.5, -4.8);
  // 北側公寓間的中庭草坪
  addGreenStrip(-5.4, -15.4, 17.2, -13.6);
  addGreenStrip(7.6, -12.8, 9.0, -6.6);

  // 4. 車道白色虛線與斑馬線（Zebra Crossings）
  const lineY = rY + 0.008;
  const addDashedX = (xStart, xEnd, z) => {
    for (let x = xStart; x <= xEnd - 1.1; x += 2.8) {
      kit.boxBase('roadLine', x + 0.6, lineY, z, 1.25, 0.008, 0.13);
    }
  };
  const addDashedZ = (zStart, zEnd, x) => {
    for (let z = zStart; z <= zEnd - 1.1; z += 2.8) {
      kit.boxBase('roadLine', x, lineY, z + 0.6, 0.13, 0.008, 1.25);
    }
  };

  // 南側大道虛線（避開路口斑馬線）
  addDashedX(-26.8, -17.8, ROADS.southZ);
  addDashedX(-11.6, 24.8, ROADS.southZ);
  // 東側大道虛線
  addDashedZ(-14.8, -5.4, ROADS.eastX);
  addDashedZ(0.8, 15.0, ROADS.eastX);
  // 西中縱向道虛線
  addDashedZ(-15.2, 14.8, ROADS.westMidX);
  // 高架下橫道虛線
  addDashedX(-11.4, 14.2, ROADS.midViaductZ);
  addDashedX(18.6, 24.6, ROADS.midViaductZ);
  // 北側後環道虛線
  addDashedX(-29.0, 24.6, ROADS.northBackZ);

  // 斑馬線繪製函式（acrossX = true 表橫跨東西向車道，條紋沿 X 走向）
  const addCrosswalk = (cx, cz, acrossRoadDir = 'x') => {
    const stripes = 6;
    const span = 3.7;
    const step = span / stripes;
    for (let i = 0; i < stripes; i++) {
      const offset = -span * 0.5 + (i + 0.5) * step;
      if (acrossRoadDir === 'x') {
        // 車道為東西向，行人南北穿越，條紋平行車道（長 1.7m）
        kit.boxBase('roadLine', cx, lineY, cz + offset, 1.75, 0.009, 0.30);
      } else {
        // 車道為南北向，行人東西穿越
        kit.boxBase('roadLine', cx + offset, lineY, cz, 0.30, 0.009, 1.75);
      }
    }
  };

  // 對照參考圖配置所有路口斑馬線
  addCrosswalk(-28.4, ROADS.southZ, 'x');        // 左下角西端斑馬線
  addCrosswalk(-18.2, ROADS.southZ, 'x');        // 西中丁字路口西側
  addCrosswalk(-11.4, ROADS.southZ, 'x');        // 西中丁字路口東側
  addCrosswalk(ROADS.westMidX, 14.8, 'z');       // 西中丁字路口北側
  addCrosswalk(24.6, ROADS.southZ, 'x');         // 東南路口西側
  addCrosswalk(ROADS.eastX, 14.8, 'z');          // 東南路口北側
  addCrosswalk(ROADS.eastX, 0.9, 'z');           // 車站階梯旁東路斑馬線
  addCrosswalk(ROADS.eastX, -5.7, 'z');          // 東路高架北側斑馬線
  addCrosswalk(24.6, ROADS.midViaductZ, 'x');    // 高架下橫道東口
  addCrosswalk(16.2, ROADS.midViaductZ, 'x');    // 高架車站下方斑馬線
  addCrosswalk(ROADS.eastX, -15.3, 'z');         // 東北彎道旁斑馬線

  // 5. 行道樹白色方框樹穴（同時將座標註冊進 treeSlots 供植栽模組種樹）
  const addStreetTree = (x, z, scale = 1.0, pit = true) => {
    if (pit) {
      kit.boxBase('creamLight', x, swY, z, 1.18, 0.09, 1.18);
      kit.boxBase('woodDark', x, swY + 0.05, z, 0.88, 0.06, 0.88);
      decals.add(x, swY + 0.01, z, 2.4 * scale, 2.4 * scale, 0.28);
    }
    treeSlots.push({ x, y: swY + (pit ? 0.08 : 0.02), z, scale, kind: 'street' });
  };

  // 南側人行道行道樹列（對齊參考圖前景左下至右下整排綠樹）
  for (const x of [-29.8, -20.5, -10.6, -4.5, 2.4, 8.8, 22.4]) {
    addStreetTree(x, 15.15, 0.96 + ((Math.abs(x * 7) % 10) * 0.018));
  }
  // 西中縱向道兩側行道樹
  for (const z of [12.4, 7.2, 1.8, -4.2]) {
    addStreetTree(-11.75, z, 1.04);
  }
  addStreetTree(-17.85, 8.6, 0.95);
  addStreetTree(-17.85, 2.5, 1.02);

  // 東側人行道行道樹列（鐘塔與高架階梯前方整排綠樹）
  for (const z of [14.2, 9.6, 5.2, -7.2, -13.5]) {
    addStreetTree(24.85, z, 0.95);
  }
  // 東北彎道外側點綴樹
  addStreetTree(31.05, -13.5, 0.92);
  addStreetTree(31.05, -18.2, 0.88);

  // 高架橋下綠帶行道樹
  for (const x of [-1.2, 4.8, 10.6, 15.2]) {
    addStreetTree(x, 0.5, 0.92, true);
  }

  // 6. 古典鍛鐵街燈（InstancedMesh：燈柱 + 暖光燈籠）
  const lampCoords = [
    [-25.5, 15.3], [-19.0, 15.3], [-8.2, 15.3], [-1.2, 15.3], [5.8, 15.3], [12.0, 15.3], [20.8, 15.3],
    [24.9, 12.0], [24.9, 2.6], [24.9, -6.2], [24.9, -11.5],
    [-11.8, 10.2], [-11.8, 4.6], [-18.0, 12.6], [-18.0, -2.0], [-18.0, -11.0],
    [-4.8, 8.8], [-3.2, 11.8], [6.4, 11.8], [7.2, 5.4],
    [2.0, -0.1], [12.5, -0.1], [19.0, 2.0],
  ];

  // 將古典街燈底座與燈桿以 InstancedMesh 批次繪製（僅 2 Draw Calls）
  const postGeo = new THREE.CylinderGeometry(0.055, 0.095, 2.45, 8);
  postGeo.translate(0, 1.225, 0);
  const lanternGeo = new THREE.SphereGeometry(0.16, 10, 8);
  lanternGeo.scale(0.85, 1.18, 0.85);
  lanternGeo.translate(0, 2.52, 0);

  const posts = new THREE.InstancedMesh(postGeo, materials.wroughtIron, lampCoords.length);
  const bulbs = new THREE.InstancedMesh(lanternGeo, materials.lampGlow, lampCoords.length);
  posts.castShadow = true;
  posts.receiveShadow = false;
  bulbs.castShadow = false;

  const m4 = new THREE.Matrix4();
  lampCoords.forEach(([lx, lz], i) => {
    m4.makeTranslation(lx, swY, lz);
    posts.setMatrixAt(i, m4);
    bulbs.setMatrixAt(i, m4);
    decals.add(lx, swY + 0.015, lz, 0.65, 0.65, 0.30);
  });
  posts.instanceMatrix.needsUpdate = true;
  bulbs.instanceMatrix.needsUpdate = true;

  group.add(kit.build(materials));
  group.add(posts, bulbs);
  return group;
}
