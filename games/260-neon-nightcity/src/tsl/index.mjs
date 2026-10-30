// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 02-gfx.js 的 gfxAuto 照「材質名字＋defines 的形狀」取用，GLSL 的雜湊對不上就退回執行期轉譯（__nc.gfx.gen() 列出）
import LIB from './lib.mjs';
import m0 from './m-carShadow.mjs';
import m1 from './m-char.mjs';
import m2 from './m-cloudSea.mjs';
import m3 from './m-clubBeam.mjs';
import m4 from './m-cone.mjs';
import m5 from './m-facade.mjs';
import m6 from './m-fx.mjs';
import m7 from './m-glb.mjs';
import m8 from './m-glbI.mjs';
import m9 from './m-glbLM.mjs';
import m10 from './m-headPool.mjs';
import m11 from './m-holo.mjs';
import m12 from './m-holoBeam.mjs';
import m13 from './m-isleGround.mjs';
import m14 from './m-lawn.mjs';
import m15 from './m-lawnBare.mjs';
import m16 from './m-led.mjs';
import m17 from './m-lighthouseBeam.mjs';
import m18 from './m-path.mjs';
import m19 from './m-plank.mjs';
import m20 from './m-poster.mjs';
import m21 from './m-quay.mjs';
import m22 from './m-rain.mjs';
import m23 from './m-rainWin.mjs';
import m24 from './m-road.mjs';
import m25 from './m-roadConn.mjs';
import m26 from './m-roadLane.mjs';
import m27 from './m-roadRamp.mjs';
import m28 from './m-sand.mjs';
import m29 from './m-sign.mjs';
import m30 from './m-sky.mjs';
import m31 from './m-splash.mjs';
import m32 from './m-steam.mjs';
import m33 from './m-stGlass.mjs';
import m34 from './m-streak.mjs';
import m35 from './m-tronBeam.mjs';
import m36 from './m-tronPool.mjs';
import m37 from './m-tronTrail.mjs';
import m38 from './m-uber.mjs';
import m39 from './m-uberPal.mjs';
import m40 from './m-uberTint.mjs';
import m41 from './m-uberTraf.mjs';
import m42 from './m-uberX.mjs';
import m43 from './m-villaGlass.mjs';
import m44 from './m-vol.mjs';
import m45 from './m-wake.mjs';
import m46 from './m-walk.mjs';
import m47 from './m-water.mjs';
export { LIB };
export const MAT = {
  "carShadow": m0,
  "char": m1,
  "cloudSea": m2,
  "clubBeam": m3,
  "cone": m4,
  "facade": m5,
  "fx": m6,
  "glb": m7,
  "glbI": m8,
  "glbLM": m9,
  "headPool": m10,
  "holo": m11,
  "holoBeam": m12,
  "isleGround": m13,
  "lawn": m14,
  "lawnBare": m15,
  "led": m16,
  "lighthouseBeam": m17,
  "path": m18,
  "plank": m19,
  "poster": m20,
  "quay": m21,
  "rain": m22,
  "rainWin": m23,
  "road": m24,
  "roadConn": m25,
  "roadLane": m26,
  "roadRamp": m27,
  "sand": m28,
  "sign": m29,
  "sky": m30,
  "splash": m31,
  "steam": m32,
  "stGlass": m33,
  "streak": m34,
  "tronBeam": m35,
  "tronPool": m36,
  "tronTrail": m37,
  "uber": m38,
  "uberPal": m39,
  "uberTint": m40,
  "uberTraf": m41,
  "uberX": m42,
  "villaGlass": m43,
  "vol": m44,
  "wake": m45,
  "walk": m46,
  "water": m47,
};
