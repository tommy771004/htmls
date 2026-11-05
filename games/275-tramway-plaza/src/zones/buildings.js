// 區塊 2：奶油色歐風建築群（Stage 1 整體配置與基礎立面語彙；預留門窗／欄杆／屋簷／植栽逐區細修結構）
import * as THREE from 'three';
import { PLINTH, BUILDINGS } from '../config.js';
import { GeoKit } from '../kit.js';

export function buildEuropeanBuildings(materials, decals, rooftopPlantSlots) {
  const group = new THREE.Group();
  group.name = 'zone_buildings';
  const kit = new GeoKit();
  const swY = PLINTH.sidewalkY;

  for (const b of BUILDINGS) {
    const totalH = b.floors * b.floorH;
    const basePlinthH = 0.24;
    const wallY0 = swY + basePlinthH;

    // 1. 石材台基與接觸陰影
    kit.boxBase('limestone', b.x, swY, b.z, b.w + 0.26, basePlinthH, b.d + 0.26);
    decals.add(b.x, swY + 0.015, b.z, b.w + 2.1, b.d + 2.1, 0.40);

    // 2. 主牆體（使用 r187 NodeMaterialInstance 奶油灰泥系列）
    kit.boxBase(b.matKey, b.x, wallY0, b.z, b.w, totalH, b.d);

    // 四角古典隅石／壁柱收邊
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        kit.boxBase(
          'creamLight',
          b.x + sx * (b.w * 0.5 - 0.14),
          wallY0,
          b.z + sz * (b.d * 0.5 - 0.14),
          0.34,
          totalH,
          0.34,
        );
      }
    }

    // 樓層間水平腰線（String Course）
    for (let f = 1; f < b.floors; f++) {
      const bandY = wallY0 + f * b.floorH - 0.08;
      kit.boxBase('creamLight', b.x, bandY, b.z, b.w + 0.16, 0.14, b.d + 0.16);
    }

    // 3. 基礎門窗配置（暖琥珀室內光窗洞 + 簡潔窗框與窗台，後續可逐區細修法式落地窗、百葉與拱楣）
    const placeFacadeWindows = (alongX) => {
      const bays = alongX ? b.baysX : b.baysZ;
      const span = (alongX ? b.w : b.d) - 1.75;
      const winW = Math.min(1.06, (span / bays) * 0.62);

      for (let f = 0; f < b.floors; f++) {
        const isGround = f === 0;
        const winH = isGround ? b.floorH * 0.68 : b.floorH * 0.62;
        const wy = wallY0 + f * b.floorH + (isGround ? 0.22 : 0.42);

        for (let i = 0; i < bays; i++) {
          const offset = bays === 1 ? 0 : -span * 0.5 + (i / (bays - 1)) * span;
          for (const side of [-1, 1]) {
            if (alongX) {
              const wx = b.x + offset;
              const wz = b.z + side * (b.d * 0.5 + 0.01);
              kit.boxBase('windowWarm', wx, wy, wz, winW, winH, 0.06);
              // 簡潔十字窗櫺與石窗台
              kit.boxBase('wroughtIron', wx, wy, wz + side * 0.025, 0.04, winH, 0.03);
              kit.boxBase('wroughtIron', wx, wy + winH * 0.52, wz + side * 0.025, winW, 0.04, 0.03);
              kit.boxBase('limestone', wx, wy - 0.08, wz + side * 0.05, winW + 0.16, 0.08, 0.16);
            } else {
              const wx = b.x + side * (b.w * 0.5 + 0.01);
              const wz = b.z + offset;
              kit.boxBase('windowWarm', wx, wy, wz, 0.06, winH, winW);
              kit.boxBase('wroughtIron', wx + side * 0.025, wy, wz, 0.03, winH, 0.04);
              kit.boxBase('wroughtIron', wx + side * 0.025, wy + winH * 0.52, wz, 0.03, 0.04, winW);
              kit.boxBase('limestone', wx + side * 0.05, wy - 0.08, wz, 0.16, 0.08, winW + 0.16);
            }
          }
        }
      }
    };
    placeFacadeWindows(true);
    placeFacadeWindows(false);

    // 4. 一樓店面奶油帆布斜雨棚（街角咖啡館與西街轉角店）
    const awningY = wallY0 + b.floorH * 0.76;
    if (b.awnings.includes('south')) {
      kit.box(
        'fabricCream',
        b.x,
        awningY,
        b.z + b.d * 0.5 + 0.62,
        b.w - 0.7,
        0.08,
        1.35,
        0.34,
        0,
        0,
      );
    }
    if (b.awnings.includes('west')) {
      kit.box(
        'fabricCream',
        b.x - b.w * 0.5 - 0.58,
        awningY,
        b.z,
        1.28,
        0.08,
        b.d - 0.8,
        0,
        0,
        0.34,
      );
    }
    // 街角咖啡館西側二樓小陽台（對應參考圖細節）
    if (b.id === 'cafe') {
      const balY = wallY0 + b.floorH;
      kit.boxBase('creamLight', b.x - b.w * 0.5 - 0.36, balY - 0.12, b.z - 0.9, 0.78, 0.16, 2.2);
      kit.boxBase('wroughtIron', b.x - b.w * 0.5 - 0.70, balY + 0.04, b.z - 0.9, 0.04, 0.52, 2.1);
    }

    // 5. 屋頂挑簷線腳與女兒牆／基礎欄杆
    const roofBaseY = wallY0 + totalH;
    kit.boxBase('creamLight', b.x, roofBaseY, b.z, b.w + 0.24, 0.15, b.d + 0.24);
    kit.boxBase('creamLight', b.x, roofBaseY + 0.15, b.z, b.w + 0.46, 0.18, b.d + 0.46);
    kit.boxBase('limestone', b.x, roofBaseY + 0.33, b.z, b.w + 0.12, 0.10, b.d + 0.12);

    const roofDeckY = roofBaseY + 0.43;
    // 屋頂四周低矮石女兒牆墩 + 簡潔鐵欄杆
    const rw = b.w - 0.18;
    const rd = b.d - 0.18;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        kit.boxBase('creamLight', b.x + sx * rw * 0.5, roofDeckY, b.z + sz * rd * 0.5, 0.32, 0.50, 0.32);
      }
    }
    kit.boxBase('wroughtIron', b.x, roofDeckY + 0.44, b.z + rd * 0.5, rw, 0.045, 0.045);
    kit.boxBase('wroughtIron', b.x, roofDeckY + 0.44, b.z - rd * 0.5, rw, 0.045, 0.045);
    kit.boxBase('wroughtIron', b.x + rw * 0.5, roofDeckY + 0.44, b.z, 0.045, 0.045, rd);
    kit.boxBase('wroughtIron', b.x - rw * 0.5, roofDeckY + 0.44, b.z, 0.045, 0.045, rd);

    // 6. 屋頂退縮閣樓（Penthouse）與空中花園植栽槽
    if (b.penthouse) {
      const p = b.penthouse;
      const px = b.x + p.ox;
      const pz = b.z + p.oz;
      kit.boxBase('limestone', px, roofDeckY, pz, p.w + 0.16, 0.14, p.d + 0.16);
      kit.boxBase(b.matKey, px, roofDeckY + 0.14, pz, p.w, p.h, p.d);
      kit.boxBase('windowWarm', px, roofDeckY + 0.36, pz, p.w + 0.04, p.h * 0.56, p.d * 0.46);
      kit.boxBase('windowWarm', px, roofDeckY + 0.36, pz, p.w * 0.46, p.h * 0.56, p.d + 0.04);
      const pTop = roofDeckY + 0.14 + p.h;
      kit.boxBase('creamLight', px, pTop, pz, p.w + 0.28, 0.18, p.d + 0.28);

      if (p.garden) {
        kit.boxBase('limestone', px, pTop + 0.18, pz, p.w - 0.35, 0.18, p.d - 0.35);
        kit.boxBase('hedge', px, pTop + 0.32, pz, p.w - 0.65, 0.22, p.d - 0.65);
        rooftopPlantSlots.push({ x: px, y: pTop + 0.42, z: pz, w: p.w * 0.7, d: p.d * 0.7 });
      }
    }

    // 街角咖啡館屋頂水塔與露天座席（對照參考圖中左那棟二樓屋頂的深色圓水塔與小陽傘！）
    if (b.waterTank) {
      const wx = b.x + b.w * 0.28;
      const wz = b.z - b.d * 0.24;
      kit.boxBase('wroughtIron', wx, roofDeckY, wz, 0.95, 0.45, 0.95);
      kit.cylBase('woodDark', wx, roofDeckY + 0.45, wz, 0.62, 0.62, 1.28, 16);
      kit.cylBase('wroughtIron', wx, roofDeckY + 1.73, wz, 0.08, 0.66, 0.28, 16);
    }
    if (b.rooftopCafe) {
      const ux = b.x - 1.1;
      const uz = b.z + 0.4;
      kit.cylBase('woodWarm', ux, roofDeckY + 0.52, uz, 0.52, 0.52, 0.06, 12);
      kit.cylBase('wroughtIron', ux, roofDeckY, uz, 0.05, 0.18, 0.52, 8);
      const umb = new THREE.ConeGeometry(1.12, 0.42, 8, 1, true);
      umb.translate(ux, roofDeckY + 1.65, uz);
      kit.addGeo('fabricCream', umb);
      kit.cylBase('wroughtIron', ux, roofDeckY + 0.55, uz, 0.03, 0.03, 1.25, 8);
      rooftopPlantSlots.push({ x: b.x - 1.8, y: roofDeckY + 0.1, z: b.z - 1.6, w: 1.6, d: 1.2 });
    }
  }

  group.add(kit.build(materials));
  return group;
}
