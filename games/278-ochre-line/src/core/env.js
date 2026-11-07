// 環境貼圖：tools/bake-env.mjs 濾好的 half float cube（assets/278/sky/env.bin），每層每面直接上傳。
// 不要改回 HDRCubeTexture 的 prefilterOnLoad：開機在 GPU 上跑 4096 樣本，遇到 GPU 重啟時貼圖會留下隨機位元，
// 整局彩虹或全白，而且沒有任何錯誤訊息。見 tools/bake-env.mjs 檔頭。
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture.js';
import '@babylonjs/core/Materials/Textures/baseTexture.polynomial.js';   // 少了它 sphericalPolynomial 是 undefined，IBL 漫射整個消失且不報錯
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { SphericalPolynomial, SphericalHarmonics } from '@babylonjs/core/Maths/sphericalPolynomial.js';
import { ASSET_BASE } from './assets.js';

/** 檔案：Uint32 標頭長度、JSON（size、lods、scale、offset、sph、sh）、依 lod→face 排的 RGBA16F。 */
export async function loadEnv(scene) {
  const res = await fetch(ASSET_BASE + 'sky/env.bin'); if (!res.ok) throw new Error('env.bin ' + res.status);
  const buf = await res.arrayBuffer(), len = new DataView(buf).getUint32(0, true), meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len)));
  const engine = scene.getEngine(), it = engine.createRawCubeTexture(null, meta.size, Constants.TEXTUREFORMAT_RGBA, Constants.TEXTURETYPE_HALF_FLOAT, true, false, Constants.TEXTURE_TRILINEAR_SAMPLINGMODE);
  let o = 4 + len;
  for (let l = 0; l < meta.lods; l++) { const w = meta.size >> l, n = w * w * 4; for (let f = 0; f < 6; f++) { engine._uploadArrayBufferViewToTexture(it, new Uint16Array(buf, o, n), f, l); o += n * 2; } }   // Directly 版本在 WebGL 不綁貼圖，會傳到別的地方，反射全黑且不報錯
  const sp = new SphericalPolynomial(), sh = new SphericalHarmonics(); for (const k in meta.sph) sp[k].fromArray(meta.sph[k]);
  for (const [k, v] of meta.sh) sh[k].fromArray(v); sh.preScaled = true; sp._harmonics = sh;
  it._sphericalPolynomial = sp; it.isReady = true; it._lodGenerationScale = meta.scale; it._lodGenerationOffset = meta.offset; it.generateMipMaps = true;
  const wrap = () => { const t = new CubeTexture('', scene); t._texture = it; t.gammaSpace = false; t.lodGenerationScale = meta.scale; t.lodGenerationOffset = meta.offset; return t; };
  const env = wrap(), sky = wrap(); env._prefiltered = true; it.incrementReferences();
  return { env, sky };
}
