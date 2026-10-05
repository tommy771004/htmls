// 水下著色：所有水下物件（海床、珊瑚、礁石、海草、木樁、魚）的材質都以 onBeforeCompile 注入
// (1) 依水深的青綠吸收染色（越深越偏 lagoon 色，但仍看得到底）
// (2) 動態焦散：世界 xz 上兩層扭曲 Voronoi 網狀亮紋，隨時間流動，只出現在 y<0，
//     強度乘上直射光漫反射（自然帶入陰影與受光方向），三個通道用不同線寬做輕微色散。
import * as THREE from 'three';

export const UW = {
  uTime: { value: 0 },
  uCaus: { value: 1.0 },
  uShallow: { value: new THREE.Color('#8fe0d2') },
  uDeep: { value: new THREE.Color('#2f9aa8') },
};

export const CAUSTIC_GLSL = /* glsl */`
vec2 ccHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float ccVor(vec2 x, float t) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = ccHash(n + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
vec3 ccEdge(float d, float w) {
  vec3 e = 1.0 - smoothstep(vec3(0.0), vec3(w * 1.3, w, w * 0.78), vec3(d));
  return e * e;
}
vec3 causticRGB(vec2 p, float dep, float t) {
  // 網格比例固定：不能用隨水深變化的倍率去乘世界座標，否則離原點遠的斜坡上 d(p·sc)/dp 會趨近 0 或反向，
  // 紋路被拉成平行長條。水深只影響線寬（越深越粗、越糊）與強度。
  const float sc = 0.72;
  vec2 q = p * sc;
  q += 0.42 * vec2(sin(q.y * 2.1 + t * 0.55 + sin(q.x * 1.3)), cos(q.x * 1.9 - t * 0.47 + sin(q.y * 1.7)));
  float a = ccVor(q, t * 0.8);
  vec2 q2 = p * sc * 1.37 + vec2(17.3, -9.1);
  q2 += 0.5 * vec2(cos(q2.y * 1.6 - t * 0.4 + cos(q2.x * 2.3)), sin(q2.x * 1.8 + t * 0.62 + sin(q2.y * 1.1)));
  float b = ccVor(q2, t * 1.05 + 3.0);
  float w = 0.085 + min(dep, 4.0) * 0.022;
  vec3 ea = ccEdge(a, w), eb = ccEdge(b, w * 0.9);
  // 大尺度的明暗起伏，避免整片網紋一樣亮
  float ccPatch = 0.55 + 0.45 * sin(p.x * 0.23 + t * 0.15) * sin(p.y * 0.19 - t * 0.12 + 1.3);
  return (ea * 0.6 + eb * 0.4 + ea * eb * 1.8) * ccPatch;
}
`;

const patched = new WeakSet();
// opts.dry：{ value: Matrix4 }＝物件的世界→本地矩陣（每幀更新）。用在船上：船艙內是乾的，
// 只有朝外（本地 xz 往外）或朝下的面（水線下的船殼外側）才加焦散與水下染色。
// （assets.js 以 forEach(patchUnderwater) 呼叫，第二個參數會是索引數字，所以只認物件。）
export function patchUnderwater(mat, opts) {
  if (!mat || patched.has(mat)) return;
  if (!(mat.isMeshStandardMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return;
  patched.add(mat);
  const dry = opts && typeof opts === 'object' && opts.dry ? opts.dry : null;
  if (dry) mat.defines = { ...(mat.defines || {}), CC_DRY: '' };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = UW.uTime;
    sh.uniforms.uCaus = UW.uCaus;
    sh.uniforms.uShallow = UW.uShallow;
    sh.uniforms.uDeep = UW.uDeep;
    if (dry) sh.uniforms.uDryInv = dry;
    sh.vertexShader = 'varying vec3 vCcW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      {
        vec4 ccp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        ccp = instanceMatrix * ccp;
        #endif
        vCcW = (modelMatrix * ccp).xyz;
      }`);
    sh.fragmentShader = 'varying vec3 vCcW;\nuniform float uTime;\nuniform float uCaus;\nuniform vec3 uShallow;\nuniform vec3 uDeep;\n' +
      (dry ? 'uniform mat4 uDryInv;\n' : '') + CAUSTIC_GLSL +
      sh.fragmentShader.replace('#include <opaque_fragment>', `
      {
        float ccDep = -vCcW.y;
        float ccUnder = smoothstep(0.0, 0.1, ccDep);
        #ifdef CC_DRY
        {
          // normal 是看得到那一面的視空間法線（平面著色由螢幕導數算，永遠朝鏡頭）；轉回物件本地
          vec3 ccLp = (uDryInv * vec4(vCcW, 1.0)).xyz;
          vec3 ccWn = (vec4(normal, 0.0) * viewMatrix).xyz;
          vec3 ccLn = normalize(mat3(uDryInv) * ccWn);
          vec2 ccR = normalize(vec2(ccLp.x / 0.62, ccLp.z / 1.57) + 1e-4);
          float ccWet = max(step(ccLn.y, -0.3), step(0.2, dot(ccLn.xz, ccR)));
          ccUnder *= ccWet;
        }
        #endif
        if (ccUnder > 0.0) {
          vec3 cs = causticRGB(vCcW.xz, ccDep, uTime);
          float shallowFade = smoothstep(0.02, 0.35, ccDep);
          outgoingLight += reflectedLight.directDiffuse * cs * uCaus * shallowFade * 2.6 * exp(-ccDep * 0.16);
          // 吸收：越深越偏青（乘法，保留明暗對比）；散射霧的顏色跟著物體本身的亮度走、比例有上限，
          // 深處的暗礁石才不會被一層亮青色蓋成淡青半透明（像玻璃或冰）
          float lum0 = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          float k = 1.0 - exp(-ccDep * 0.5);
          vec3 tinted = outgoingLight * mix(vec3(1.0), vec3(0.42, 0.84, 0.86), k);
          vec3 scat = mix(uShallow, uDeep, clamp(ccDep / 3.6, 0.0, 1.0));
          tinted = mix(tinted, scat * clamp(lum0 * 1.3, 0.22, 0.8), min(ccDep * 0.18, 0.45) * 0.6);
          outgoingLight = mix(outgoingLight, tinted, ccUnder);
        }
      }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => (dry ? 'cc-underwater-dry' : 'cc-underwater');
  mat.needsUpdate = true;
}
