// 著色器共用：全域 uniform（時間、焦散強度、水色、霧）與 GLSL 片段（焦散、水下染色）。
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uCaust: { value: 1 },                                 // 焦散強度（早 0.6、午 1、黃昏 0.35）
  uWaterShallow: { value: new THREE.Color('#8cc7a8') },
  uWaterMid: { value: new THREE.Color('#3f8f86') },
  uWaterDeep: { value: new THREE.Color('#1f5560') },
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uSkyCol: { value: new THREE.Color('#cfe3ef') },
  uDusk: { value: 0 },
};

// 經典的可平鋪水下焦散（Dave Hoskins 的迭代式），uv 以公尺 / 7 為一格
export const CAUSTIC_GLSL = /* glsl */`
float causticAt(vec2 uv, float time) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.6);
}
`;

// 水下染色：依水下深度把顏色拉向水色、加焦散亮紋（地形、沉木、魚共用）
export const UNDERWATER_GLSL = /* glsl */`
uniform float uTime; uniform float uCaust;
uniform vec3 uWaterShallow; uniform vec3 uWaterMid; uniform vec3 uWaterDeep;
${CAUSTIC_GLSL}
vec3 underwater(vec3 col, vec3 wp, float tintK, float caustK) {
  float d = -wp.y;
  if (d <= 0.0) return col;
  float k = smoothstep(0.0, 0.25, d);
  float ca = causticAt(wp.xz / 7.0, uTime * 0.55) * 0.75 + causticAt(wp.xz / 4.3 + 3.1, uTime * 0.7) * 0.35;
  ca *= uCaust * (1.0 - smoothstep(0.5, 5.5, d)) * k;
  vec3 tint = mix(uWaterShallow, uWaterMid, smoothstep(0.3, 2.2, d));
  tint = mix(tint, uWaterDeep, smoothstep(2.2, 6.0, d));
  vec3 c = mix(col, mix(col * tint * 1.3, tint, 0.35), k * tintK);
  return c + ca * vec3(1.0, 0.97, 0.85) * 0.55 * caustK;
}
`;

// 把 underwater() 接進 MeshStandardMaterial（vertexColors 之後、光照之前）
export function patchUnderwater(mat, tintK = 0.25, caustK = 1) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldU;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldU = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#ifdef USE_INSTANCING\nvWorldU = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldU;\n' + UNDERWATER_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb = underwater(diffuseColor.rgb, vWorldU, ${tintK.toFixed(2)}, ${caustK.toFixed(2)});`);
  };
  mat.customProgramCacheKey = () => 'uw' + tintK + '/' + caustK;
  return mat;
}
