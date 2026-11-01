// 六器鏢行 — 程式建模的入口：三張地圖場景、怪物、偃甲、開場大堂，以及每張地圖的天色與光
//
// 實作分在同資料夾：kit.js（合併幾何與共用材質）、scenery.js（三張地圖）、creatures.js（怪物與練功樁）、
// mech.js（偃甲三階）、hall.js（鏢局大堂）。骨架人物在 chars.js，兵器與六器匣在 weapons.js。
import { buildMapSceneryV2 } from './scenery.js';

export { buildCreature } from './creatures.js';
export { buildMechRig, updateMechAppearance } from './mech.js';
export { buildIntroHall, HALL_ORIGIN } from './hall.js';

// 每張地圖的天色、霧、日光（scene.js 的 applyMapLook 讀這張表）
export const MAP_LOOK = {
  // 青萍渡：傍晚前的暖陽，河上起一點薄霧
  1001: {
    top: 0x46688a, horizon: 0xdcc8a2, fog: 0xc9b896, fogNear: 38, fogFar: 150,
    sunDir: [0.55, 0.62, 0.3], sun: 0xffd9a8, sunI: 2.7, sunGlow: 0xffc27a,
    hemiSky: 0xbfd0de, hemiGround: 0x6a5a40, hemiI: 0.95,
    exposure: 1.0, rim: 0xffe2b8, rimK: 0.22, envGround: 0x5e5240, envI: 0.85, heroGlow: 0,
  },
  // 赤沙驛：烈日將斜，黃沙反光
  1002: {
    top: 0x4f7fae, horizon: 0xebc590, fog: 0xd9b07c, fogNear: 34, fogFar: 140,
    sunDir: [-0.5, 0.6, 0.38], sun: 0xffe2b4, sunI: 3.1, sunGlow: 0xffd28a,
    hemiSky: 0xd6e2ee, hemiGround: 0xa06c40, hemiI: 1.0,
    exposure: 0.95, rim: 0xffd8a0, rimK: 0.24, envGround: 0x9a6a40, envI: 0.9, heroGlow: 0,
  },
  // 偃師遺墟：夜，月光冷白，地脈冷綠
  2001: {
    top: 0x080a10, horizon: 0x2b3232, fog: 0x1e2425, fogNear: 22, fogFar: 100,
    sunDir: [0.35, 0.7, 0.45], sun: 0xb4d4e4, sunI: 2.0, sunGlow: 0xcfe8f0,
    hemiSky: 0x7a94a0, hemiGround: 0x3d3a30, hemiI: 1.3,
    exposure: 1.25, rim: 0x9ad6c0, rimK: 0.28, envGround: 0x26241e, envI: 1.0, heroGlow: 14,
    envTop: 0x22384a, envHorizon: 0x4f7a70, // 金屬（銅骨傀儡、偃甲）要有東西可反射，環境圖比天空亮
  },
};

/**
 * 建立地圖場景：回傳 { group, npcs, beaconViews, portals, colliders, update }
 */
export function buildMapScenery(mapId, opts) {
  return buildMapSceneryV2(mapId, opts);
}
